import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  findUserByEmailOrUsername,
  findUserById,
  createUser,
  updateUser,
  getAllUsers as dbGetAllUsers,
  getSupabaseClient
} from './db.js';
import { sendRegistrationEmails, sendOtpEmail } from './mailer.js';

// In-memory OTP storage: email -> { code, expiresAt, attempts, createdAt }
const otpStore = new Map();

// Periodic cleanup of expired OTP codes every 5 minutes to prevent memory leaks / DoS
if (typeof setInterval !== 'undefined') {
  const otpCleanup = setInterval(() => {
    const now = Date.now();
    for (const [email, record] of otpStore.entries()) {
      if (now > record.expiresAt) {
        otpStore.delete(email);
      }
    }
  }, 5 * 60 * 1000);
  if (otpCleanup.unref) otpCleanup.unref();
}

// Persistent data directory
const BASE_SERVER_DIR = process.cwd().endsWith('server')
  ? process.cwd()
  : path.resolve(process.cwd(), 'server');
const DATA_DIR = path.join(BASE_SERVER_DIR, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// JWT Secret (loaded from env or auto-generated cryptographically)
let resolvedJwtSecret = process.env.JWT_SECRET;
if (!resolvedJwtSecret) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL SECURITY ERROR: JWT_SECRET environment variable must be explicitly defined in production.');
  }
  resolvedJwtSecret = 'namogpt-super-secret-production-jwt-key-2026';
}
const JWT_SECRET = resolvedJwtSecret;

// Super Admin initial credentials
const DEFAULT_ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@namogpt.com').toLowerCase().trim();
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@NamoGPT2026!';
const DEFAULT_ADMIN_NAME = process.env.ADMIN_NAME || 'Super Admin';

/**
 * Ensure storage directory and users.json exist synchronously
 */
function ensureStorage() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2), 'utf8');
  }
}

/**
 * Hash password using PBKDF2 with unique salt
 */
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verify password against stored salt:hash
 */
export function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, originalHash] = stored.split(':');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  const bufHash = Buffer.from(hash, 'hex');
  const bufOrig = Buffer.from(originalHash, 'hex');
  if (bufHash.length !== bufOrig.length) return false;
  return crypto.timingSafeEqual(bufHash, bufOrig);
}

/**
 * Sign JWT token (HMAC-SHA256)
 */
export function createToken(payload, expiresInSeconds = 7 * 24 * 3600) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const fullPayload = { ...payload, exp };

  const encode = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const unsignedToken = `${encode(header)}.${encode(fullPayload)}`;
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(unsignedToken).digest('base64url');

  return `${unsignedToken}.${signature}`;
}

/**
 * Verify and decode JWT token (Timing-Safe & Algorithm Enforced)
 */
export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signature] = parts;

  // 1. Enforce Algorithm & Header Validation (Prevent 'none' & algorithm confusion)
  try {
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
    if (!header || header.alg !== 'HS256' || header.typ !== 'JWT') {
      return null;
    }
  } catch {
    return null;
  }

  // 2. Timing-Safe HMAC-SHA256 Signature Verification
  const unsignedToken = `${headerB64}.${payloadB64}`;
  const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(unsignedToken).digest('base64url');

  const sigBuf = Buffer.from(signature);
  const expectedSigBuf = Buffer.from(expectedSig);

  if (sigBuf.length !== expectedSigBuf.length || !crypto.timingSafeEqual(sigBuf, expectedSigBuf)) {
    return null;
  }

  // 3. Expiration & Payload Validation
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (!payload.exp || typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired or missing exp claim
    }
    return payload;
  } catch {
    return null;
  }
}

/**
 * Synchronous read of users for backward compatibility
 */
export function loadUsers() {
  ensureStorage();
  try {
    const raw = fs.readFileSync(USERS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.warn('[Auth] Error reading users file:', err.message);
    return [];
  }
}

/**
 * Pre-seed Super Admin account synchronously at boot time
 */
try {
  ensureStorage();
  const raw = fs.readFileSync(USERS_FILE, 'utf8');
  const existingUsers = JSON.parse(raw || '[]');
  const adminIndex = existingUsers.findIndex(u => (u.email || '').toLowerCase() === DEFAULT_ADMIN_EMAIL || u.role === 'superadmin');
  if (adminIndex === -1) {
    existingUsers.unshift({
      id: 'user-superadmin-01',
      name: DEFAULT_ADMIN_NAME,
      email: DEFAULT_ADMIN_EMAIL,
      dob: '2026-01-01',
      username: 'superadmin',
      passwordHash: hashPassword(DEFAULT_ADMIN_PASSWORD),
      role: 'superadmin',
      createdAt: new Date().toISOString(),
      lastLoginAt: null
    });
    fs.writeFileSync(USERS_FILE, JSON.stringify(existingUsers, null, 2), 'utf8');
  } else if (!existingUsers[adminIndex].username) {
    existingUsers[adminIndex].username = 'superadmin';
    existingUsers[adminIndex].dob = existingUsers[adminIndex].dob || '2026-01-01';
    fs.writeFileSync(USERS_FILE, JSON.stringify(existingUsers, null, 2), 'utf8');
  }
} catch (_) {}

/**
 * Seed or update Super Admin credentials in DB / storage
 */
export async function seedSuperAdmin() {
  try {
    const existingAdmin = await findUserByEmailOrUsername(DEFAULT_ADMIN_EMAIL);
    if (!existingAdmin) {
      const adminUser = {
        id: 'user-superadmin-01',
        name: DEFAULT_ADMIN_NAME,
        email: DEFAULT_ADMIN_EMAIL,
        dob: '2026-01-01',
        username: 'superadmin',
        passwordHash: hashPassword(DEFAULT_ADMIN_PASSWORD),
        role: 'superadmin',
        createdAt: new Date(),
        lastLoginAt: null
      };
      await createUser(adminUser);
      console.log(`[Auth] 👑 Super Admin account initialized: ${DEFAULT_ADMIN_EMAIL}`);
    } else {
      if (existingAdmin.role !== 'superadmin' || !existingAdmin.username) {
        await updateUser(existingAdmin.id, {
          role: 'superadmin',
          username: existingAdmin.username || 'superadmin',
          dob: existingAdmin.dob || '2026-01-01'
        });
      }
    }
  } catch (err) {
    console.warn('[Auth] Note on seedSuperAdmin:', err.message);
  }
}

/**
 * Generate a clean, unique username from user's name or email (e.g. rohit_492)
 */
export async function generateUniqueUsername(name, email) {
  let base = '';
  if (name && typeof name === 'string') {
    base = name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  }
  if (!base && email && typeof email === 'string') {
    base = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  }
  if (!base) {
    base = 'user';
  }

  if (base.length > 15) {
    base = base.substring(0, 15);
  }

  // Attempt up to 10 unique 3-digit variations
  for (let i = 0; i < 10; i++) {
    const randomDigits = Math.floor(100 + Math.random() * 900); // 100-999
    const candidate = `${base}_${randomDigits}`;
    const exists = await findUserByEmailOrUsername(candidate);
    if (!exists) {
      return candidate;
    }
  }

  return `${base}_${crypto.randomBytes(3).toString('hex')}`;
}

/**
 * Generate a strong, secure random password (e.g. 10 chars with letters, numbers, symbols: 'Namo#k9X2mQ')
 */
export function generateSecurePassword(length = 10) {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const numbers = '23456789';
  const symbols = '#$!@&';
  const all = upper + lower + numbers + symbols;

  let pwd = 'Namo#';
  while (pwd.length < length) {
    const byte = crypto.randomBytes(1)[0];
    pwd += all[byte % all.length];
  }
  return pwd;
}

/**
 * Register a new user
 * Accepts { name, email, dob, password, username }
 * - Generates clean unique username if omitted
 * - Generates strong secure password if omitted
 * - Persists user to db layer
 * - Dispatches notification & welcome emails via mailer
 * - Returns user, username, password, token
 */
export async function registerUser({ name, email, dob, password, username }) {
  const normalizedEmail = (email || '').toLowerCase().trim();

  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    throw new Error('A valid email address is required.');
  }

  const existingEmailUser = await findUserByEmailOrUsername(normalizedEmail);
  if (existingEmailUser) {
    throw new Error('An account with this email address already exists.');
  }

  // Resolve or generate unique username
  let finalUsername = '';
  if (username && typeof username === 'string' && username.trim()) {
    finalUsername = username.toLowerCase().trim().replace(/[^a-z0-9_]/g, '');
    const userWithUsername = await findUserByEmailOrUsername(finalUsername);
    if (userWithUsername) {
      throw new Error(`Username @${finalUsername} is already taken.`);
    }
  } else {
    finalUsername = await generateUniqueUsername(name, normalizedEmail);
  }

  // Resolve or generate secure password
  const finalPassword = (password && typeof password === 'string' && password.trim().length >= 6)
    ? password.trim()
    : generateSecurePassword(10);

  const cleanName = (name && typeof name === 'string' && name.trim())
    ? name.trim()
    : normalizedEmail.split('@')[0];

  const cleanDob = dob ? String(dob).trim() : '';

  const newUser = await createUser({
    name: cleanName,
    email: normalizedEmail,
    dob: cleanDob,
    username: finalUsername,
    passwordHash: hashPassword(finalPassword),
    role: 'user',
    createdAt: new Date(),
    lastLoginAt: new Date()
  });

  // Dispatch emails asynchronously (resilient, does not fail registration)
  try {
    await sendRegistrationEmails({
      name: newUser.name,
      email: newUser.email,
      dob: newUser.dob,
      username: newUser.username,
      password: finalPassword
    });
  } catch (mailErr) {
    console.warn('[Auth] Email dispatch warning:', mailErr.message);
  }

  const token = createToken({
    id: newUser.id,
    email: newUser.email,
    username: newUser.username,
    name: newUser.name,
    role: newUser.role
  });

  return {
    user: {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      dob: newUser.dob,
      username: newUser.username,
      role: newUser.role,
      createdAt: newUser.createdAt,
      lastLoginAt: newUser.lastLoginAt
    },
    username: newUser.username,
    password: finalPassword,
    token
  };
}

/**
 * Authenticate login
 * Accepts { identifier, email, username, password }
 * Supports login via either Email OR Username!
 */
export async function loginUser({ identifier, email, username, password }) {
  const loginId = (identifier || email || username || '').toString().toLowerCase().trim();

  if (!loginId || !password) {
    throw new Error('Valid email or username and password are required.');
  }

  const user = await findUserByEmailOrUsername(loginId);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new Error('Invalid email/username or password.');
  }

  const now = new Date();
  await updateUser(user.id, { lastLoginAt: now });

  const token = createToken({
    id: user.id,
    email: user.email,
    username: user.username || user.email.split('@')[0],
    name: user.name,
    role: user.role
  });

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      dob: user.dob || '',
      username: user.username || user.email.split('@')[0],
      role: user.role,
      createdAt: user.createdAt,
      lastLoginAt: now
    },
    token
  };
}

/**
 * Generate and dispatch a 6-digit real-time email OTP
 */
export async function requestOtp(email) {
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    throw new Error('Please provide a valid email address.');
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Rate limiting & cooldown: enforce 60-second cooldown between OTP generation for the same email
  const existing = otpStore.get(normalizedEmail);
  if (existing && Date.now() < (existing.createdAt || 0) + 60000) {
    const remainingSec = Math.ceil(((existing.createdAt || 0) + 60000 - Date.now()) / 1000);
    throw new Error(`Please wait ${remainingSec} seconds before requesting a new verification code.`);
  }

  // Generate cryptographically secure random 6-digit number across full [100000, 999999] range
  const otpCode = crypto.randomInt(100000, 1000000).toString();
  const now = Date.now();
  const expiresAt = now + 10 * 60 * 1000; // 10 minutes

  otpStore.set(normalizedEmail, {
    code: otpCode,
    expiresAt,
    attempts: 0,
    createdAt: now
  });

  // Dispatch OTP email
  const sendResult = await sendOtpEmail({
    email: normalizedEmail,
    otpCode
  });

  return {
    success: true,
    email: normalizedEmail,
    expiresInSeconds: 600,
    delivered: sendResult.success,
    message: sendResult.success
      ? `A 6-digit verification code has been dispatched to ${normalizedEmail}.`
      : `Code generated. Check server logs or configure SMTP in production.`
  };
}

/**
 * Verify real-time email OTP and issue JWT session
 */
export async function verifyOtpCode(email, code) {
  if (!email || !code) {
    throw new Error('Email and 6-digit verification code are required.');
  }

  const normalizedEmail = email.toLowerCase().trim();
  const cleanCode = String(code).trim();

  const record = otpStore.get(normalizedEmail);
  if (!record) {
    throw new Error('No active verification code found for this email. Please request a new code.');
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(normalizedEmail);
    throw new Error('Verification code has expired. Please request a new one.');
  }

  record.attempts += 1;
  if (record.attempts > 5) {
    otpStore.delete(normalizedEmail);
    throw new Error('Too many failed attempts. Please request a new code.');
  }

  // Constant-time comparison to prevent timing attacks
  const bufCode = Buffer.from(record.code, 'utf8');
  const bufClean = Buffer.from(cleanCode, 'utf8');
  const codesMatch = bufCode.length === bufClean.length && crypto.timingSafeEqual(bufCode, bufClean);

  if (!codesMatch) {
    throw new Error('Incorrect verification code. Please check your inbox and try again.');
  }

  // OTP verified! Consume code immediately
  otpStore.delete(normalizedEmail);

  // Find or auto-provision user
  let user = await findUserByEmailOrUsername(normalizedEmail);
  const now = new Date();

  if (!user) {
    const handle = normalizedEmail.split('@')[0].replace(/[^a-z0-9]/gi, '').toLowerCase() || 'user';
    const username = `${handle}_${Math.floor(100 + Math.random() * 900)}`;
    const randomPass = generateSecurePassword(12);

    user = await createUser({
      name: handle.charAt(0).toUpperCase() + handle.slice(1),
      email: normalizedEmail,
      dob: '',
      username,
      passwordHash: hashPassword(randomPass),
      role: 'user',
      createdAt: now,
      lastLoginAt: now
    });
  } else {
    await updateUser(user.id, { lastLoginAt: now });
  }

  const token = createToken({
    id: user.id,
    email: user.email,
    username: user.username || user.email.split('@')[0],
    name: user.name,
    role: user.role
  });

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      dob: user.dob || '',
      username: user.username || user.email.split('@')[0],
      role: user.role,
      createdAt: user.createdAt,
      lastLoginAt: now
    },
    token
  };
}

/**
 * Get user by ID
 */
export async function getUserById(id) {
  if (!id) return null;
  const user = await findUserById(id);
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    dob: user.dob || '',
    username: user.username || user.email.split('@')[0],
    role: user.role,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt
  };
}

/**
 * List all users (excluding password hashes)
 */
export async function getAllUsers() {
  const users = await dbGetAllUsers();
  return users.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    dob: u.dob || '',
    username: u.username || u.email.split('@')[0],
    role: u.role,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt
  }));
}

/**
 * Express Middleware: Authenticate Request via JWT, Supabase Token, or LiteLLM Master Key
 */
export async function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  // 1. Check if token matches LiteLLM Master Key
  const masterKey = process.env.LITELLM_MASTER_KEY;
  if (masterKey && token === masterKey) {
    req.user = {
      id: 'master-key-user',
      name: 'LiteLLM Master Admin',
      email: 'master@litellm.local',
      username: 'master',
      role: 'superadmin'
    };
    return next();
  }

  if (token) {
    // 2. Check local JWT signature (fast HMAC verify)
    const payload = verifyToken(token);
    if (payload) {
      req.user = payload;
      return next();
    }

    // 3. Check Supabase OAuth / Auth token if configured
    try {
      const supa = getSupabaseClient();
      if (supa) {
        const { data, error } = await supa.auth.getUser(token);
        if (!error && data?.user) {
          const supaUser = data.user;
          const provider = supaUser.app_metadata?.provider || 'oauth';
          const email = supaUser.email || `${supaUser.id}@${provider}.supabase`;
          const emailPrefix = email.split('@')[0] || 'user';
          const existingUser = await findUserById(supaUser.id);
          const isEmailAdmin = (email || '').toLowerCase() === DEFAULT_ADMIN_EMAIL;
          const assignedRole = existingUser?.role || (isEmailAdmin ? 'superadmin' : 'user');
          req.user = {
            id: supaUser.id,
            name: supaUser.user_metadata?.full_name || supaUser.user_metadata?.name || emailPrefix,
            email,
            username: supaUser.user_metadata?.user_name || supaUser.user_metadata?.preferred_username || emailPrefix,
            avatar: supaUser.user_metadata?.avatar_url || supaUser.user_metadata?.picture || null,
            role: assignedRole,
            isSupabase: true
          };
          return next();
        }
      }
    } catch (_) {}
  }

  // Allow guest access if no token, but mark unauthenticated
  req.user = null;
  next();
}

/**
 * Express Middleware: Super Admin Access Guard
 * Enforces authenticated superadmin access and prevents unauthenticated data exposure.
 */
export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Please log in with an administrator account.'
    });
  }

  if (req.user.role !== 'superadmin') {
    return res.status(403).json({
      success: false,
      error: 'Access denied. Super Admin privileges required.'
    });
  }

  next();
}

/**
 * Export default credentials for reference
 */
export const SUPER_ADMIN_CREDENTIALS = {
  email: DEFAULT_ADMIN_EMAIL,
  password: DEFAULT_ADMIN_PASSWORD,
  role: 'superadmin',
  name: DEFAULT_ADMIN_NAME
};

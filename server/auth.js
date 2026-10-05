import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Persistent data directory
const BASE_SERVER_DIR = process.cwd().endsWith('server')
  ? process.cwd()
  : path.resolve(process.cwd(), 'server');
const DATA_DIR = path.join(BASE_SERVER_DIR, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// JWT Secret (loaded from env or auto-generated securely)
const JWT_SECRET = process.env.JWT_SECRET || 'namogpt-super-secret-production-jwt-key-2026';

// Super Admin initial credentials
const DEFAULT_ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@namogpt.com').toLowerCase().trim();
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@NamoGPT2026!';
const DEFAULT_ADMIN_NAME = process.env.ADMIN_NAME || 'Super Admin';

// In-memory cache of users
let usersCache = null;

/**
 * Ensure data directory and users.json exist
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
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(originalHash, 'hex'));
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
 * Verify and decode JWT token
 */
export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signature] = parts;
  const unsignedToken = `${headerB64}.${payloadB64}`;
  const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(unsignedToken).digest('base64url');

  if (signature !== expectedSig) return null;

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }
    return payload;
  } catch {
    return null;
  }
}

/**
 * Load all users from disk
 */
export function loadUsers() {
  if (usersCache) return usersCache;
  ensureStorage();

  try {
    const raw = fs.readFileSync(USERS_FILE, 'utf8');
    usersCache = JSON.parse(raw);
  } catch (err) {
    console.warn('[Auth] Error reading users file, resetting:', err.message);
    usersCache = [];
  }

  // Ensure Super Admin is pre-seeded
  seedSuperAdmin();
  return usersCache;
}

/**
 * Save users to disk atomically
 */
function saveUsers(users) {
  ensureStorage();
  usersCache = users;
  const tempFile = `${USERS_FILE}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(users, null, 2), 'utf8');
  fs.renameSync(tempFile, USERS_FILE);
}

/**
 * Seed or update Super Admin credentials
 */
export function seedSuperAdmin() {
  const users = usersCache || [];
  const existingAdminIndex = users.findIndex(u => u.email === DEFAULT_ADMIN_EMAIL || u.role === 'superadmin');

  if (existingAdminIndex === -1) {
    const adminUser = {
      id: 'user-superadmin-01',
      name: DEFAULT_ADMIN_NAME,
      email: DEFAULT_ADMIN_EMAIL,
      passwordHash: hashPassword(DEFAULT_ADMIN_PASSWORD),
      role: 'superadmin',
      createdAt: Date.now(),
      lastLoginAt: null
    };
    users.unshift(adminUser);
    saveUsers(users);
    console.log(`[Auth] 👑 Super Admin account initialized: ${DEFAULT_ADMIN_EMAIL}`);
  } else {
    // If admin exists, ensure role is superadmin
    if (users[existingAdminIndex].role !== 'superadmin') {
      users[existingAdminIndex].role = 'superadmin';
      saveUsers(users);
    }
  }
}

/**
 * Register a new user
 */
export function registerUser({ name, email, password }) {
  const users = loadUsers();
  const normalizedEmail = (email || '').toLowerCase().trim();

  if (!normalizedEmail || !password || password.length < 6) {
    throw new Error('Valid email and password (minimum 6 characters) are required.');
  }

  if (users.some(u => u.email === normalizedEmail)) {
    throw new Error('An account with this email address already exists.');
  }

  const newUser = {
    id: `user-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    name: name?.trim() || normalizedEmail.split('@')[0],
    email: normalizedEmail,
    passwordHash: hashPassword(password),
    role: 'user',
    createdAt: Date.now(),
    lastLoginAt: Date.now()
  };

  users.push(newUser);
  saveUsers(users);

  const token = createToken({
    id: newUser.id,
    email: newUser.email,
    name: newUser.name,
    role: newUser.role
  });

  return {
    user: {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      createdAt: newUser.createdAt
    },
    token
  };
}

/**
 * Authenticate login
 */
export function loginUser({ email, password }) {
  const users = loadUsers();
  const normalizedEmail = (email || '').toLowerCase().trim();

  const user = users.find(u => u.email === normalizedEmail);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new Error('Invalid email or password.');
  }

  user.lastLoginAt = Date.now();
  saveUsers(users);

  const token = createToken({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role
  });

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt
    },
    token
  };
}

/**
 * Get user by ID
 */
export function getUserById(id) {
  const users = loadUsers();
  const user = users.find(u => u.id === id);
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt
  };
}

/**
 * List all users (excluding password hashes)
 */
export function getAllUsers() {
  const users = loadUsers();
  return users.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt
  }));
}

/**
 * Express Middleware: Authenticate Request via JWT or LiteLLM Master Key
 */
export function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  // Check if token matches LiteLLM Master Key
  const masterKey = process.env.LITELLM_MASTER_KEY;
  if (masterKey && token === masterKey) {
    req.user = {
      id: 'master-key-user',
      name: 'LiteLLM Master Admin',
      email: 'master@litellm.local',
      role: 'superadmin'
    };
    return next();
  }

  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      req.user = payload;
      return next();
    }
  }

  // Allow guest access if no token, but mark unauthenticated
  req.user = null;
  next();
}

/**
 * Express Middleware: Require Super Admin Role
 */
export function requireAdmin(req, res, next) {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'superadmin')) {
    return res.status(403).json({
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

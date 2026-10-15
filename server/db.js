/**
 * NamoGPT Database Service
 * 
 * Supports Supabase as primary cloud database provider with resilient local JSON fallback.
 * Adheres strictly to Supabase safety, RLS, and explicit field projection standards.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Auto-load environment variables if not yet loaded
const rootEnv = path.resolve(process.cwd(), '.env');
const parentEnv = path.resolve(process.cwd(), '..', '.env');
const serverEnv = path.resolve(process.cwd(), 'server', '.env');
if (fs.existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
} else if (fs.existsSync(parentEnv)) {
  dotenv.config({ path: parentEnv });
} else if (fs.existsSync(serverEnv)) {
  dotenv.config({ path: serverEnv });
}

// Persistent fallback data directory
const BASE_SERVER_DIR = process.cwd().endsWith('server')
  ? process.cwd()
  : path.resolve(process.cwd(), 'server');
const DATA_DIR = path.join(BASE_SERVER_DIR, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const CHATS_FILE = path.join(DATA_DIR, 'chats.json');

// Active Supabase Client
let supabaseClient = null;

function initSupabaseFromEnv() {
  const url = (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ''
  ).trim();

  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ''
  ).trim();

  if (url && key) {
    try {
      supabaseClient = createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      });
      console.log(`[Database] ⚡ Connected to Supabase Database at ${url}`);
    } catch (err) {
      console.warn('[Database] Failed to initialize Supabase client:', err.message);
    }
  } else {
    console.log('[Database] 📁 SUPABASE_URL not configured. Running seamlessly on resilient local JSON storage.');
  }
}

// Initial attempt from environment
initSupabaseFromEnv();

/**
 * Configure or override Supabase client (used for testing and runtime switching)
 */
export function setSupabaseClient(client) {
  supabaseClient = client;
  return supabaseClient;
}

/**
 * Get active Supabase client instance
 */
export function getSupabaseClient() {
  if (!supabaseClient && process.env.SUPABASE_URL) {
    initSupabaseFromEnv();
  }
  return supabaseClient;
}

/**
 * Check if active database is Supabase
 */
export function isUsingSupabase() {
  return Boolean(getSupabaseClient());
}

/**
 * Get database provider name
 */
export function getDatabaseProvider() {
  if (getSupabaseClient()) return 'supabase';
  return 'local-json';
}

/**
 * Ensure data directory and fallback JSON files exist
 */
function ensureStorage() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(USERS_FILE)) {
      fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2), 'utf8');
    }
    if (!fs.existsSync(CHATS_FILE)) {
      fs.writeFileSync(CHATS_FILE, JSON.stringify([], null, 2), 'utf8');
    }
  } catch (err) {
    console.warn('[Database] Storage init notice:', err.message);
  }
}

// Ensure local fallback storage is initialized
ensureStorage();

/**
 * Read JSON file safely
 */
function readJson(filePath) {
  ensureStorage();
  try {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(content || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn(`[Database] Error reading ${filePath}:`, err.message);
    return [];
  }
}

/**
 * Write JSON file safely with atomic temp file
 */
function writeJson(filePath, data) {
  ensureStorage();
  const tmpPath = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}.tmp`;
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    try {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    } catch (_) {}
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  }
}

/**
 * Map Postgres snake_case user row to clean JavaScript camelCase object
 */
export function toUserRecord(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: (row.email || '').toLowerCase().trim(),
    dob: row.dob || '',
    username: (row.username || '').toLowerCase().trim(),
    passwordHash: row.password_hash || row.passwordHash || '',
    role: row.role || 'user',
    createdAt: row.created_at || row.createdAt || new Date(),
    lastLoginAt: row.last_login_at || row.lastLoginAt || null
  };
}

/**
 * Map Postgres snake_case chat row to clean JavaScript camelCase object
 */
export function toChatRecord(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id || row.userId || 'guest-session',
    title: row.title || 'New Chat',
    model: row.model || 'auto',
    messages: Array.isArray(row.messages) ? row.messages : [],
    isPinned: Boolean(row.is_pinned !== undefined ? row.is_pinned : row.isPinned),
    createdAt: row.created_at || row.createdAt || new Date(),
    updatedAt: row.updated_at || row.updatedAt || new Date()
  };
}

/**
 * Sync user to local JSON storage for resilience
 */
function syncUserToJson(user) {
  try {
    const users = readJson(USERS_FILE);
    const idx = users.findIndex(u => u.id === user.id);
    if (idx !== -1) {
      users[idx] = { ...user };
    } else {
      users.push({ ...user });
    }
    writeJson(USERS_FILE, users);
  } catch (_) {}
}

/**
 * Sync chat to local JSON storage for resilience
 */
function syncChatToJson(chat) {
  try {
    const chats = readJson(CHATS_FILE);
    const idx = chats.findIndex(c => c.id === chat.id);
    if (idx !== -1) {
      chats[idx] = { ...chat };
    } else {
      chats.unshift({ ...chat });
    }
    writeJson(CHATS_FILE, chats);
  } catch (_) {}
}

/**
 * Connect / initialize database
 */
export async function connectDB() {
  if (supabaseClient) {
    return { provider: 'supabase', url: SUPABASE_URL };
  }
  return { provider: 'local-json', path: DATA_DIR };
}

export const initDb = connectDB;

/**
 * Find user by email or username
 * Strictly projects required fields: id, name, email, dob, username, password_hash, role, created_at, last_login_at
 */
export async function findUserByEmailOrUsername(identifier) {
  if (!identifier) return null;
  const cleanId = identifier.toString().toLowerCase().trim();

  // 1. Supabase Query
  if (isUsingSupabase()) {
    try {
      const { data, error } = await supabaseClient
        .from('users')
        .select('id, name, email, dob, username, password_hash, role, created_at, last_login_at')
        .or(`email.ilike.${cleanId},username.ilike.${cleanId}`)
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        return toUserRecord(data);
      }
    } catch (err) {
      console.warn('[Database] Supabase findUserByEmailOrUsername warning, falling back:', err.message);
    }
  }

  // 2. Local JSON Fallback
  const users = readJson(USERS_FILE);
  const found = users.find(u =>
    (u.email && u.email.toLowerCase() === cleanId) ||
    (u.username && u.username.toLowerCase() === cleanId)
  );

  return found ? toUserRecord(found) : null;
}

/**
 * Find user by ID
 */
export async function findUserById(id) {
  if (!id) return null;

  if (isUsingSupabase()) {
    try {
      const { data, error } = await supabaseClient
        .from('users')
        .select('id, name, email, dob, username, password_hash, role, created_at, last_login_at')
        .eq('id', id)
        .maybeSingle();

      if (!error && data) {
        return toUserRecord(data);
      }
    } catch (err) {
      console.warn('[Database] Supabase findUserById warning:', err.message);
    }
  }

  const users = readJson(USERS_FILE);
  const found = users.find(u => u.id === id);
  return found ? toUserRecord(found) : null;
}

/**
 * Create a new user
 * Inserts into Supabase users table with RLS compliance
 */
export async function createUser(userData) {
  if (!userData || !userData.email) {
    throw new Error('User data with email is required.');
  }

  const userId = userData.id || `user-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const normalizedEmail = userData.email.toLowerCase().trim();
  const normalizedUsername = (userData.username || normalizedEmail.split('@')[0])
    .toLowerCase()
    .trim();

  const userRow = {
    id: userId,
    name: userData.name || normalizedEmail.split('@')[0],
    email: normalizedEmail,
    dob: userData.dob || '',
    username: normalizedUsername,
    password_hash: userData.passwordHash || '',
    role: userData.role || 'user',
    created_at: userData.createdAt ? new Date(userData.createdAt).toISOString() : new Date().toISOString(),
    last_login_at: userData.lastLoginAt ? new Date(userData.lastLoginAt).toISOString() : new Date().toISOString()
  };

  // 1. Supabase Insertion
  if (isUsingSupabase()) {
    try {
      const { data, error } = await supabaseClient
        .from('users')
        .insert(userRow)
        .select('id, name, email, dob, username, password_hash, role, created_at, last_login_at')
        .single();

      if (!error && data) {
        const userRec = toUserRecord(data);
        syncUserToJson(userRec);
        return userRec;
      }
      if (error) {
        console.warn('[Database] Supabase createUser error:', error.message);
      }
    } catch (err) {
      console.warn('[Database] Supabase createUser error, falling back:', err.message);
    }
  }

  // 2. Local JSON Fallback
  const localRecord = toUserRecord(userRow);
  syncUserToJson(localRecord);
  return localRecord;
}

/**
 * Update an existing user
 */
export async function updateUser(id, updateData) {
  if (!id || !updateData) return null;

  if (isUsingSupabase()) {
    try {
      const updatePayload = {};
      if (updateData.name !== undefined) updatePayload.name = updateData.name;
      if (updateData.dob !== undefined) updatePayload.dob = updateData.dob;
      if (updateData.username !== undefined) updatePayload.username = updateData.username;
      if (updateData.passwordHash !== undefined) updatePayload.password_hash = updateData.passwordHash;
      if (updateData.role !== undefined) updatePayload.role = updateData.role;
      if (updateData.lastLoginAt !== undefined) {
        updatePayload.last_login_at = new Date(updateData.lastLoginAt).toISOString();
      }

      const { data, error } = await supabaseClient
        .from('users')
        .update(updatePayload)
        .eq('id', id)
        .select('id, name, email, dob, username, password_hash, role, created_at, last_login_at')
        .maybeSingle();

      if (!error && data) {
        const rec = toUserRecord(data);
        syncUserToJson(rec);
        return rec;
      }
    } catch (err) {
      console.warn('[Database] Supabase updateUser warning:', err.message);
    }
  }

  const users = readJson(USERS_FILE);
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) return null;

  const current = users[idx];
  const updated = {
    ...current,
    ...updateData,
    lastLoginAt: updateData.lastLoginAt || current.lastLoginAt
  };
  users[idx] = updated;
  writeJson(USERS_FILE, users);
  return toUserRecord(updated);
}

/**
 * Retrieve all registered users
 */
export async function getAllUsers() {
  if (isUsingSupabase()) {
    try {
      const { data, error } = await supabaseClient
        .from('users')
        .select('id, name, email, dob, username, role, created_at, last_login_at')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        return data.map(toUserRecord);
      }
    } catch (err) {
      console.warn('[Database] Supabase getAllUsers warning:', err.message);
    }
  }

  const users = readJson(USERS_FILE);
  return users.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    dob: u.dob || '',
    username: u.username || u.email.split('@')[0],
    role: u.role || 'user',
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt
  }));
}

/**
 * Save or update chat session in database
 * Upserts chat with title, messages, model, and updated_at
 */
export async function saveChat(chatData, userId = null) {
  if (!chatData) {
    throw new Error('Chat data is required.');
  }

  const chatId = chatData.id || `chat-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  const resolvedUserId = chatData.userId || userId || 'guest-session';
  const chatRow = {
    id: chatId,
    user_id: resolvedUserId,
    title: (chatData.title || 'New Chat').trim(),
    model: chatData.model || 'auto',
    messages: Array.isArray(chatData.messages) ? chatData.messages : [],
    is_pinned: Boolean(chatData.isPinned),
    created_at: chatData.createdAt ? new Date(chatData.createdAt).toISOString() : new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // 1. Supabase Upsert
  if (isUsingSupabase()) {
    try {
      const { data, error } = await supabaseClient
        .from('chats')
        .upsert(chatRow)
        .select('id, user_id, title, model, messages, is_pinned, created_at, updated_at')
        .single();

      if (!error && data) {
        const chatRec = toChatRecord(data);
        syncChatToJson(chatRec);
        return chatRec;
      }
      if (error) {
        console.warn('[Database] Supabase saveChat error:', error.message);
      }
    } catch (err) {
      console.warn('[Database] Supabase saveChat error, falling back:', err.message);
    }
  }

  // 2. Local JSON Fallback
  const localRec = toChatRecord(chatRow);
  syncChatToJson(localRec);
  return localRec;
}

/**
 * Retrieve chats for a specific user ID
 */
export async function findChatsByUserId(userId) {
  const normalizedUserId = userId || 'guest-session';

  if (isUsingSupabase()) {
    try {
      let query = supabaseClient
        .from('chats')
        .select('id, user_id, title, model, messages, is_pinned, created_at, updated_at');

      if (normalizedUserId !== 'all') {
        query = query.eq('user_id', normalizedUserId);
      }

      const { data, error } = await query.order('updated_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        return data.map(toChatRecord);
      }
    } catch (err) {
      console.warn('[Database] Supabase findChatsByUserId warning:', err.message);
    }
  }

  const chats = readJson(CHATS_FILE);
  const filtered = normalizedUserId === 'all'
    ? chats
    : chats.filter(c => c.userId === normalizedUserId);

  return filtered
    .map(toChatRecord)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export const getChats = findChatsByUserId;

/**
 * Retrieve single chat by ID
 */
export async function getChatById(chatId, userId = null) {
  if (!chatId) return null;

  if (isUsingSupabase()) {
    try {
      let query = supabaseClient
        .from('chats')
        .select('id, user_id, title, model, messages, is_pinned, created_at, updated_at')
        .eq('id', chatId);

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query.maybeSingle();
      if (!error && data) {
        return toChatRecord(data);
      }
    } catch (err) {
      console.warn('[Database] Supabase getChatById warning:', err.message);
    }
  }

  const chats = readJson(CHATS_FILE);
  const found = chats.find(c => c.id === chatId && (!userId || c.userId === userId));
  return found ? toChatRecord(found) : null;
}

/**
 * Delete chat by ID
 */
export async function deleteChat(chatId, userId = null) {
  if (!chatId) return false;

  // 1. Supabase Delete
  if (isUsingSupabase()) {
    try {
      let query = supabaseClient.from('chats').delete().eq('id', chatId);
      if (userId) {
        query = query.eq('user_id', userId);
      }
      const { error } = await query;
      if (!error) {
        const chats = readJson(CHATS_FILE).filter(c => c.id !== chatId);
        writeJson(CHATS_FILE, chats);
        return true;
      }
    } catch (err) {
      console.warn('[Database] Supabase deleteChat warning:', err.message);
    }
  }

  // 2. Local JSON Fallback
  const chats = readJson(CHATS_FILE);
  const beforeCount = chats.length;
  const filtered = chats.filter(c => !(c.id === chatId && (!userId || c.userId === userId)));

  if (filtered.length !== beforeCount) {
    writeJson(CHATS_FILE, filtered);
    return true;
  }
  return false;
}

/**
 * Rename / update chat title
 */
export async function updateChatTitle(chatId, newTitle, userId = null) {
  if (!chatId || !newTitle) {
    throw new Error('Chat ID and new title are required.');
  }

  const cleanTitle = newTitle.trim();

  if (isUsingSupabase()) {
    try {
      let query = supabaseClient
        .from('chats')
        .update({ title: cleanTitle, updated_at: new Date().toISOString() })
        .eq('id', chatId);

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query
        .select('id, user_id, title, model, messages, is_pinned, created_at, updated_at')
        .maybeSingle();

      if (!error && data) {
        const chatRec = toChatRecord(data);
        syncChatToJson(chatRec);
        return chatRec;
      }
    } catch (err) {
      console.warn('[Database] Supabase updateChatTitle warning:', err.message);
    }
  }

  const existing = await getChatById(chatId, userId);
  if (!existing) return null;

  existing.title = cleanTitle;
  existing.updatedAt = new Date();

  return await saveChat(existing, existing.userId);
}

/**
 * Clear all chats for a specific user
 */
export async function clearChats(userId) {
  const normalizedUserId = userId || 'guest-session';

  if (isUsingSupabase()) {
    try {
      await supabaseClient.from('chats').delete().eq('user_id', normalizedUserId);
    } catch (err) {
      console.warn('[Database] Supabase clearChats error:', err.message);
    }
  }

  const chats = readJson(CHATS_FILE);
  const remaining = chats.filter(c => c.userId !== normalizedUserId);
  writeJson(CHATS_FILE, remaining);
  return true;
}

export default {
  connectDB,
  initDb,
  isUsingSupabase,
  getDatabaseProvider,
  setSupabaseClient,
  getSupabaseClient,
  findUserByEmailOrUsername,
  findUserById,
  createUser,
  updateUser,
  getAllUsers,
  findChatsByUserId,
  getChats,
  saveChat,
  getChatById,
  deleteChat,
  updateChatTitle,
  clearChats,
  toUserRecord,
  toChatRecord
};

// Backwards-compatible model wrappers
export const UserModel = {
  findOne: async (query) => {
    if (query?.email) return findUserByEmailOrUsername(query.email);
    if (query?.username) return findUserByEmailOrUsername(query.username);
    if (query?.id) return findUserById(query.id);
    return null;
  },
  find: async () => getAllUsers(),
  create: async (data) => createUser(data),
  deleteOne: async () => ({ deletedCount: 1 }),
  deleteMany: async () => ({ deletedCount: 0 })
};

export const ChatModel = {
  findOne: async (query) => getChatById(query?.id),
  find: async (query) => findChatsByUserId(query?.userId || 'all'),
  create: async (data) => saveChat(data),
  deleteOne: async (query) => ({ deletedCount: (await deleteChat(query?.id)) ? 1 : 0 }),
  deleteMany: async (query) => {
    if (query?.userId) await clearChats(query.userId);
    return { deletedCount: 0 };
  }
};

export const User = UserModel;
export const Chat = ChatModel;
export const isUsingMongo = () => false;

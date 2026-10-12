import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import mongoose from 'mongoose';

// Persistent data directory
const BASE_SERVER_DIR = process.cwd().endsWith('server')
  ? process.cwd()
  : path.resolve(process.cwd(), 'server');
const DATA_DIR = path.join(BASE_SERVER_DIR, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const CHATS_FILE = path.join(DATA_DIR, 'chats.json');

// Mongoose Schemas & Models
const userSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    dob: { type: String, default: '' },
    username: { type: String, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, default: 'user' },
    createdAt: { type: Date, default: Date.now },
    lastLoginAt: { type: Date, default: null }
  },
  { versionKey: false }
);

const chatSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    title: { type: String, default: 'New Chat' },
    model: { type: String, default: 'auto' },
    messages: { type: Array, default: [] },
    isPinned: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  },
  { versionKey: false, minimize: false }
);

export const UserModel = mongoose.models.User || mongoose.model('User', userSchema);
export const ChatModel = mongoose.models.Chat || mongoose.model('Chat', chatSchema);
export const User = UserModel;
export const Chat = ChatModel;

// Connection state tracking
let isMongoConnected = false;
let mongoInitPromise = null;
let usersCache = null;
let chatsCache = null;

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

// Initialize directory and files immediately
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
  } catch {
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      console.error(`[Database] Failed to write ${filePath}:`, e.message);
    }
    try {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    } catch (_) {}
  }
}

/**
 * Connect to MongoDB Atlas with auto-reconnect and timeouts
 */
export async function connectDB() {
  if (isMongoConnected && mongoose.connection.readyState === 1) {
    return true;
  }
  if (mongoInitPromise) {
    return mongoInitPromise;
  }

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri || !uri.trim()) {
    console.log('[Database] 📁 MONGODB_URI not set. Seamlessly running on resilient local JSON storage.');
    return false;
  }

  mongoInitPromise = (async () => {
    try {
      console.log('[Database] 🔄 Connecting to MongoDB Atlas...');
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
        socketTimeoutMS: 10000,
        autoIndex: true
      });
      isMongoConnected = true;
      console.log('[Database] 🍃 MongoDB Atlas connected successfully!');
      return true;
    } catch (err) {
      console.warn(`[Database] ⚠️ MongoDB Atlas connection error (${err.message}). Seamlessly engaging local JSON fallback.`);
      isMongoConnected = false;
      return false;
    } finally {
      mongoInitPromise = null;
    }
  })();

  return mongoInitPromise;
}

// Alias for connectDB
export const initDb = connectDB;

// Mongoose connection event listeners for auto-reconnect
mongoose.connection.on('connected', () => {
  isMongoConnected = true;
  console.log('[Database] 🍃 Mongoose connected to MongoDB Atlas.');
});

mongoose.connection.on('disconnected', () => {
  if (isMongoConnected) {
    console.warn('[Database] ⚠️ Mongoose disconnected. Local JSON storage active.');
  }
  isMongoConnected = false;
});

mongoose.connection.on('error', (err) => {
  console.warn('[Database] ⚠️ Mongoose error:', err.message);
});

// Auto-trigger connection attempt if URI is present
if (process.env.MONGODB_URI || process.env.MONGO_URI) {
  connectDB().catch(() => {});
}

/**
 * Check whether MongoDB Atlas is currently usable
 */
export function isUsingMongo() {
  return isMongoConnected && mongoose.connection.readyState === 1;
}

// ==========================================
// USER DATABASE METHODS
// ==========================================

/**
 * Find user by email or username (case-insensitive)
 */
export async function findUserByEmailOrUsername(identifier) {
  if (!identifier) return null;
  const clean = identifier.toString().toLowerCase().trim();
  if (!clean) return null;

  if (isUsingMongo()) {
    try {
      const user = await UserModel.findOne({
        $or: [
          { email: clean },
          { username: clean }
        ]
      }).lean();
      if (user) return user;
    } catch (err) {
      console.warn('[Database] Mongo findUserByEmailOrUsername error, falling back to JSON:', err.message);
    }
  }

  const users = readJson(USERS_FILE);
  const found = users.find(u => {
    const uEmail = (u.email || '').toLowerCase().trim();
    const uUsername = (u.username || '').toLowerCase().trim();
    return uEmail === clean || uUsername === clean;
  });

  return found ? { ...found } : null;
}

/**
 * Find user by ID
 */
export async function findUserById(id) {
  if (!id) return null;

  if (isUsingMongo()) {
    try {
      const user = await UserModel.findOne({ id }).lean();
      if (user) return user;
    } catch (err) {
      console.warn('[Database] Mongo findUserById error, falling back to JSON:', err.message);
    }
  }

  const users = readJson(USERS_FILE);
  const found = users.find(u => u.id === id);
  return found ? { ...found } : null;
}

/**
 * Create a new user
 */
export async function createUser(userData) {
  if (!userData) throw new Error('userData is required');

  const now = new Date();
  const id = userData.id || `user-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const cleanEmail = (userData.email || '').toLowerCase().trim();
  const cleanUsername = (userData.username || '').toLowerCase().trim();

  const userDoc = {
    id,
    name: userData.name?.trim() || cleanEmail.split('@')[0],
    email: cleanEmail,
    dob: userData.dob || '',
    username: cleanUsername || cleanEmail.split('@')[0],
    passwordHash: userData.passwordHash,
    role: userData.role || 'user',
    createdAt: userData.createdAt || now,
    lastLoginAt: userData.lastLoginAt || null
  };

  if (isUsingMongo()) {
    try {
      const created = await UserModel.create(userDoc);
      const res = created.toObject ? created.toObject() : created;
      syncUserToJson(res);
      return res;
    } catch (err) {
      console.warn('[Database] Mongo createUser failed, writing to JSON fallback:', err.message);
    }
  }

  // JSON Fallback
  const users = readJson(USERS_FILE);
  const existing = users.find(u =>
    (cleanEmail && (u.email || '').toLowerCase().trim() === cleanEmail) ||
    (cleanUsername && (u.username || '').toLowerCase().trim() === cleanUsername)
  );

  if (existing) {
    throw new Error('User with this email or username already exists');
  }

  users.push(userDoc);
  writeJson(USERS_FILE, users);
  return { ...userDoc };
}

/**
 * Update user by ID
 */
export async function updateUser(id, update) {
  if (!id || !update) return null;

  let updatedDoc = null;
  if (isUsingMongo()) {
    try {
      updatedDoc = await UserModel.findOneAndUpdate(
        { id },
        { $set: update },
        { new: true }
      ).lean();
    } catch (err) {
      console.warn('[Database] Mongo updateUser error, falling back to JSON:', err.message);
    }
  }

  // Update in JSON
  const users = readJson(USERS_FILE);
  const index = users.findIndex(u => u.id === id);
  if (index !== -1) {
    users[index] = { ...users[index], ...update };
    writeJson(USERS_FILE, users);
    if (!updatedDoc) {
      updatedDoc = { ...users[index] };
    }
  }

  return updatedDoc;
}

/**
 * Get all users
 */
export async function getAllUsers() {
  if (isUsingMongo()) {
    try {
      const users = await UserModel.find({}).lean();
      if (users && users.length > 0) return users;
    } catch (err) {
      console.warn('[Database] Mongo getAllUsers error, falling back to JSON:', err.message);
    }
  }

  return readJson(USERS_FILE);
}

// ==========================================
// CHAT DATABASE METHODS
// ==========================================

/**
 * Find chats for a given user
 */
export async function findChatsByUserId(userId) {
  if (!userId) return [];

  if (isUsingMongo()) {
    try {
      const query = (userId === '*' || userId === 'all') ? {} : { userId };
      const chats = await ChatModel.find(query).sort({ updatedAt: -1 }).lean();
      return chats;
    } catch (err) {
      console.warn('[Database] Mongo findChatsByUserId error, falling back to JSON:', err.message);
    }
  }

  const chats = readJson(CHATS_FILE);
  return chats
    .filter(c => (userId === '*' || userId === 'all' || c.userId === userId))
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
}

// Alias for findChatsByUserId
export const getChats = findChatsByUserId;

/**
 * Save or update a chat document
 */
export async function saveChat(chatData, explicitUserId = null) {
  if (!chatData || typeof chatData !== 'object') {
    throw new Error('userId is required to save chat');
  }

  const effectiveUserId = explicitUserId || chatData.userId || 'guest-session';
  const now = new Date();
  const id = chatData.id || `chat-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  const docToSave = {
    id,
    userId: effectiveUserId,
    title: chatData.title || 'New Chat',
    model: chatData.model || 'auto',
    messages: Array.isArray(chatData.messages) ? chatData.messages : [],
    isPinned: Boolean(chatData.isPinned),
    createdAt: chatData.createdAt ? new Date(chatData.createdAt) : now,
    updatedAt: now
  };

  if (isUsingMongo()) {
    try {
      const saved = await ChatModel.findOneAndUpdate(
        { id },
        {
          $set: {
            title: docToSave.title,
            model: docToSave.model,
            messages: docToSave.messages,
            isPinned: docToSave.isPinned,
            updatedAt: docToSave.updatedAt
          },
          $setOnInsert: {
            id: docToSave.id,
            userId: docToSave.userId,
            createdAt: docToSave.createdAt
          }
        },
        { upsert: true, new: true }
      ).lean();

      syncChatToJson(saved);
      return saved;
    } catch (err) {
      console.warn('[Database] Mongo saveChat error, saving to JSON fallback:', err.message);
    }
  }

  // JSON Fallback
  const chats = readJson(CHATS_FILE);
  const index = chats.findIndex(c => c.id === id);
  if (index !== -1) {
    chats[index] = {
      ...chats[index],
      ...docToSave,
      createdAt: chats[index].createdAt || docToSave.createdAt
    };
  } else {
    chats.unshift(docToSave);
  }

  writeJson(CHATS_FILE, chats);
  return { ...docToSave };
}

/**
 * Get chat by ID
 */
export async function getChatById(id, userId = null) {
  if (!id) return null;

  if (isUsingMongo()) {
    try {
      const query = { id };
      if (userId && userId !== '*' && userId !== 'all') {
        query.userId = userId;
      }
      const chat = await ChatModel.findOne(query).lean();
      if (chat) return chat;
    } catch (err) {
      console.warn('[Database] Mongo getChatById error, falling back to JSON:', err.message);
    }
  }

  const chats = readJson(CHATS_FILE);
  const found = chats.find(c => c.id === id && (!userId || userId === '*' || userId === 'all' || c.userId === userId));
  return found ? { ...found } : null;
}

/**
 * Delete chat by ID
 */
export async function deleteChat(id, userId = null) {
  if (!id) return false;

  let deleted = false;
  if (isUsingMongo()) {
    try {
      const query = { id };
      if (userId && userId !== '*' && userId !== 'all') {
        query.userId = userId;
      }
      const res = await ChatModel.deleteOne(query);
      if (res.deletedCount > 0) deleted = true;
    } catch (err) {
      console.warn('[Database] Mongo deleteChat error, falling back to JSON:', err.message);
    }
  }

  const chats = readJson(CHATS_FILE);
  const filtered = chats.filter(c => {
    if (c.id === id) {
      if (!userId || userId === '*' || userId === 'all' || c.userId === userId) {
        deleted = true;
        return false;
      }
    }
    return true;
  });

  if (filtered.length !== chats.length) {
    writeJson(CHATS_FILE, filtered);
    deleted = true;
  }

  return deleted;
}

/**
 * Rename / update chat title
 */
export async function updateChatTitle(chatId, newTitle, userId = null) {
  if (!chatId || !newTitle) {
    throw new Error('Chat ID and new title are required.');
  }

  const existing = await getChatById(chatId, userId);
  if (!existing) return null;

  existing.title = newTitle.trim();
  existing.updatedAt = new Date();

  return await saveChat(existing, existing.userId);
}

/**
 * Clear all chats for a specific user
 */
export async function clearChats(userId) {
  const normalizedUserId = userId || 'guest-session';
  const chats = readJson(CHATS_FILE);
  const remaining = chats.filter(c => c.userId !== normalizedUserId);
  writeJson(CHATS_FILE, remaining);

  if (isUsingMongo()) {
    try {
      await ChatModel.deleteMany({ userId: normalizedUserId });
    } catch (err) {
      console.warn('[Database] Mongo clearChats error:', err.message);
    }
  }

  return true;
}

/**
 * Internal mirror helpers for hybrid consistency
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

export default {
  connectDB,
  initDb,
  isUsingMongo,
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
  UserModel,
  ChatModel,
  User,
  Chat
};

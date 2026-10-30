import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import mongoose from 'mongoose';

const DATA_DIR = path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SHARES_FILE = path.join(DATA_DIR, 'shares.json');
const DEFAULT_CHAT_LIMIT = 10;

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In-Memory cache of users, shares, and active tokens
let usersCache = new Map();
let sharesCache = new Map();
const tokenStore = new Map(); // token -> userId

// Mongoose Schema for MongoDB Atlas
const userSchema = new mongoose.Schema({
  _id: { type: String }, // e.g. 'usr_bhardwaj'
  id: { type: String, required: true },
  username: { type: String, required: true, index: true },
  name: { type: String },
  email: { type: String },
  passwordHash: { type: String, required: true },
  role: { type: String, default: 'Starter Plan' },
  chatLimit: { type: Number, default: 10 },
  chatsUsed: { type: Number, default: 0 },
  createdAt: { type: String },
  sessions: [
    {
      id: String,
      title: String,
      createdAt: Number,
      updatedAt: Number,
      messages: Array
    }
  ]
}, { timestamps: true });

const shareSchema = new mongoose.Schema({
  _id: { type: String }, // shareId e.g. 'shr_...'
  shareId: { type: String, required: true, index: true },
  sessionId: String,
  title: String,
  messages: Array,
  authorName: String,
  authorId: String,
  createdAt: { type: Number, default: () => Date.now() }
}, { timestamps: true });

const UserModel = mongoose.models.User || mongoose.model('User', userSchema);
const ShareModel = mongoose.models.Share || mongoose.model('Share', shareSchema);
let isMongoConnected = false;

/**
 * Connect to MongoDB Atlas if MONGODB_URI is provided
 */
export async function initDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri || !uri.trim()) {
    console.log('[Database] No MONGODB_URI set. Storing accounts & chat history in local data/users.json.');
    return;
  }
  try {
    await mongoose.connect(uri.trim(), { serverSelectionTimeoutMS: 6000 });
    isMongoConnected = true;
    console.log('[Database] Connected to MongoDB Atlas successfully!');

    // If MongoDB collection is empty, automatically migrate existing users.json data
    const count = await UserModel.countDocuments();
    if (count === 0) {
      console.log('[Database] MongoDB is fresh. Migrating existing local accounts and chat history to cloud...');
      for (const [k, u] of usersCache.entries()) {
        await UserModel.findByIdAndUpdate(k, { ...u, _id: k }, { upsert: true });
      }
      console.log('[Database] Migration to MongoDB Atlas complete!');
    } else {
      // Sync from MongoDB into in-memory cache
      const docs = await UserModel.find().lean();
      for (const d of docs) {
        usersCache.set(d._id || d.id, d);
      }
      console.log(`[Database] Loaded ${docs.length} user accounts with full chat histories from MongoDB Atlas.`);
    }

    // Sync shares collection with MongoDB Atlas
    try {
      const shareDocs = await ShareModel.find().lean();
      for (const s of shareDocs) {
        sharesCache.set(s._id || s.shareId, s);
      }
      if (shareDocs.length > 0) {
        console.log(`[Database] Loaded ${shareDocs.length} shared conversations from MongoDB Atlas.`);
      }
    } catch (sErr) {
      console.warn('[Database] Error loading shares from MongoDB:', sErr.message);
    }
  } catch (err) {
    isMongoConnected = false;
    console.warn(`[Database] Could not connect to MongoDB Atlas (${err.message}). Continuing with local data/users.json.`);
  }
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + '_salt_capstone_2026').digest('hex');
}

/**
 * Seed initial accounts if users.json does not exist or is empty
 */
function getInitialSeedUsers() {
  const bhardwajId = 'usr_bhardwaj';
  const tejaId = 'usr_teja';
  const praneethaId = 'usr_praneetha';
  const dharaniId = 'usr_dharani';

  return {
    [bhardwajId]: {
      id: bhardwajId,
      username: 'bhardwaj',
      name: 'Bhardwaj',
      email: 'bhardwaj@evident.ai',
      passwordHash: hashPassword('password123'),
      role: 'Ultra Pro Plan',
      chatLimit: 100,
      chatsUsed: 0,
      createdAt: new Date().toISOString(),
      sessions: []
    },
    [tejaId]: {
      id: tejaId,
      username: 'teja',
      name: 'Teja',
      email: 'teja@evident.ai',
      passwordHash: hashPassword('password123'),
      role: 'Pro Plan',
      chatLimit: 50,
      chatsUsed: 0,
      createdAt: new Date().toISOString(),
      sessions: []
    },
    [praneethaId]: {
      id: praneethaId,
      username: 'praneetha',
      name: 'Praneetha',
      email: 'praneetha@evident.ai',
      passwordHash: hashPassword('password123'),
      role: 'Plus Plan',
      chatLimit: 25,
      chatsUsed: 0,
      createdAt: new Date().toISOString(),
      sessions: []
    },
    [dharaniId]: {
      id: dharaniId,
      username: 'dharani',
      name: 'Dharani',
      email: 'dharani@evident.ai',
      passwordHash: hashPassword('password123'),
      role: 'Starter Plan',
      chatLimit: 10,
      chatsUsed: 0,
      createdAt: new Date().toISOString(),
      sessions: []
    }
  };
}

/**
 * Load users from disk into cache
 */
function loadUsersFromDisk() {
  try {
    const seed = getInitialSeedUsers();
    if (fs.existsSync(USERS_FILE)) {
      const raw = fs.readFileSync(USERS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      usersCache = new Map(Object.entries(parsed));

      let updated = false;
      // Ensure all 4 accounts exist and update plan/chatLimit to latest
      for (const [k, v] of Object.entries(seed)) {
        if (!usersCache.has(k)) {
          usersCache.set(k, v);
          updated = true;
        } else {
          const existing = usersCache.get(k);
          if (existing.role !== v.role || existing.chatLimit !== v.chatLimit) {
            existing.role = v.role;
            existing.chatLimit = v.chatLimit;
            usersCache.set(k, existing);
            updated = true;
          }
        }
      }
      // Clean up any old obsolete accounts outside the 4
      for (const k of Array.from(usersCache.keys())) {
        if (!seed[k]) {
          usersCache.delete(k);
          updated = true;
        }
      }
      if (updated) {
        saveUsersToDisk();
      }
    } else {
      usersCache = new Map(Object.entries(seed));
      saveUsersToDisk();
    }
  } catch (err) {
    console.error('Error loading users.json:', err);
    const seed = getInitialSeedUsers();
    usersCache = new Map(Object.entries(seed));
    saveUsersToDisk();
  }
}

/**
 * Save users cache to disk
 */
function saveUsersToDisk() {
  try {
    const obj = Object.fromEntries(usersCache);
    fs.writeFileSync(USERS_FILE, JSON.stringify(obj, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing users.json:', err);
  }

  // Two-way sync to MongoDB Atlas when connected
  if (isMongoConnected) {
    (async () => {
      try {
        for (const [k, u] of usersCache.entries()) {
          await UserModel.findByIdAndUpdate(k, { ...u, _id: k }, { upsert: true });
        }
      } catch (mErr) {
        console.warn('[Database] Error syncing users to MongoDB Atlas:', mErr.message);
      }
    })();
  }
}

/**
 * Load shared conversations from disk
 */
function loadSharesFromDisk() {
  try {
    if (fs.existsSync(SHARES_FILE)) {
      const raw = fs.readFileSync(SHARES_FILE, 'utf-8');
      const obj = JSON.parse(raw);
      sharesCache = new Map(Object.entries(obj));
    } else {
      sharesCache = new Map();
      saveSharesToDisk();
    }
  } catch (err) {
    console.error('Error loading shares.json:', err);
    sharesCache = new Map();
  }
}

/**
 * Save shares cache to disk
 */
function saveSharesToDisk() {
  try {
    const obj = Object.fromEntries(sharesCache);
    fs.writeFileSync(SHARES_FILE, JSON.stringify(obj, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing shares.json:', err);
  }

  if (isMongoConnected) {
    (async () => {
      try {
        for (const [k, s] of sharesCache.entries()) {
          await ShareModel.findByIdAndUpdate(k, { ...s, _id: k }, { upsert: true });
        }
      } catch (mErr) {
        console.warn('[Database] Error syncing shares to MongoDB Atlas:', mErr.message);
      }
    })();
  }
}

// Initial load
loadUsersFromDisk();
loadSharesFromDisk();

/**
 * Format public safe user profile
 */
export function sanitizeUser(user) {
  if (!user) return null;
  const chatsUsed = user.chatsUsed || 0;
  const chatLimit = user.chatLimit || DEFAULT_CHAT_LIMIT;
  const remainingChats = Math.max(0, chatLimit - chatsUsed);

  return {
    id: user.id,
    username: user.username,
    name: user.name || user.username,
    email: user.email || '',
    role: user.role || 'User',
    chatLimit,
    chatsUsed,
    remainingChats,
    isQuotaExhausted: remainingChats <= 0
  };
}

/**
 * Authenticate username & password
 */
export function authenticateUser(username, password) {
  const cleanUsername = String(username || '').trim().toLowerCase();
  for (const user of usersCache.values()) {
    if (user.username.toLowerCase() === cleanUsername || (user.email && user.email.toLowerCase() === cleanUsername)) {
      const expectedHash = hashPassword(password);
      if (user.passwordHash === expectedHash) {
        const token = crypto.randomBytes(24).toString('hex');
        tokenStore.set(token, user.id);
        return { user: sanitizeUser(user), token };
      }
      throw new Error('Incorrect password. Please try again.');
    }
  }
  throw new Error(`Account "${username}" not found. Choose a plan demo account below or create an account.`);
}

/**
 * Register a new user
 */
export function registerUser(username, password, name, email) {
  const cleanUsername = String(username || '').trim().toLowerCase();
  if (!cleanUsername || cleanUsername.length < 2) {
    throw new Error('Username must be at least 2 characters long.');
  }
  if (!password || password.length < 4) {
    throw new Error('Password must be at least 4 characters long.');
  }

  for (const u of usersCache.values()) {
    if (u.username.toLowerCase() === cleanUsername) {
      throw new Error(`Username "${username}" is already taken.`);
    }
  }

  const userId = `usr_${cleanUsername}_${Date.now().toString(36)}`;
  const newUser = {
    id: userId,
    username: cleanUsername,
    name: name?.trim() || cleanUsername,
    email: email?.trim() || `${cleanUsername}@demo.edu`,
    passwordHash: hashPassword(password),
    role: 'Member',
    chatLimit: DEFAULT_CHAT_LIMIT,
    chatsUsed: 0,
    createdAt: new Date().toISOString(),
    sessions: []
  };

  usersCache.set(userId, newUser);
  saveUsersToDisk();

  const token = crypto.randomBytes(24).toString('hex');
  tokenStore.set(token, userId);
  return { user: sanitizeUser(newUser), token };
}

/**
 * Get user by token or user ID
 */
export function getUserByTokenOrId(identifier) {
  if (!identifier) return null;
  const userId = tokenStore.get(identifier) || identifier;
  const user = usersCache.get(userId);
  if (user) return user;

  // Search by username if string
  for (const u of usersCache.values()) {
    if (u.username.toLowerCase() === String(identifier).toLowerCase() || u.id === identifier) {
      return u;
    }
  }
  return null;
}

/**
 * Check and increment chat limit for account
 */
export function checkAndConsumeChatQuota(identifier) {
  const user = getUserByTokenOrId(identifier);
  if (!user) {
    // If no user found, fallback to Alice for demo continuity
    const fallback = usersCache.get('usr_alice') || Array.from(usersCache.values())[0];
    if (fallback) return checkAndConsumeChatQuota(fallback.id);
    return { allowed: true, remaining: 10, limit: 10, used: 0 };
  }

  const limit = user.chatLimit || DEFAULT_CHAT_LIMIT;
  const used = user.chatsUsed || 0;

  if (used >= limit) {
    return {
      allowed: false,
      remaining: 0,
      limit,
      used,
      error: `Chat limit reached (${used}/${limit} messages used). Please reset your quota or switch accounts to continue chatting.`
    };
  }

  user.chatsUsed = used + 1;
  saveUsersToDisk();

  return {
    allowed: true,
    remaining: Math.max(0, limit - user.chatsUsed),
    limit,
    used: user.chatsUsed
  };
}

/**
 * Reset quota for account (for testing & demo purposes)
 */
export function resetUserQuota(identifier) {
  const user = getUserByTokenOrId(identifier);
  if (!user) throw new Error('User not found.');
  user.chatsUsed = 0;
  saveUsersToDisk();
  return sanitizeUser(user);
}

/**
 * Get all conversations for a user
 */
export function getUserSessions(identifier) {
  const user = getUserByTokenOrId(identifier);
  if (!user) return [];

  const sessions = user.sessions || [];
  return sessions.map(s => ({
    id: s.id,
    title: s.title || 'Untitled Conversation',
    createdAt: s.createdAt || Date.now(),
    updatedAt: s.updatedAt || Date.now(),
    messageCount: Array.isArray(s.messages) ? s.messages.length : 0
  })).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

/**
 * Get messages of a specific session for a user
 */
export function getSessionDetails(identifier, sessionId) {
  const user = getUserByTokenOrId(identifier);
  if (!user) return null;

  const session = (user.sessions || []).find(s => s.id === sessionId);
  if (!session) return null;
  return session;
}

/**
 * Save or update a session with messages for a user
 */
export function saveUserSession(identifier, sessionData) {
  const user = getUserByTokenOrId(identifier);
  if (!user) throw new Error('User not found.');

  if (!user.sessions) user.sessions = [];

  const sessionId = sessionData.id || `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const title = sessionData.title || (sessionData.messages?.[0]?.content?.slice(0, 32) + '...') || 'New Conversation';

  const existingIdx = user.sessions.findIndex(s => s.id === sessionId);
  const now = Date.now();

  const sessionRecord = {
    id: sessionId,
    title,
    createdAt: existingIdx >= 0 ? user.sessions[existingIdx].createdAt : now,
    updatedAt: now,
    messages: sessionData.messages || []
  };

  if (existingIdx >= 0) {
    user.sessions[existingIdx] = sessionRecord;
  } else {
    user.sessions.unshift(sessionRecord);
  }

  saveUsersToDisk();
  return sessionRecord;
}

/**
 * Delete a specific session for a user
 */
export function deleteUserSession(identifier, sessionId) {
  const user = getUserByTokenOrId(identifier);
  if (!user) return false;

  const initLen = user.sessions?.length || 0;
  user.sessions = (user.sessions || []).filter(s => s.id !== sessionId);
  if (user.sessions.length !== initLen) {
    saveUsersToDisk();
    return true;
  }
  return false;
}

/**
 * List all demo accounts for fast switcher UI
 */
export function getDemoAccounts() {
  const list = [];
  for (const u of usersCache.values()) {
    list.push(sanitizeUser(u));
  }
  return list;
}

/**
 * Create a public shareable snapshot of a conversation
 */
export async function createShareSession({ sessionId, title, messages, authorName, authorId }) {
  const shareId = `shr_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const record = {
    shareId,
    sessionId: sessionId || '',
    title: title || 'Shared Conversation',
    messages: JSON.parse(JSON.stringify(messages || [])),
    authorName: authorName || 'EvidentAI User',
    authorId: authorId || '',
    createdAt: Date.now()
  };

  sharesCache.set(shareId, record);
  saveSharesToDisk();

  if (isMongoConnected) {
    try {
      await ShareModel.findByIdAndUpdate(shareId, { ...record, _id: shareId }, { upsert: true });
    } catch (e) {
      console.warn('[Database] Error saving share to MongoDB:', e.message);
    }
  }

  return record;
}

/**
 * Get details of a shared conversation
 */
export async function getShareSession(shareId) {
  if (!shareId) return null;
  if (sharesCache.has(shareId)) {
    return sharesCache.get(shareId);
  }
  if (isMongoConnected) {
    try {
      const doc = await ShareModel.findById(shareId).lean();
      if (doc) {
        sharesCache.set(shareId, doc);
        return doc;
      }
    } catch (e) {
      console.warn('[Database] Error querying share from MongoDB:', e.message);
    }
  }
  return null;
}

/**
 * Fork/Clone a shared conversation into a recipient's user account so they can continue chatting
 */
export async function forkShareSession(shareId, targetUserId) {
  const share = await getShareSession(shareId);
  if (!share) {
    throw new Error('Shared conversation not found or expired.');
  }

  const targetUser = getUserByTokenOrId(targetUserId);
  if (!targetUser) {
    throw new Error('Target user account not found.');
  }

  const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const clonedSession = saveUserSession(targetUser.id, {
    id: newSessionId,
    title: share.title || 'Shared Conversation',
    messages: JSON.parse(JSON.stringify(share.messages || []))
  });

  return {
    session: clonedSession,
    authorName: share.authorName || 'EvidentAI User'
  };
}

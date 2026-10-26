import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DATA_DIR = path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const DEFAULT_CHAT_LIMIT = 10;

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In-Memory cache of users and active tokens
let usersCache = new Map();
const tokenStore = new Map(); // token -> userId

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + '_salt_capstone_2026').digest('hex');
}

/**
 * Seed initial accounts if users.json does not exist or is empty
 */
function getInitialSeedUsers() {
  const aliceId = 'usr_alice';
  const bobId = 'usr_bob';

  return {
    [aliceId]: {
      id: aliceId,
      username: 'alice',
      name: 'Alice Smith',
      email: 'alice@student.demo',
      passwordHash: hashPassword('password123'),
      role: 'Student',
      chatLimit: DEFAULT_CHAT_LIMIT,
      chatsUsed: 1,
      createdAt: new Date().toISOString(),
      sessions: [
        {
          id: 'session_alice_demo_1',
          title: 'ScienceQA Photosynthesis Diagram',
          createdAt: Date.now() - 3600000,
          updatedAt: Date.now() - 3600000,
          messages: [
            {
              role: 'user',
              content: 'What process is illustrated in this plant biology diagram?'
            },
            {
              role: 'assistant',
              content: '**Correct Answer:** Photosynthesis\n\n**Notes:** The diagram depicts light energy, carbon dioxide, and water being converted into glucose and oxygen in the chloroplasts.'
            }
          ]
        }
      ]
    },
    [bobId]: {
      id: bobId,
      username: 'bob',
      name: 'Bob Johnson',
      email: 'bob@researcher.demo',
      passwordHash: hashPassword('password123'),
      role: 'Researcher',
      chatLimit: DEFAULT_CHAT_LIMIT,
      chatsUsed: 2,
      createdAt: new Date().toISOString(),
      sessions: [
        {
          id: 'session_bob_demo_1',
          title: 'ChartQA Revenue Comparison Q3',
          createdAt: Date.now() - 7200000,
          updatedAt: Date.now() - 7200000,
          messages: [
            {
              role: 'user',
              content: 'Compare the revenue figures between North America and Europe in 2023.'
            },
            {
              role: 'assistant',
              content: '**Correct Answer:** North America exceeded Europe by $14.2M.\n\n**Step-by-Step Calculation:**\n1. North America: $58.4M\n2. Europe: $44.2M\n3. Difference: $58.4M - $44.2M = $14.2M.'
            }
          ]
        }
      ]
    }
  };
}

/**
 * Load users from disk into cache
 */
function loadUsersFromDisk() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const raw = fs.readFileSync(USERS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      usersCache = new Map(Object.entries(parsed));
    } else {
      const seed = getInitialSeedUsers();
      usersCache = new Map(Object.entries(seed));
      saveUsersToDisk();
    }
  } catch (err) {
    console.error('Error loading users.json:', err);
    const seed = getInitialSeedUsers();
    usersCache = new Map(Object.entries(seed));
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
}

// Initial load
loadUsersFromDisk();

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
    if (user.username.toLowerCase() === cleanUsername) {
      const expectedHash = hashPassword(password);
      if (user.passwordHash === expectedHash) {
        const token = crypto.randomBytes(24).toString('hex');
        tokenStore.set(token, user.id);
        return { user: sanitizeUser(user), token };
      }
      throw new Error('Incorrect password. Please try again.');
    }
  }
  throw new Error(`User "${username}" not found.`);
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

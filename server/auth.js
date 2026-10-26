import express from 'express';
import {
  authenticateUser,
  registerUser,
  getUserByTokenOrId,
  sanitizeUser,
  resetUserQuota,
  getUserSessions,
  getSessionDetails,
  saveUserSession,
  deleteUserSession,
  getDemoAccounts
} from './userStore.js';

export const authRouter = express.Router();

// Helper to extract user identity from headers
export function extractAuthUser(req) {
  const authHeader = req.headers['authorization'];
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }
  const customUserId = req.headers['x-user-id'];
  const identifier = token || customUserId;

  return getUserByTokenOrId(identifier);
}

// 1. GET /api/auth/demo-accounts
authRouter.get('/demo-accounts', (req, res) => {
  try {
    const list = getDemoAccounts();
    res.json({ success: true, accounts: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. POST /api/auth/login
authRouter.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username) {
      return res.status(400).json({ success: false, error: "Username is required." });
    }
    const result = authenticateUser(username, password || 'password123');
    res.json({ success: true, user: result.user, token: result.token });
  } catch (err) {
    res.status(401).json({ success: false, error: err.message });
  }
});

// 3. POST /api/auth/register
authRouter.post('/register', (req, res) => {
  try {
    const { username, password, name, email } = req.body;
    const result = registerUser(username, password, name, email);
    res.json({ success: true, user: result.user, token: result.token });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 4. GET /api/auth/me
authRouter.get('/me', (req, res) => {
  const user = extractAuthUser(req);
  if (!user) {
    return res.status(401).json({ success: false, error: "Not authenticated. Please log in." });
  }
  res.json({ success: true, user: sanitizeUser(user) });
});

// 5. POST /api/auth/reset-quota
authRouter.post('/reset-quota', (req, res) => {
  const user = extractAuthUser(req);
  if (!user) {
    return res.status(401).json({ success: false, error: "Not authenticated." });
  }
  try {
    const updated = resetUserQuota(user.id);
    res.json({ success: true, user: updated, message: "Chat quota reset to maximum (10 chats)." });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. GET /api/auth/history
authRouter.get('/history', (req, res) => {
  const user = extractAuthUser(req);
  if (!user) {
    return res.status(401).json({ success: false, error: "Please log in to view conversation history." });
  }
  const sessions = getUserSessions(user.id);
  res.json({ success: true, sessions, userId: user.id, username: user.username });
});

// 7. GET /api/auth/history/:sessionId
authRouter.get('/history/:sessionId', (req, res) => {
  const user = extractAuthUser(req);
  if (!user) {
    return res.status(401).json({ success: false, error: "Please log in." });
  }
  const details = getSessionDetails(user.id, req.params.sessionId);
  if (!details) {
    return res.status(404).json({ success: false, error: "Conversation not found." });
  }
  res.json({ success: true, session: details });
});

// 8. POST /api/auth/history/save
authRouter.post('/history/save', (req, res) => {
  const user = extractAuthUser(req);
  if (!user) {
    return res.status(401).json({ success: false, error: "Please log in to save history." });
  }
  try {
    const { sessionId, title, messages } = req.body;
    const saved = saveUserSession(user.id, { id: sessionId, title, messages });
    res.json({ success: true, session: saved });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9. DELETE /api/auth/history/:sessionId
authRouter.delete('/history/:sessionId', (req, res) => {
  const user = extractAuthUser(req);
  if (!user) {
    return res.status(401).json({ success: false, error: "Please log in." });
  }
  const ok = deleteUserSession(user.id, req.params.sessionId);
  res.json({ success: ok, message: ok ? "Conversation deleted." : "Conversation not found." });
});

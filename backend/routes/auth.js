// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getPgClient } = require('../db/sqlite');
const pgPool = getPgClient();
const authMiddleware = require('../middleware/auth');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

// ── Rate Limiting ────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5, // 5 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth requests. Please wait 1 minute.' },
});

// ── JWT Constants ─────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 12;

const isProd = process.env.NODE_ENV === 'production';

// ── Avatar URL validation ─────────────────────────────────────────────────
const AVATAR_URL_REGEX = /^https?:\/\/[^\s<>"{}|\\^`[\]]+$/;
const DEFAULT_AVATAR = 'default_avatar.svg';

function validateAvatarUrl(url) {
  if (!url || url === DEFAULT_AVATAR) return DEFAULT_AVATAR;
  if (url.includes('..') || url.includes('\0')) return DEFAULT_AVATAR;
  if (!AVATAR_URL_REGEX.test(url)) return DEFAULT_AVATAR;
  return url;
}

// ── Helper: Fetch full user profile ────────────────────────────────────────
async function getUserFullProfile(userId) {
  const userQuery = `
    SELECT 
      u.id, u.username, u.avatar_url, u.created_at, u.last_login,
      r.rating_vs_ai, r.rating_vs_human, r.peak_rating_vs_ai, r.peak_rating_vs_human,
      s.total_games, s.wins, s.losses, s.draws, s.avg_accuracy, s.best_win_streak, s.current_win_streak
    FROM users u
    JOIN elo_ratings r ON u.id = r.user_id
    JOIN user_stats_summary s ON u.id = s.user_id
    WHERE u.id = $1
  `;
  const result = await pgPool.query(userQuery, [userId]);
  if (result.rows.length === 0) return null;

  const row = result.rows[0];

  const prefResult = await pgPool.query('SELECT * FROM user_preferences WHERE user_id = $1', [userId]);
  let preferences = {
    boardTheme: 'blue',
    pieceStyle: 'neo',
    soundEnabled: true,
    moveHints: true,
    autoFlip: false
  };

  if (prefResult.rows.length > 0) {
    const p = prefResult.rows[0];
    preferences = {
      boardTheme: p.board_theme,
      pieceStyle: p.piece_style,
      soundEnabled: p.sound_enabled === 1,
      moveHints: p.move_hints === 1,
      autoFlip: p.auto_flip === 1
    };
  } else {
    await pgPool.query('INSERT INTO user_preferences (user_id) VALUES ($1)', [userId]);
  }

  return {
    id: row.id,
    username: row.username,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
    lastLogin: row.last_login,
    ratings: {
      vsAI: row.rating_vs_ai,
      vsHuman: row.rating_vs_human,
      peakVsAI: row.peak_rating_vs_ai,
      peakVsHuman: row.peak_rating_vs_human
    },
    stats: {
      totalGames: row.total_games,
      wins: row.wins,
      losses: row.losses,
      draws: row.draws,
      avgAccuracy: parseFloat(row.avg_accuracy),
      bestWinStreak: row.best_win_streak,
      currentWinStreak: row.current_win_streak
    },
    preferences
  };
}

function setAuthCookies(res, token, rememberMe = false) {
  const cookieOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax'
  };
  if (rememberMe) {
    cookieOptions.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
  }
  res.cookie('kg_access_token', token, cookieOptions);
}

// ── GET /api/auth/check-username ──────────────────────────────────────────
router.get('/check-username', async (req, res) => {
  const { username } = req.query;
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }
  try {
    const existingUser = await pgPool.query('SELECT id FROM users WHERE LOWER(username) = LOWER($1)', [username]);
    res.json({ available: existingUser.rows.length === 0 });
  } catch (err) {
    console.error('Check Username Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/auth/register ───────────────────────────────────────────────
router.post('/register', authLimiter, async (req, res) => {
  const { username, password, avatarUrl } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  
  if (username.length < 3 || username.length > 15) {
    return res.status(400).json({ error: 'Username must be between 3 and 15 characters' });
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return res.status(400).json({ error: 'Username can only contain letters, numbers, underscores, and hyphens' });
  }

  // Strict Password Validation
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (!/[A-Z]/.test(password)) return res.status(400).json({ error: 'Password must contain at least one uppercase letter' });
  if (!/[a-z]/.test(password)) return res.status(400).json({ error: 'Password must contain at least one lowercase letter' });
  if (!/[0-9]/.test(password)) return res.status(400).json({ error: 'Password must contain at least one number' });
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return res.status(400).json({ error: 'Password must contain at least one special character' });

  const safeAvatarUrl = validateAvatarUrl(avatarUrl);
  const pgClient = pgPool;

  try {
    const existingUser = await pgClient.query('SELECT id FROM users WHERE LOWER(username) = LOWER($1)', [username]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Username is already taken' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    await pgClient.query('BEGIN');

    const newUserId = crypto.randomUUID();
    const insertUserSql = `
      INSERT INTO users (id, username, password_hash, avatar_url)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `;
    const userResult = await pgClient.query(insertUserSql, [newUserId, username, passwordHash, safeAvatarUrl]);
    const userId = userResult.rows[0].id;

    await pgClient.query('INSERT INTO elo_ratings (user_id) VALUES ($1)', [userId]);
    await pgClient.query('INSERT INTO user_stats_summary (user_id) VALUES ($1)', [userId]);
    await pgClient.query('INSERT INTO user_preferences (user_id) VALUES ($1)', [userId]);

    await pgClient.query('COMMIT');

    const expiresIn = '7d';
    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn });
    setAuthCookies(res, token, false);

    const userProfile = await getUserFullProfile(userId);

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      user: userProfile
    });

  } catch (err) {
    await pgClient.query('ROLLBACK');
    console.error('Registration Error:', err);
    res.status(500).json({ error: 'Internal server error during registration' });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────
router.post('/login', authLimiter, async (req, res) => {
  const { username, password, rememberMe } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const result = await pgPool.query(
      'SELECT id, password_hash FROM users WHERE LOWER(username) = LOWER($1) AND is_active = 1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Incorrect username or password' });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ error: 'Incorrect username or password' });
    }

    await pgPool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

    const expiresIn = rememberMe ? '30d' : '7d';
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn });
    setAuthCookies(res, token, rememberMe);

    const userProfile = await getUserFullProfile(user.id);

    res.json({
      message: 'Login successful',
      token,
      user: userProfile
    });

  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ error: 'Internal server error during login' });
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  res.clearCookie('kg_access_token', {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax'
  });
  res.json({ success: true, message: 'Logged out successfully' });
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const userProfile = await getUserFullProfile(req.user.id);

    if (!userProfile) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: userProfile });
  } catch (err) {
    console.error('Fetch Profile Error:', err);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// ── POST /api/auth/refresh ────────────────────────────────────────────────
router.post('/refresh', authMiddleware, async (req, res) => {
  try {
    const token = jwt.sign({ userId: req.user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    setAuthCookies(res, token);
    res.json({ success: true, message: 'Token refreshed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

// ── PUT /api/auth/avatar ──────────────────────────────────────────────────
router.put('/avatar', authMiddleware, async (req, res) => {
  const { avatarUrl } = req.body;
  if (!avatarUrl) {
    return res.status(400).json({ error: 'avatarUrl is required' });
  }
  const safeAvatarUrl = validateAvatarUrl(avatarUrl);
  try {
    await pgPool.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [safeAvatarUrl, req.user.id]);
    res.json({ success: true, avatarUrl: safeAvatarUrl });
  } catch (err) {
    console.error('Update Avatar Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

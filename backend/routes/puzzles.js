// backend/routes/puzzles.js
const express = require('express');
const router = express.Router();
const { getPgClient } = require('../db/sqlite');
const authMiddleware = require('../middleware/auth');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// GET /api/puzzles - List all puzzles (ordered by rating)
router.get('/', async (req, res) => {
  const client = getPgClient();
  let userId = null;

  // Extract optional JWT token
  let token = req.cookies && req.cookies.kg_access_token;
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_jwt_signkey_production');
      userId = decoded.userId || decoded.id;
    } catch (err) {
      // Ignore invalid token to fallback to guest behavior
    }
  }

  try {
    let result;
    if (userId) {
      result = await client.query(`
        SELECT p.id, p.rating, p.themes, COALESCE(up.solved, 0) AS solved
        FROM puzzles p
        LEFT JOIN user_puzzles up ON p.id = up.puzzle_id AND up.user_id = $1
        ORDER BY p.rating ASC
      `, [userId]);
    } else {
      result = await client.query('SELECT id, rating, themes, 0 AS solved FROM puzzles ORDER BY rating ASC');
    }
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/puzzles/daily
router.get('/daily', async (req, res) => {
  const client = getPgClient();
  try {
    // For simplicity, just return the first puzzle as daily
    const result = await client.query('SELECT * FROM puzzles ORDER BY id LIMIT 1');
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No puzzles available' });
    }
    const puzzle = result.rows[0];
    if (typeof puzzle.moves === 'string') {
      try { puzzle.moves = JSON.parse(puzzle.moves); } catch (e) {}
    }
    if (typeof puzzle.themes === 'string') {
      try { puzzle.themes = JSON.parse(puzzle.themes); } catch (e) {}
    }
    res.json(puzzle);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/puzzles/random
router.get('/random', async (req, res) => {
  const client = getPgClient();
  const targetRating = parseInt(req.query.rating) || 1500;
  try {
    let result = await client.query('SELECT * FROM puzzles WHERE rating >= $1 AND rating <= $2 ORDER BY RANDOM() LIMIT 1', [targetRating - 200, targetRating + 200]);
    if (result.rows.length === 0) {
      result = await client.query('SELECT * FROM puzzles ORDER BY RANDOM() LIMIT 1');
    }
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No puzzles available' });
    }
    const puzzle = result.rows[0];
    if (typeof puzzle.moves === 'string') {
      try { puzzle.moves = JSON.parse(puzzle.moves); } catch (e) {}
    }
    if (typeof puzzle.themes === 'string') {
      try { puzzle.themes = JSON.parse(puzzle.themes); } catch (e) {}
    }
    res.json(puzzle);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/puzzles/:id - Fetch details of a specific puzzle
router.get('/:id', async (req, res) => {
  const client = getPgClient();
  try {
    const result = await client.query('SELECT * FROM puzzles WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Puzzle not found' });
    }
    const puzzle = result.rows[0];
    if (typeof puzzle.moves === 'string') {
      try { puzzle.moves = JSON.parse(puzzle.moves); } catch (e) {}
    }
    if (typeof puzzle.themes === 'string') {
      try { puzzle.themes = JSON.parse(puzzle.themes); } catch (e) {}
    }
    res.json(puzzle);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/puzzles/:id/attempt
// We use authentication here because it records the user's progress
router.post('/:id/attempt', authMiddleware, async (req, res) => {
  const client = getPgClient();
  const puzzleId = req.params.id;
  const { solved, time_taken } = req.body;
  const userId = req.user.id;

  try {
    const pRes = await client.query('SELECT rating FROM puzzles WHERE id = $1', [puzzleId]);
    if (pRes.rows.length === 0) {
      return res.status(404).json({ error: 'Puzzle not found' });
    }
    const puzzleRating = pRes.rows[0].rating;

    let userRating = 1500;
    const urRes = await client.query('SELECT puzzle_rating FROM elo_ratings WHERE user_id = $1', [userId]);
    if (urRes.rows.length > 0) {
      userRating = urRes.rows[0].puzzle_rating;
    } else {
      await client.query('INSERT INTO elo_ratings (user_id, puzzle_rating) VALUES ($1, 1500) ON CONFLICT(user_id) DO NOTHING', [userId]);
    }

    const expectedScore = 1 / (1 + Math.pow(10, (puzzleRating - userRating) / 400));
    const actualScore = solved === true ? 1 : 0;
    const ratingChange = Math.round(32 * (actualScore - expectedScore));
    const newRating = Math.max(100, userRating + ratingChange);

    await client.query('UPDATE elo_ratings SET puzzle_rating = $1 WHERE user_id = $2', [newRating, userId]);

    // Insert or update attempt
    const attemptId = crypto.randomUUID();
    await client.query(`
      INSERT INTO user_puzzles (id, user_id, puzzle_id, solved, time_taken)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id, puzzle_id) 
      DO UPDATE SET 
        solved = EXCLUDED.solved, 
        attempts = user_puzzles.attempts + 1,
        time_taken = EXCLUDED.time_taken
    `, [attemptId, userId, puzzleId, solved === true ? 1 : 0, time_taken || 0]);

    res.json({ success: true, newRating, ratingChange });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

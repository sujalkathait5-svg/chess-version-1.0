// backend/routes/leaderboard.js
const express = require('express');
const router = express.Router();
const { getPgClient } = require('../db/sqlite');
const pgPool = getPgClient();

// GET /api/leaderboard — Fetch active players leaderboard sorted by Elo rating
router.get('/', async (req, res) => {
  try {
    const leaderboardQuery = `
      SELECT rank, user_id, username, avatar_url, rating, peak_rating, total_games, win_rate
      FROM m_leaderboard
      ORDER BY rank ASC
      LIMIT 100
    `;
    const result = await pgPool.query(leaderboardQuery);
    res.json({ success: true, leaderboard: result.rows });
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard rankings' });
  }
});

// Setup background concurrent refresh every 5 minutes (300,000 ms)
// SQLite standard views are dynamic and always up-to-date, so refreshing is a no-op.
setInterval(async () => {
  try {
    // If we were on PostgreSQL, we would run: await pgPool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY m_leaderboard');
  } catch (err) {
    console.error('Leaderboard view refresh failed:', err.message);
  }
}, 300000);

module.exports = router;

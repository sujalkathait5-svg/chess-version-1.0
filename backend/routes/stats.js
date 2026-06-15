// backend/routes/stats.js
const express = require('express');
const router = express.Router();
const { getPgClient } = require('../db/sqlite');

// GET /api/stats/:userId
router.get('/:userId', async (req, res) => {
  const client = getPgClient();
  const userId = req.params.userId;

  try {
    // 1. Fetch user rating
    const userRes = await client.query('SELECT rating_vs_human as rating FROM elo_ratings WHERE user_id = $1', [userId]);
    let rating = 1500;
    if (userRes.rows.length > 0) {
      rating = userRes.rows[0].rating;
    }

    // 2. Fetch game history & W/L ratio
    const gamesRes = await client.query(`
      SELECT 
        g.id, g.result, g.created_at, g.white_id, g.black_id,
        wu.username as white_username,
        bu.username as black_username
      FROM games g
      LEFT JOIN users wu ON g.white_id = wu.id
      LEFT JOIN users bu ON g.black_id = bu.id
      WHERE g.white_id = $1 OR g.black_id = $1
      ORDER BY g.created_at DESC
      LIMIT 20
    `, [userId]);

    const games = gamesRes.rows.map(g => {
      const getPlayerName = (id, username) => {
        if (!id) return 'Guest Player';
        if (id.startsWith('stockfish_level_')) {
          return `Stockfish Lvl ${id.replace('stockfish_level_', '')}`;
        }
        return username || 'Guest Player';
      };

      return {
        id: g.id,
        result: g.result,
        created_at: g.created_at,
        white_id: g.white_id,
        white_username: getPlayerName(g.white_id, g.white_username),
        black_id: g.black_id,
        black_username: getPlayerName(g.black_id, g.black_username),
      };
    });

    let wins = 0;
    let losses = 0;
    let draws = 0;

    for (const g of games) {
      const isWhite = g.white_id === userId;
      if (g.result === 'draw') draws++;
      else if (isWhite && g.result === 'white_win') wins++;
      else if (!isWhite && g.result === 'black_win') wins++;
      else losses++;
    }

    res.json({
      rating,
      stats: { wins, losses, draws, total: games.length },
      recentGames: games
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stats/:userId/puzzles
router.get('/:userId/puzzles', async (req, res) => {
  const client = getPgClient();
  const userId = req.params.userId;

  try {
    const pRes = await client.query(`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN solved THEN 1 ELSE 0 END) as solved
      FROM user_puzzles
      WHERE user_id = $1
    `, [userId]);

    const total = parseInt(pRes.rows[0].total) || 0;
    const solved = parseInt(pRes.rows[0].solved) || 0;

    res.json({
      totalAttempted: total,
      totalSolved: solved,
      successRate: total > 0 ? Math.round((solved / total) * 100) : 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

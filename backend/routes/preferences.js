// backend/routes/preferences.js
const express = require('express');
const router = express.Router();
const { getPgClient } = require('../db/sqlite');
const authMiddleware = require('../middleware/auth');

// GET /api/preferences — Fetch preferences for active user
router.get('/', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const client = getPgClient();
  try {
    const prefResult = await client.query('SELECT * FROM user_preferences WHERE user_id = $1', [userId]);
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
      await client.query('INSERT INTO user_preferences (user_id) VALUES ($1)', [userId]);
    }
    
    res.json({ success: true, preferences });
  } catch (err) {
    console.error('Error fetching preferences:', err);
    res.status(500).json({ error: 'Failed to retrieve user preferences' });
  }
});

// POST /api/preferences — Save/Update preferences for active user
router.post('/', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { boardTheme, pieceStyle, soundEnabled, moveHints, autoFlip } = req.body;
  const client = getPgClient();

  try {
    const sEnabled = soundEnabled ? 1 : 0;
    const mHints = moveHints ? 1 : 0;
    const aFlip = autoFlip ? 1 : 0;

    await client.query(`
      INSERT INTO user_preferences (user_id, board_theme, piece_style, sound_enabled, move_hints, auto_flip)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT(user_id) DO UPDATE SET
        board_theme = excluded.board_theme,
        piece_style = excluded.piece_style,
        sound_enabled = excluded.sound_enabled,
        move_hints = excluded.move_hints,
        auto_flip = excluded.auto_flip
    `, [userId, boardTheme, pieceStyle, sEnabled, mHints, aFlip]);

    res.json({ success: true, preferences: { boardTheme, pieceStyle, soundEnabled, moveHints, autoFlip } });
  } catch (err) {
    console.error('Error updating preferences:', err);
    res.status(500).json({ error: 'Failed to save preferences' });
  }
});

module.exports = router;

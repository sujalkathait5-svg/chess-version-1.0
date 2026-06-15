// backend/routes/tournaments.js
const express = require('express');
const router = express.Router();
const { getPgClient } = require('../db/sqlite');
const authMiddleware = require('../middleware/auth');
const crypto = require('crypto');
const { joinTournamentQueue, leaveTournamentQueue } = require('../ws/tournamentManager');

// GET /api/tournaments - Get upcoming and active public tournaments
router.get('/', async (req, res) => {
  const client = getPgClient();
  try {
    const result = await client.query(`
      SELECT t.*, 
             (SELECT COUNT(*) FROM tournament_participants tp WHERE tp.tournament_id = t.id) as participant_count
      FROM tournaments t
      WHERE t.status IN ('upcoming', 'active', 'completed') AND t.is_public = 1
      ORDER BY t.start_time DESC
      LIMIT 50
    `);
    
    // Omit passwords from the result and parse time_control
    const safeRows = result.rows.map(row => {
      const { password, ...rest } = row;
      try {
        rest.time_control = JSON.parse(rest.time_control);
      } catch (e) {
        rest.time_control = { minutes: 0, incrementSeconds: 0 };
      }
      return rest;
    });
    
    res.json(safeRows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tournaments/:id - Get specific tournament and its leaderboard
router.get('/:id', async (req, res) => {
  const client = getPgClient();
  try {
    const tResult = await client.query(`SELECT * FROM tournaments WHERE id = $1`, [req.params.id]);
    if (tResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    const tournament = tResult.rows[0];
    const { password, ...safeTournament } = tournament; // hide password

    const pResult = await client.query(`
      SELECT tp.user_id, u.username, u.avatar_url, tp.score, tp.tiebreak, tp.joined_at
      FROM tournament_participants tp
      JOIN users u ON tp.user_id = u.id
      WHERE tp.tournament_id = $1
      ORDER BY tp.score DESC, tp.tiebreak DESC, tp.joined_at ASC
    `, [req.params.id]);

    try {
      safeTournament.time_control = JSON.parse(safeTournament.time_control);
    } catch (e) {
      safeTournament.time_control = { minutes: 0, incrementSeconds: 0 };
    }

    res.json({
      ...safeTournament,
      hasPassword: !!password,
      participants: pResult.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Apply auth middleware for routes that modify data
router.use(authMiddleware);

// POST /api/tournaments - Create a new tournament
router.post('/', async (req, res) => {
  const client = getPgClient();
  const { name, description, timeControl, duration, maxPlayers, isPublic, password, startTime } = req.body;

  if (!name || !timeControl || !duration) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const tId = crypto.randomUUID();
  // Ensure start_time is valid, fallback to now if immediate
  const startDt = startTime ? new Date(startTime) : new Date();
  
  // Calculate end_time based on duration
  const endDt = new Date(startDt.getTime() + duration * 60000);

  try {
    const timeControlStr = typeof timeControl === 'string' ? timeControl : JSON.stringify(timeControl);
    
    const result = await client.query(`
      INSERT INTO tournaments (id, name, description, type, status, time_control, start_time, end_time, created_by, duration, is_public, password, max_players)
      VALUES ($1, $2, $3, 'arena', 'upcoming', $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      tId, name, description || '', timeControlStr, startDt.toISOString(), endDt.toISOString(),
      req.user.id, duration, isPublic ? 1 : 0, password || null, maxPlayers || null
    ]);

    res.status(201).json({ success: true, tournament: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tournaments/:id/join - Join a tournament
router.post('/:id/join', async (req, res) => {
  const client = getPgClient();
  const { password } = req.body;

  try {
    const tResult = await client.query(`SELECT * FROM tournaments WHERE id = $1`, [req.params.id]);
    if (tResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    const tournament = tResult.rows[0];

    if (tournament.status === 'completed') {
      return res.status(400).json({ error: 'Tournament has already ended' });
    }

    // Password check if private
    if (tournament.is_public === 0 && tournament.password) {
      if (password !== tournament.password) {
        return res.status(403).json({ error: 'Invalid tournament password' });
      }
    }

    // Late join cutoff: check if 50% of duration has passed
    if (tournament.status === 'active') {
      const now = new Date().getTime();
      const start = new Date(tournament.start_time).getTime();
      const elapsed = (now - start) / 60000; // in minutes
      if (elapsed > (tournament.duration / 2)) {
        return res.status(400).json({ error: 'Late join cutoff has passed (50% of tournament duration)' });
      }
    }

    // Max players check
    if (tournament.max_players) {
      const pCountResult = await client.query(`SELECT COUNT(*) as count FROM tournament_participants WHERE tournament_id = $1`, [tournament.id]);
      if (pCountResult.rows[0].count >= tournament.max_players) {
        return res.status(400).json({ error: 'Tournament is full' });
      }
    }

    const participantId = crypto.randomUUID();
    const result = await client.query(`
      INSERT INTO tournament_participants (id, tournament_id, user_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (tournament_id, user_id) DO NOTHING
      RETURNING *
    `, [participantId, req.params.id, req.user.id]);

    if (result.rows.length === 0) {
      // Meaning they were already joined
      joinTournamentQueue(req.params.id, req.user.id);
      return res.json({ success: true, message: 'Already joined' });
    }

    // Enter matchmaking queue if tournament is active
    if (tournament.status === 'active') {
      joinTournamentQueue(req.params.id, req.user.id);
    }

    res.status(201).json({ success: true, participant: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tournaments/:id/leave - Leave a tournament queue
router.post('/:id/leave', async (req, res) => {
  const client = getPgClient();
  try {
    const tResult = await client.query(`SELECT status FROM tournaments WHERE id = $1`, [req.params.id]);
    if (tResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    
    // If it hasn't started, we could physically remove them, or just let them stay but leave the queue.
    // If it has started, we just leave the queue so they keep their score but don't get paired.
    leaveTournamentQueue(req.params.id, req.user.id);

    // If upcoming, remove them entirely
    if (tResult.rows[0].status === 'upcoming') {
      await client.query(`DELETE FROM tournament_participants WHERE tournament_id = $1 AND user_id = $2`, [req.params.id, req.user.id]);
    }

    res.json({ success: true, message: 'Left tournament queue' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

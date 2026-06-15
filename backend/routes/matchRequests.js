// backend/routes/matchRequests.js
const express = require('express');
const router = express.Router();
const { getPgClient } = require('../db/sqlite');
const crypto = require('crypto');
const authMiddleware = require('../middleware/auth');
const { createNotification } = require('./notifications');

// Apply auth middleware to all routes
router.use(authMiddleware);

// POST /api/match-requests
router.post('/', async (req, res) => {
  const { recipient_id, time_control } = req.body;
  const sender_id = req.user.id;

  if (!recipient_id || !time_control) {
    return res.status(400).json({ error: 'recipient_id and time_control are required' });
  }

  const client = getPgClient();
  try {
    const requestId = crypto.randomUUID();
    const result = await client.query(`
      INSERT INTO match_requests (id, sender_id, recipient_id, time_control, expires_at)
      VALUES ($1, $2, $3, $4, datetime('now', '+10 minutes'))
      RETURNING *
    `, [requestId, sender_id, recipient_id, typeof time_control === 'string' ? time_control : JSON.stringify(time_control)]);

    const requestRow = result.rows[0];
    if (requestRow && typeof requestRow.time_control === 'string') {
      try { requestRow.time_control = JSON.parse(requestRow.time_control); } catch (e) {}
    }

    // Create notification for recipient
    await createNotification(
      recipient_id,
      'match_request',
      'New Match Request',
      `${req.user.username} has challenged you to a ${time_control.name || 'chess'} match!`,
      `/play?request_id=${requestRow.id}`
    );

    res.status(201).json(requestRow);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/match-requests
router.get('/', async (req, res) => {
  const user_id = req.user.id;
  
  const client = getPgClient();
  try {
    const result = await client.query(`
      SELECT mr.*, u.username as sender_username 
      FROM match_requests mr
      JOIN users u ON mr.sender_id = u.id
      WHERE mr.recipient_id = $1 AND mr.status = 'pending' AND mr.expires_at > datetime('now')
    `, [user_id]);

    const rows = result.rows.map(row => {
      if (typeof row.time_control === 'string') {
        try { row.time_control = JSON.parse(row.time_control); } catch (e) {}
      }
      return row;
    });

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/match-requests/:id/accept
router.post('/:id/accept', async (req, res) => {
  const request_id = req.params.id;
  const user_id = req.user.id;

  const client = getPgClient();
  try {
    const result = await client.query(`
      UPDATE match_requests 
      SET status = 'accepted' 
      WHERE id = $1 AND recipient_id = $2 AND status = 'pending' AND expires_at > datetime('now')
      RETURNING *
    `, [request_id, user_id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Match request not found or expired' });
    }

    const requestRow = result.rows[0];
    if (requestRow && typeof requestRow.time_control === 'string') {
      try { requestRow.time_control = JSON.parse(requestRow.time_control); } catch (e) {}
    }

    res.json(requestRow);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/match-requests/:id/decline
router.post('/:id/decline', async (req, res) => {
  const request_id = req.params.id;
  const user_id = req.user.id;

  const client = getPgClient();
  try {
    const result = await client.query(`
      UPDATE match_requests 
      SET status = 'declined' 
      WHERE id = $1 AND recipient_id = $2 AND status = 'pending'
      RETURNING *
    `, [request_id, user_id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Match request not found' });
    }

    const requestRow = result.rows[0];
    if (requestRow && typeof requestRow.time_control === 'string') {
      try { requestRow.time_control = JSON.parse(requestRow.time_control); } catch (e) {}
    }

    res.json(requestRow);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/match-requests/qr
router.post('/qr', async (req, res) => {
  const { time_control } = req.body;
  const sender_id = req.user.id;

  if (!time_control) {
    return res.status(400).json({ error: 'time_control is required' });
  }

  const qr_token = crypto.randomBytes(16).toString('hex');
  const client = getPgClient();
  const requestId = crypto.randomUUID();

  try {
    const result = await client.query(`
      INSERT INTO match_requests (id, sender_id, time_control, qr_token, expires_at)
      VALUES ($1, $2, $3, $4, datetime('now', '+1 hour'))
      RETURNING *
    `, [requestId, sender_id, typeof time_control === 'string' ? time_control : JSON.stringify(time_control), qr_token]);

    const requestRow = result.rows[0];
    if (requestRow && typeof requestRow.time_control === 'string') {
      try { requestRow.time_control = JSON.parse(requestRow.time_control); } catch (e) {}
    }

    res.status(201).json(requestRow);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/match-requests/qr/join
router.post('/qr/join', async (req, res) => {
  const { qr_token } = req.body;
  const user_id = req.user.id;

  if (!qr_token) {
    return res.status(400).json({ error: 'qr_token is required' });
  }

  const client = getPgClient();
  try {
    const result = await client.query(`
      UPDATE match_requests 
      SET status = 'accepted', recipient_id = $1 
      WHERE qr_token = $2 AND status = 'pending' AND expires_at > datetime('now') AND sender_id != $1
      RETURNING *
    `, [user_id, qr_token]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Invalid or expired QR token' });
    }

    const requestRow = result.rows[0];
    if (requestRow && typeof requestRow.time_control === 'string') {
      try { requestRow.time_control = JSON.parse(requestRow.time_control); } catch (e) {}
    }

    res.json(requestRow);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

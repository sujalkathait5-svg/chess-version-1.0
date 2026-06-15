// backend/routes/friends.js
const express = require('express');
const router = express.Router();
const { getPgClient } = require('../db/sqlite');
const pgPool = getPgClient();
const authMiddleware = require('../middleware/auth');
const crypto = require('crypto');

// GET /api/friends — Fetch accepted friends and pending requests
router.get('/', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  try {
    // 1. Fetch Accepted Friends
    const friendsQuery = `
      SELECT 
        f.id as friendship_id,
        u.id as id,
        u.username,
        u.avatar_url as avatarUrl,
        r.rating_vs_human as rating
      FROM friendships f
      JOIN users u ON (u.id = f.friend_id AND f.user_id = $1) OR (u.id = f.user_id AND f.friend_id = $1)
      JOIN elo_ratings r ON r.user_id = u.id
      WHERE f.status = 'accepted'
    `;
    const friendsResult = await pgPool.query(friendsQuery, [userId]);

    // 2. Fetch Incoming Pending Requests
    const incomingQuery = `
      SELECT 
        f.id as friendship_id,
        u.id as id,
        u.username,
        u.avatar_url as avatarUrl,
        r.rating_vs_human as rating
      FROM friendships f
      JOIN users u ON u.id = f.user_id
      JOIN elo_ratings r ON r.user_id = u.id
      WHERE f.friend_id = $1 AND f.status = 'pending'
    `;
    const incomingResult = await pgPool.query(incomingQuery, [userId]);

    // 3. Fetch Outgoing Pending Requests
    const outgoingQuery = `
      SELECT 
        f.id as friendship_id,
        u.id as id,
        u.username,
        u.avatar_url as avatarUrl,
        r.rating_vs_human as rating
      FROM friendships f
      JOIN users u ON u.id = f.friend_id
      JOIN elo_ratings r ON r.user_id = u.id
      WHERE f.user_id = $1 AND f.status = 'pending'
    `;
    const outgoingResult = await pgPool.query(outgoingQuery, [userId]);

    res.json({
      success: true,
      friends: friendsResult.rows,
      incoming: incomingResult.rows,
      outgoing: outgoingResult.rows
    });
  } catch (err) {
    console.error('Error fetching friends list:', err);
    res.status(500).json({ error: 'Failed to retrieve social graph' });
  }
});

// GET /api/friends/search — Search users by username (for sending requests)
router.get('/search', authMiddleware, async (req, res) => {
  const { query } = req.query;
  const userId = req.user.id;

  if (!query) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  try {
    const searchQuery = `
      SELECT u.id, u.username, u.avatar_url as avatarUrl, r.rating_vs_human as rating,
             f.status as relationship_status, f.user_id as sender_id
      FROM users u
      JOIN elo_ratings r ON u.id = r.user_id
      LEFT JOIN friendships f ON (f.user_id = $2 AND f.friend_id = u.id) OR (f.user_id = u.id AND f.friend_id = $2)
      WHERE u.username ILIKE $1 AND u.id <> $2 AND u.is_active = TRUE
      LIMIT 10
    `;
    const result = await pgPool.query(searchQuery, [`%${query}%`, userId]);
    res.json({ success: true, users: result.rows });
  } catch (err) {
    console.error('Error searching users:', err);
    res.status(500).json({ error: 'Failed to search for players' });
  }
});

// POST /api/friends/request — Send a friend request
router.post('/request', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { recipientId } = req.body;

  if (!recipientId) {
    return res.status(400).json({ error: 'Recipient ID is required' });
  }

  if (userId === recipientId) {
    return res.status(400).json({ error: 'You cannot add yourself as a friend' });
  }

  try {
    // Check if user exists
    const userRes = await pgPool.query('SELECT id FROM users WHERE id = $1', [recipientId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Recipient player not found' });
    }

    // Insert pending friendship pair
    const friendshipId = crypto.randomUUID();
    const insertSql = `
      INSERT INTO friendships (id, user_id, friend_id, status)
      VALUES ($1, $2, $3, 'pending')
      RETURNING id, status
    `;
    const result = await pgPool.query(insertSql, [friendshipId, userId, recipientId]);
    res.status(201).json({ success: true, friendship: result.rows[0] });
  } catch (err) {
    if (err.code === '23505' || (err.message && err.message.includes('UNIQUE constraint failed'))) {
      return res.status(400).json({ error: 'A friendship or pending request already exists between you' });
    }
    console.error('Error sending friend request:', err);
    res.status(500).json({ error: 'Failed to send friend request' });
  }
});

// POST /api/friends/accept — Accept a friend request
router.post('/accept', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { friendshipId } = req.body;

  if (!friendshipId) {
    return res.status(400).json({ error: 'Friendship ID is required' });
  }

  try {
    // Verify the recipient of the request is the active user
    const acceptSql = `
      UPDATE friendships
      SET status = 'accepted'
      WHERE id = $1 AND friend_id = $2 AND status = 'pending'
      RETURNING id, status
    `;
    const result = await pgPool.query(acceptSql, [friendshipId, userId]);
    
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'No pending friend request found matching this ID' });
    }

    res.json({ success: true, friendship: result.rows[0] });
  } catch (err) {
    console.error('Error accepting friend request:', err);
    res.status(500).json({ error: 'Failed to accept friend request' });
  }
});

// POST /api/friends/reject — Reject or cancel a friend request / friendship
router.post('/reject', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { friendshipId } = req.body;

  if (!friendshipId) {
    return res.status(400).json({ error: 'Friendship ID is required' });
  }

  try {
    // Allow either the sender or recipient to cancel/reject the request
    const rejectSql = `
      DELETE FROM friendships
      WHERE id = $1 AND (user_id = $2 OR friend_id = $2)
      RETURNING id
    `;
    const result = await pgPool.query(rejectSql, [friendshipId, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Friendship record not found or permission denied' });
    }

    res.json({ success: true, message: 'Friendship record successfully removed' });
  } catch (err) {
    console.error('Error removing friendship:', err);
    res.status(500).json({ error: 'Failed to cancel/reject friendship' });
  }
});

module.exports = router;

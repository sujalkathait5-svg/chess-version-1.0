const express = require('express');
const router = express.Router();
const { getPgClient } = require('../db/sqlite');
const pgPool = getPgClient();
const { getIo } = require('../ws/socketServer');

// Middleware to ensure authentication
const authenticate = require('../middleware/auth');
router.use(authenticate);

// GET /api/notifications - Get user notifications
router.get('/', async (req, res) => {
  try {
    const result = await pgPool.query(
      `SELECT * FROM notifications 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 50`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// POST /api/notifications/:id/read - Mark single notification as read
router.post('/:id/read', async (req, res) => {
  try {
    const result = await pgPool.query(
      `UPDATE notifications 
       SET is_read = TRUE 
       WHERE id = $1 AND user_id = $2 
       RETURNING *`,
      [req.params.id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error marking notification read:', error);
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

// POST /api/notifications/read-all - Mark all as read
router.post('/read-all', async (req, res) => {
  try {
    await pgPool.query(
      `UPDATE notifications 
       SET is_read = TRUE 
       WHERE user_id = $1`,
      [req.user.id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking all notifications read:', error);
    res.status(500).json({ error: 'Failed to update notifications' });
  }
});

// Helper function to create notification internally (e.g. from other routes)
async function createNotification(userId, type, title, message, linkUrl = null) {
  try {
    const id = require('crypto').randomUUID();
    const result = await pgPool.query(
      `INSERT INTO notifications (id, user_id, type, title, message, link_url) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [id, userId, type, title, message, linkUrl]
    );
    const notification = result.rows[0];

    // Push via websocket if user is connected
    const io = getIo();
    if (io) {
      io.to(`user_${userId}`).emit('notification', notification);
    }

    return notification;
  } catch (error) {
    console.error('Failed to create internal notification:', error);
    return null;
  }
}

module.exports = {
  router,
  createNotification
};

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/sqlite');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

// Get all saved positions for the user
router.get("/", authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const positions = await db.all(
      `SELECT * FROM saved_positions WHERE user_id = ? ORDER BY created_at DESC`,
      [req.user.id]
    );
    // Parse folders back into arrays
    const parsed = positions.map(p => ({ ...p, folders: JSON.parse(p.folders || "[]") }));
    res.json({ success: true, positions: parsed });
  } catch (error) {
    console.error("Fetch positions error:", error);
    res.status(500).json({ success: false, error: "Server error fetching positions." });
  }
});

// Save a new position
router.post("/", authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const { name, fen, folders = [] } = req.body;
    
    if (!name || !fen) {
      return res.status(400).json({ success: false, error: "Name and FEN are required." });
    }

    const id = uuidv4();
    await db.run(
      `INSERT INTO saved_positions (id, user_id, name, fen, folders, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [id, req.user.id, name, fen, JSON.stringify(folders)]
    );

    res.json({ success: true, position: { id, name, fen, folders } });
  } catch (error) {
    console.error("Save position error:", error);
    res.status(500).json({ success: false, error: "Server error saving position." });
  }
});

// Update a position
router.put("/:id", authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { name, folders } = req.body;

    const existing = await db.get(`SELECT id FROM saved_positions WHERE id = ? AND user_id = ?`, [id, req.user.id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: "Position not found." });
    }

    await db.run(
      `UPDATE saved_positions SET name = ?, folders = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [name, JSON.stringify(folders || []), id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Update position error:", error);
    res.status(500).json({ success: false, error: "Server error updating position." });
  }
});

// Delete a position
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    
    await db.run(`DELETE FROM saved_positions WHERE id = ? AND user_id = ?`, [id, req.user.id]);
    res.json({ success: true });
  } catch (error) {
    console.error("Delete position error:", error);
    res.status(500).json({ success: false, error: "Server error deleting position." });
  }
});

module.exports = router;

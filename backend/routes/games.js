// backend/routes/games.js
const express = require('express');
const router = express.Router();
const { getPgClient } = require('../db/sqlite');
const authMiddleware = require('../middleware/auth');

// POST /api/games — Save a finished game (Dual DB Transaction now single SQLite)
router.post('/', authMiddleware, async (req, res) => {
  const {
    gameId,
    whitePlayerId,
    blackPlayerId,
    mode,
    timeControl,
    result,
    termination,
    opening,
    moves,
    pgn,
    totalMoves,
    duration,
    playedAt
  } = req.body;

  if (!gameId || !whitePlayerId || !blackPlayerId || !mode || !result) {
    return res.status(400).json({ error: 'Missing required game fields' });
  }

  const pgClient = getPgClient();
  try {
    // 1. Calculate Elo changes inside PG transaction
    await pgClient.query('BEGIN');

    // Helper to fetch player rating
    const getRating = async (id) => {
      const res = await pgClient.query('SELECT rating_vs_ai, rating_vs_human FROM elo_ratings WHERE user_id = $1', [id]);
      return res.rows.length > 0 ? res.rows[0] : null;
    };

    const whiteProfile = await getRating(whitePlayerId);
    const blackProfile = await getRating(blackPlayerId);

    let whiteRating = whiteProfile ? (mode === 'vs_ai' ? whiteProfile.rating_vs_ai : whiteProfile.rating_vs_human) : 1200;
    let blackRating = blackProfile ? (mode === 'vs_ai' ? blackProfile.rating_vs_ai : blackProfile.rating_vs_human) : 1200;

    // AI rating estimate based on Stockfish level
    if (mode === 'vs_ai') {
      if (whitePlayerId.startsWith('stockfish_level_')) {
        const lvl = parseInt(whitePlayerId.replace('stockfish_level_', '')) || 4;
        whiteRating = 800 + (lvl * 150);
      } else if (blackPlayerId.startsWith('stockfish_level_')) {
        const lvl = parseInt(blackPlayerId.replace('stockfish_level_', '')) || 4;
        blackRating = 800 + (lvl * 150);
      }
    }

    // Standard K=32 Elo change formula
    const K = 32;
    const expectedWhite = 1 / (1 + Math.pow(10, (blackRating - whiteRating) / 400));
    const expectedBlack = 1 / (1 + Math.pow(10, (whiteRating - blackRating) / 400));

    let scoreWhite = 0.5;
    let scoreBlack = 0.5;
    if (result === 'white_win') { scoreWhite = 1; scoreBlack = 0; }
    else if (result === 'black_win') { scoreWhite = 0; scoreBlack = 1; }

    const eloChangeWhite = Math.round(K * (scoreWhite - expectedWhite));
    const eloChangeBlack = Math.round(K * (scoreBlack - expectedBlack));

    // Update Player Stats Helper
    const updatePlayerStats = async (playerId, isWhite) => {
      if (playerId.startsWith('stockfish_') || playerId.startsWith('anon_') || playerId.startsWith('guest_')) return;
      
      const change = isWhite ? eloChangeWhite : eloChangeBlack;
      const ratingCol = mode === 'vs_ai' ? 'rating_vs_ai' : 'rating_vs_human';
      const peakCol = mode === 'vs_ai' ? 'peak_rating_vs_ai' : 'peak_rating_vs_human';
      const gamesCol = mode === 'vs_ai' ? 'games_played_ai' : 'games_played_human';

      const updateEloSql = `
        UPDATE elo_ratings 
        SET ${ratingCol} = ${ratingCol} + $2,
            ${peakCol} = MAX(${peakCol}, ${ratingCol} + $2),
            ${gamesCol} = ${gamesCol} + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1
      `;
      await pgClient.query(updateEloSql, [playerId, change]);

      // Calculate stats outcomes
      const outcome = isWhite ? scoreWhite : scoreBlack;
      const isWin = outcome === 1;
      const isLoss = outcome === 0;
      const isDraw = outcome === 0.5;

      // Update stats summary table
      const statsRes = await pgClient.query('SELECT wins, losses, draws, current_win_streak, best_win_streak FROM user_stats_summary WHERE user_id = $1', [playerId]);
      if (statsRes.rows.length > 0) {
        const statsRow = statsRes.rows[0];
        const wins = statsRow.wins + (isWin ? 1 : 0);
        const losses = statsRow.losses + (isLoss ? 1 : 0);
        const draws = statsRow.draws + (isDraw ? 1 : 0);
        const total = wins + losses + draws;
        const currentStreak = isWin ? statsRow.current_win_streak + 1 : (isLoss ? 0 : statsRow.current_win_streak);
        const bestStreak = Math.max(statsRow.best_win_streak, currentStreak);

        const updateStatsSql = `
          UPDATE user_stats_summary
          SET total_games = $2, wins = $3, losses = $4, draws = $5,
              current_win_streak = $6, best_win_streak = $7
          WHERE user_id = $1
        `;
        await pgClient.query(updateStatsSql, [playerId, total, wins, losses, draws, currentStreak, bestStreak]);
      }
    };

    // Apply stats for White (if registered)
    await updatePlayerStats(whitePlayerId, true);
    // Apply stats for Black (if registered)
    await updatePlayerStats(blackPlayerId, false);

    // 2. Insert Game to SQLite
    const insertGameSql = `
      INSERT INTO games (id, white_id, black_id, mode, time_control, result, termination, opening, moves, pgn, total_moves, duration, elo_change_white, elo_change_black, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT(id) DO NOTHING
    `;
    const playedAtDate = playedAt ? new Date(playedAt).toISOString() : new Date().toISOString();
    await pgClient.query(insertGameSql, [
      gameId, whitePlayerId, blackPlayerId, mode, timeControl, result, termination, opening, JSON.stringify(moves || []), pgn, totalMoves, duration, eloChangeWhite, eloChangeBlack, playedAtDate
    ]);

    await pgClient.query('COMMIT');

    res.status(201).json({
      success: true,
      eloChange: {
        white: eloChangeWhite,
        black: eloChangeBlack
      }
    });
  } catch (err) {
    await pgClient.query('ROLLBACK');
    console.error('Error in single database save transaction:', err);
    res.status(500).json({ error: 'Failed to save game and ratings' });
  }
});

// GET /api/games — Retrieve user's games (dashboard list)
router.get('/', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const client = getPgClient();
  try {
    const gamesRes = await client.query(`
      SELECT * FROM games 
      WHERE white_id = $1 OR black_id = $1
      ORDER BY created_at DESC
    `, [userId]);

    const formattedGames = await Promise.all(gamesRes.rows.map(async (g) => {
      // Fetch names
      const getPlayerName = async (id) => {
        if (!id) return 'Guest Player';
        if (id.startsWith('stockfish_level_')) {
          return `Stockfish Lvl ${id.replace('stockfish_level_', '')}`;
        }
        const nameRes = await client.query('SELECT username FROM users WHERE id = $1', [id]);
        return nameRes.rows.length > 0 ? nameRes.rows[0].username : 'Guest Player';
      };

      const whiteName = await getPlayerName(g.white_id);
      const blackName = await getPlayerName(g.black_id);

      // Check if analysis exists
      const analysisRes = await client.query('SELECT white_accuracy, black_accuracy FROM game_analysis WHERE game_id = $1', [g.id]);
      const analysisDoc = analysisRes.rows.length > 0 ? analysisRes.rows[0] : null;

      return {
        id: g.id,
        mode: g.mode || 'local',
        white: { id: g.white_id, name: whiteName },
        black: { id: g.black_id, name: blackName },
        result: g.result,
        termination: g.termination,
        timeControl: g.time_control,
        playedAt: g.created_at,
        eloChangeWhite: g.elo_change_white,
        eloChangeBlack: g.elo_change_black,
        accuracyWhite: analysisDoc ? analysisDoc.white_accuracy : null,
        accuracyBlack: analysisDoc ? analysisDoc.black_accuracy : null
      };
    }));

    res.json({ success: true, games: formattedGames });
  } catch (err) {
    console.error('Error fetching games:', err);
    res.status(500).json({ error: 'Failed to retrieve games' });
  }
});

// GET /api/games/:gameId
router.get('/:gameId', authMiddleware, async (req, res) => {
  const { gameId } = req.params;
  const client = getPgClient();

  try {
    const gameRes = await client.query('SELECT * FROM games WHERE id = $1', [gameId]);
    if (gameRes.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const gameDoc = gameRes.rows[0];

    const getPlayerName = async (id) => {
      if (!id) return 'Guest Player';
      if (id.startsWith('stockfish_level_')) return `Stockfish Lvl ${id.replace('stockfish_level_', '')}`;
      const nameRes = await client.query('SELECT username FROM users WHERE id = $1', [id]);
      return nameRes.rows.length > 0 ? nameRes.rows[0].username : 'Guest Player';
    };

    const whiteName = await getPlayerName(gameDoc.white_id);
    const blackName = await getPlayerName(gameDoc.black_id);

    const formattedGame = {
      id: gameDoc.id,
      whitePlayerId: gameDoc.white_id,
      whiteName,
      blackPlayerId: gameDoc.black_id,
      blackName,
      mode: gameDoc.mode,
      timeControl: gameDoc.time_control,
      result: gameDoc.result,
      termination: gameDoc.termination,
      opening: gameDoc.opening,
      moves: JSON.parse(gameDoc.moves || '[]'),
      pgn: gameDoc.pgn,
      playedAt: gameDoc.created_at,
      eloChange: {
        white: gameDoc.elo_change_white,
        black: gameDoc.elo_change_black
      }
    };

    res.json({ success: true, game: formattedGame });
  } catch (err) {
    console.error('Error fetching game details:', err);
    res.status(500).json({ error: 'Failed to retrieve game' });
  }
});

// POST /api/games/:gameId/analysis
router.post('/:gameId/analysis', authMiddleware, async (req, res) => {
  const { gameId } = req.params;
  const {
    whiteAccuracy,
    blackAccuracy,
    classificationCounts,
    moveAnalysis
  } = req.body;
  
  if (whiteAccuracy === undefined || blackAccuracy === undefined || !classificationCounts) {
    return res.status(400).json({ error: 'Missing required analysis fields' });
  }

  const client = getPgClient();

  try {
    const gameRes = await client.query('SELECT id FROM games WHERE id = $1', [gameId]);
    if (gameRes.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found in database' });
    }

    const insertAnalysisSql = `
      INSERT INTO game_analysis (game_id, white_accuracy, black_accuracy, classification_counts, move_analysis)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT(game_id) DO UPDATE SET
        white_accuracy = excluded.white_accuracy,
        black_accuracy = excluded.black_accuracy,
        classification_counts = excluded.classification_counts,
        move_analysis = excluded.move_analysis
    `;

    await client.query(insertAnalysisSql, [
      gameId,
      whiteAccuracy,
      blackAccuracy,
      JSON.stringify(classificationCounts),
      JSON.stringify(moveAnalysis)
    ]);

    // Update player accuracy avg if needed? We had it in Postgres triggers but removed it.
    // For now we skip updating avg_accuracy in user_stats_summary since it's hard to track dynamic sum.

    res.json({ success: true, message: 'Analysis saved successfully' });
  } catch (err) {
    console.error('Error saving game analysis:', err);
    res.status(500).json({ error: 'Failed to save analysis' });
  }
});

// GET /api/games/:gameId/analysis
router.get('/:gameId/analysis', authMiddleware, async (req, res) => {
  const { gameId } = req.params;
  const client = getPgClient();
  try {
    const analysisRes = await client.query('SELECT * FROM game_analysis WHERE game_id = $1', [gameId]);
    
    if (analysisRes.rows.length === 0) {
      return res.status(404).json({ error: 'Analysis not found for this game' });
    }

    const analysis = analysisRes.rows[0];
    res.json({
      success: true,
      analysis: {
        gameId: analysis.game_id,
        whiteAccuracy: analysis.white_accuracy,
        blackAccuracy: analysis.black_accuracy,
        classificationCounts: JSON.parse(analysis.classification_counts || '{}'),
        moveAnalysis: JSON.parse(analysis.move_analysis || '[]')
      }
    });
  } catch (err) {
    console.error('Error fetching game analysis:', err);
    res.status(500).json({ error: 'Failed to retrieve analysis' });
  }
});

module.exports = router;

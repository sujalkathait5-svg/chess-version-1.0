// backend/ws/gameHistory.js
const { getPgClient } = require('../db/sqlite');

/**
 * Calculate new Elo ratings for two players given the result
 * @param {number} r1 Player 1's rating
 * @param {number} r2 Player 2's rating
 * @param {number} s1 Player 1's score (1 for win, 0.5 for draw, 0 for loss)
 */
function calculateElo(r1, r2, s1) {
  const k = 32;
  const expected1 = 1 / (1 + Math.pow(10, (r2 - r1) / 400));
  const newR1 = Math.round(r1 + k * (s1 - expected1));
  
  const s2 = 1 - s1;
  const expected2 = 1 / (1 + Math.pow(10, (r1 - r2) / 400));
  const newR2 = Math.round(r2 + k * (s2 - expected2));
  
  return { newR1, newR2 };
}

/**
 * Records a game in the database and updates both players' Elo ratings
 * @param {Object} game The game room object
 * @param {Object} gameOver The game over result payload ({ reason, winner })
 */
async function recordGameAndElo(game, gameOver) {
  const client = getPgClient();
  if (!client) return;
  if (!game || !game.white || !game.black) return;

  const wId = game.white.user.id;
  const bId = game.black.user.id;

  // Don't record games for anonymous players
  if (wId.startsWith('anon_') || bId.startsWith('anon_')) return;

  let resultStr = 'draw';
  if (gameOver.winner === 'white') resultStr = 'white_win';
  else if (gameOver.winner === 'black') resultStr = 'black_win';

  let sWhite = 0.5;
  if (resultStr === 'white_win') sWhite = 1;
  else if (resultStr === 'black_win') sWhite = 0;

  try {
    // 1. Fetch current ratings
    const ratingsReq = await client.query('SELECT user_id, rating_vs_human FROM elo_ratings WHERE user_id IN ($1, $2)', [wId, bId]);
    const wUser = ratingsReq.rows.find(u => u.user_id === wId);
    const bUser = ratingsReq.rows.find(u => u.user_id === bId);

    const wRating = wUser ? wUser.rating_vs_human : 1500;
    const bRating = bUser ? bUser.rating_vs_human : 1500;

    // 2. Calculate new ratings
    const { newR1: newWhiteRating, newR2: newBlackRating } = calculateElo(wRating, bRating, sWhite);

    // 3. Update elo_ratings table (including games_played_human)
    await client.query('UPDATE elo_ratings SET rating_vs_human = $1, peak_rating_vs_human = MAX(peak_rating_vs_human, $1), games_played_human = games_played_human + 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2', [newWhiteRating, wId]);
    await client.query('UPDATE elo_ratings SET rating_vs_human = $1, peak_rating_vs_human = MAX(peak_rating_vs_human, $1), games_played_human = games_played_human + 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2', [newBlackRating, bId]);

    // Update player stats helper
    const updateStats = async (playerId, isWin, isLoss, isDraw) => {
      const statsRes = await client.query('SELECT wins, losses, draws, current_win_streak, best_win_streak FROM user_stats_summary WHERE user_id = $1', [playerId]);
      if (statsRes.rows.length > 0) {
        const statsRow = statsRes.rows[0];
        const wins = statsRow.wins + (isWin ? 1 : 0);
        const losses = statsRow.losses + (isLoss ? 1 : 0);
        const draws = statsRow.draws + (isDraw ? 1 : 0);
        const total = wins + losses + draws;
        const currentStreak = isWin ? statsRow.current_win_streak + 1 : (isLoss ? 0 : statsRow.current_win_streak);
        const bestStreak = Math.max(statsRow.best_win_streak, currentStreak);

        await client.query(`
          UPDATE user_stats_summary
          SET total_games = $2, wins = $3, losses = $4, draws = $5,
              current_win_streak = $6, best_win_streak = $7, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = $1
        `, [playerId, total, wins, losses, draws, currentStreak, bestStreak]);
      }
    };

    const isWhiteWin = resultStr === 'white_win';
    const isBlackWin = resultStr === 'black_win';
    const isDrawResult = resultStr === 'draw';

    await updateStats(wId, isWhiteWin, isBlackWin, isDrawResult);
    await updateStats(bId, isBlackWin, isWhiteWin, isDrawResult);

    // 4. Record game in games table with rich info
    const eloChangeWhite = newWhiteRating - wRating;
    const eloChangeBlack = newBlackRating - bRating;
    const movesHistory = game.chess.history({ verbose: true }).map(m => ({
      san: m.san,
      uci: m.from + m.to + (m.promotion || '')
    }));

    await client.query(`
      INSERT INTO games (id, white_id, black_id, mode, result, pgn, total_moves, elo_change_white, elo_change_black, moves)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      require('crypto').randomUUID(),
      wId,
      bId,
      'vs_human',
      resultStr,
      game.chess.pgn(),
      movesHistory.length,
      eloChangeWhite,
      eloChangeBlack,
      JSON.stringify(movesHistory)
    ]);

  } catch (err) {
    console.error('Error recording game history:', err);
  }
}

module.exports = {
  recordGameAndElo
};

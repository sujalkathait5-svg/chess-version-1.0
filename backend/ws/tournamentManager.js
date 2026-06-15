// backend/ws/tournamentManager.js
const { getPgClient } = require('../db/sqlite');
const { createRoom } = require('./gameRooms');

// In-memory queue: tournament_id -> Set of user_ids
const tournamentQueues = new Map();

function getQueue(tournamentId) {
  if (!tournamentQueues.has(tournamentId)) {
    tournamentQueues.set(tournamentId, new Set());
  }
  return tournamentQueues.get(tournamentId);
}

// Player joins the active queue for an arena
function joinTournamentQueue(tournamentId, userId) {
  const queue = getQueue(tournamentId);
  queue.add(userId);
}

// Player leaves the queue (e.g., disconnected or paused)
function leaveTournamentQueue(tournamentId, userId) {
  const queue = getQueue(tournamentId);
  queue.delete(userId);
}

async function updateTournamentStates(client, io) {
  try {
    const now = new Date().toISOString();

    // Upcoming -> Active
    const toActive = await client.query(`
      UPDATE tournaments 
      SET status = 'active'
      WHERE status = 'upcoming' AND start_time <= $1
      RETURNING id
    `, [now]);

    for (const row of toActive.rows) {
      if (io) io.to(`lobby_${row.id}`).emit('tournament_started', { tournamentId: row.id });
    }

    // Active -> Completed
    const toCompleted = await client.query(`
      UPDATE tournaments 
      SET status = 'completed'
      WHERE status = 'active' AND end_time <= $1
      RETURNING id
    `, [now]);

    for (const row of toCompleted.rows) {
      if (io) io.to(`lobby_${row.id}`).emit('tournament_ended', { tournamentId: row.id });
      // Clear queue for this tournament
      tournamentQueues.delete(row.id);
    }
  } catch (err) {
    console.error('Error updating tournament states:', err);
  }
}

// Main pairing loop (runs periodically)
async function processMatchmaking() {
  const { getIo } = require('./socketServer');
  const io = getIo();
  if (!io) return;

  const client = getPgClient();
  if (!client) return;

  // 1. First, transition tournament states based on time
  await updateTournamentStates(client, io);

  try {
    // 2. Fetch active arena tournaments
    const activeTournaments = await client.query(`
      SELECT id, time_control FROM tournaments 
      WHERE status = 'active' AND type = 'arena'
    `);

    for (const row of activeTournaments.rows) {
      const tId = row.id;
      const tControl = row.time_control;
      const queue = Array.from(getQueue(tId));

      if (queue.length < 2) continue;

      // 3. Fetch scores and tiebreak (games as black) to pair by similar score
      const placeholders = queue.map((_, i) => `$${i + 2}`).join(',');
      const participants = await client.query(`
        SELECT user_id, score, tiebreak FROM tournament_participants 
        WHERE tournament_id = $1 AND user_id IN (${placeholders})
        ORDER BY score DESC
      `, [tId, ...queue]);

      const sortedQueue = participants.rows.map(r => r.user_id);

      // Pair adjacent players (since they are sorted by score)
      while (sortedQueue.length >= 2) {
        const p1Id = sortedQueue.shift();
        
        // Find an opponent. For now, we take the next player in the sorted queue.
        // In a more advanced implementation, we would avoid repeat pairings.
        const p2Id = sortedQueue.shift();

        // Check if both are still actually connected and in queue (just in case)
        const q = getQueue(tId);
        if (!q.has(p1Id) || !q.has(p2Id)) continue;

        // Fetch socket instances from Socket.io
        const sockets1 = await io.in(`user_${p1Id}`).fetchSockets();
        const sockets2 = await io.in(`user_${p2Id}`).fetchSockets();
        const p1Socket = sockets1[0];
        const p2Socket = sockets2[0];

        // If a player disconnected/left, remove them from the queue and skip pairing
        if (!p1Socket || !p2Socket) {
          if (!p1Socket) q.delete(p1Id);
          if (!p2Socket) q.delete(p2Id);
          continue;
        }

        // Fetch user data
        const usersReq = await client.query(`SELECT id, username FROM users WHERE id IN ($1, $2)`, [p1Id, p2Id]);
        if (usersReq.rows.length !== 2) continue;

        const p1Info = usersReq.rows.find(u => u.id === p1Id);
        const p2Info = usersReq.rows.find(u => u.id === p2Id);

        // Fetch participant tiebreak info for color balancing
        const p1Participant = participants.rows.find(p => p.user_id === p1Id);
        const p2Participant = participants.rows.find(p => p.user_id === p2Id);

        // Remove from queue since they are matched
        q.delete(p1Id);
        q.delete(p2Id);

        const roomId = `tournament_${tId}_${p1Id}_${p2Id}_${Date.now()}`;
        
        // Color balancing: player with fewer games as black gets black.
        // If equal, random.
        let isP1White = true;
        if (p1Participant.tiebreak > p2Participant.tiebreak) {
          isP1White = true; // p1 played more black, so p1 gets white
        } else if (p1Participant.tiebreak < p2Participant.tiebreak) {
          isP1White = false; // p2 played more black, so p1 gets black
        } else {
          isP1White = Math.random() > 0.5;
        }

        const whiteUser = isP1White ? p1Info : p2Info;
        const blackUser = isP1White ? p2Info : p1Info;

        const whitePlayer = { socket: isP1White ? p1Socket : p2Socket, user: whiteUser };
        const blackPlayer = { socket: isP1White ? p2Socket : p1Socket, user: blackUser };

        const game = createRoom(roomId, whitePlayer, blackPlayer, tControl);
        game.tournamentId = tId; // attach metadata to room

        // Log game to db
        await client.query(`
          INSERT INTO tournament_games (tournament_id, white_id, black_id, result)
          VALUES ($1, $2, $3, 'ongoing')
        `, [tId, whiteUser.id, blackUser.id]);

        // Push events to both players
        const payload = {
          roomId,
          timeControl: tControl,
          white: whiteUser,
          black: blackUser,
          fen: game.chess.fen(),
          whiteTime: game.white.timeRemaining,
          blackTime: game.black.timeRemaining,
          isTournament: true,
          tournamentId: tId
        };

        io.to(`user_${p1Id}`).emit('tournament_game_started', payload);
        io.to(`user_${p2Id}`).emit('tournament_game_started', payload);
      }
    }
  } catch (err) {
    console.error('Error in tournament matchmaking:', err);
  }
}

// Call this from server.js to start the loop
function initTournamentManager() {
  setInterval(processMatchmaking, 5000); // run every 5s
}

// Function to handle game completion updates
async function recordTournamentGameResult(tournamentId, whiteId, blackId, winnerColor) {
  const client = getPgClient();
  if (!client) return;

  let resultStr = 'draw';
  if (winnerColor === 'white') resultStr = 'white_win';
  if (winnerColor === 'black') resultStr = 'black_win';

  try {
    // 1. Update tournament_games
    await client.query(`
      UPDATE tournament_games 
      SET result = $1 
      WHERE tournament_id = $2 AND white_id = $3 AND black_id = $4 AND result = 'ongoing'
    `, [resultStr, tournamentId, whiteId, blackId]);

    // 2. Update participants score
    // Arena scoring: win=1, draw=0.5, loss=0. Since DB stores integers easily, we'll store half-points as true points * 2, or just change DB to REAL.
    // Wait! The sqlite schema has score as INTEGER. We should use 2 for win, 1 for draw, 0 for loss to avoid REAL issues, and display it as score/2.
    // The previous implementation used 2/1/0. Let's stick to 2/1/0 for DB. 
    let wScore = 0;
    let bScore = 0;
    if (resultStr === 'white_win') { wScore = 2; bScore = 0; }
    else if (resultStr === 'black_win') { wScore = 0; bScore = 2; }
    else { wScore = 1; bScore = 1; }

    await client.query(`
      UPDATE tournament_participants SET score = score + $1 WHERE tournament_id = $2 AND user_id = $3
    `, [wScore, tournamentId, whiteId]);
    await client.query(`
      UPDATE tournament_participants SET score = score + $1 WHERE tournament_id = $2 AND user_id = $3
    `, [bScore, tournamentId, blackId]);

    // Update tiebreak: Add 1 to the black player's tiebreak (games as black)
    await client.query(`
      UPDATE tournament_participants SET tiebreak = tiebreak + 1 WHERE tournament_id = $1 AND user_id = $2
    `, [tournamentId, blackId]);

    // Emit leaderboard update
    const { getIo } = require('./socketServer');
    const io = getIo();
    if (io) {
      io.to(`lobby_${tournamentId}`).emit('leaderboard_updated', { tournamentId });
    }

    // Auto re-enter players into the queue if the tournament is still active
    const tResult = await client.query(`SELECT status FROM tournaments WHERE id = $1`, [tournamentId]);
    if (tResult.rows.length > 0 && tResult.rows[0].status === 'active') {
      joinTournamentQueue(tournamentId, whiteId);
      joinTournamentQueue(tournamentId, blackId);
    }

  } catch (err) {
    console.error('Error recording tournament result:', err);
  }
}

module.exports = {
  joinTournamentQueue,
  leaveTournamentQueue,
  initTournamentManager,
  recordTournamentGameResult
};

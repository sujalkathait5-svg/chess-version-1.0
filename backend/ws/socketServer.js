// backend/ws/socketServer.js
const { Server } = require('socket.io');
const { initMatchmaker, handleMatchmaking, handleCancelMatchmaking, removeSocketFromQueue } = require('./matchmaking');
const { createRoom, handleMove, handleResign, handleDrawOffer, handleDisconnect, handleReconnect, getGameBySocket } = require('./gameRooms');
const jwt = require('jsonwebtoken');
const { joinTournamentQueue, leaveTournamentQueue, initTournamentManager, recordTournamentGameResult } = require('./tournamentManager');
const { recordGameAndElo } = require('./gameHistory');

let ioInstance = null;

function initSocket(server) {
  const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:5176',
    'http://localhost:5177',
    'http://localhost:5178',
    'http://localhost:5179',
    'http://localhost:4173',
    'http://localhost:4174',
    'http://localhost:4175',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://127.0.0.1:5175',
    'http://127.0.0.1:4173',
    'http://127.0.0.1:4174',
    'http://127.0.0.1:4175',
  ];

  const io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      credentials: true
    }
  });

  // Start tournament matchmaking loop
  initTournamentManager();

  // Optional authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.user = decoded; // { id, username }
      } catch (err) {
        // Just proceed without user, allow anonymous
        socket.user = { id: `anon_${socket.id}`, username: 'Guest' };
      }
    } else {
      socket.user = { id: `anon_${socket.id}`, username: 'Guest' };
    }
    next();
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id} (User: ${socket.user.username})`);
    
    // Join a personal room for targeted push events (like notifications)
    if (!socket.user.id.startsWith('anon_')) {
      socket.join(`user_${socket.user.id}`);
      
      // Try to reconnect to an active game
      const reconnectedGame = handleReconnect(socket.id, socket.user.id);
      if (reconnectedGame) {
        socket.join(reconnectedGame.roomId);
        socket.emit('game_reconnected', {
          roomId: reconnectedGame.roomId,
          fen: reconnectedGame.chess.fen(),
          whiteTime: reconnectedGame.white.timeRemaining,
          blackTime: reconnectedGame.black.timeRemaining,
          white: { id: reconnectedGame.white.user.id, username: reconnectedGame.white.user.username },
          black: { id: reconnectedGame.black.user.id, username: reconnectedGame.black.user.username },
        });
        socket.to(reconnectedGame.roomId).emit('opponent_reconnected');
      }
    }

    // Tournament Lobbies & Queues
    socket.on('join_tournament_lobby', (data) => {
      socket.join(`lobby_${data.tournamentId}`);
    });

    socket.on('leave_tournament_lobby', (data) => {
      socket.leave(`lobby_${data.tournamentId}`);
      if (!socket.user.id.startsWith('anon_')) {
        leaveTournamentQueue(data.tournamentId, socket.user.id);
      }
    });

    socket.on('join_tournament_queue', (data) => {
      if (!socket.user.id.startsWith('anon_')) {
        joinTournamentQueue(data.tournamentId, socket.user.id);
      }
    });

    socket.on('leave_tournament_queue', (data) => {
      if (!socket.user.id.startsWith('anon_')) {
        leaveTournamentQueue(data.tournamentId, socket.user.id);
      }
    });

    // Matchmaking
    socket.on('find_match', (data) => {
      handleMatchmaking(io, socket, socket.user, data, (matchData) => {
        // matchData = { roomId, timeControl, player1, player2 }
        const { roomId, timeControl, player1, player2 } = matchData;
        
        // Create the active game state
        const game = createRoom(roomId, player1, player2, timeControl);

        // Tell both players the game started
        io.to(roomId).emit('game_started', {
          roomId,
          timeControl,
          white: { id: game.white.user.id, username: game.white.user.username },
          black: { id: game.black.user.id, username: game.black.user.username },
          fen: game.chess.fen(),
          whiteTime: game.white.timeRemaining,
          blackTime: game.black.timeRemaining,
        });
      });
    });

    socket.on('cancel_match', () => {
      handleCancelMatchmaking(socket);
    });

    // Gameplay
    socket.on('make_move', (data) => {
      // data = { roomId, source, target, promotion }
      const game = getGameBySocket(socket.id);
      if (!game || game.roomId !== data.roomId) return;

      const result = handleMove(data.roomId, socket.id, data.source, data.target, data.promotion);
      
      if (result.error) {
        socket.emit('move_error', { error: result.error });
        return;
      }

      // Broadcast move to room
      io.to(data.roomId).emit('move_made', {
        move: result.move,
        fen: result.fen,
        whiteTime: result.whiteTime,
        blackTime: result.blackTime
      });

      if (result.gameOver) {
        io.to(data.roomId).emit('game_over', result.gameOver);
        
        recordGameAndElo(game, result.gameOver);

        if (game.tournamentId) {
          recordTournamentGameResult(game.tournamentId, game.white.user.id, game.black.user.id, result.gameOver.winner);
        }
      }
    });

    socket.on('resign', (data) => {
      const result = handleResign(data.roomId, socket.id);
      if (result) {
        io.to(data.roomId).emit('game_over', result);
        
        const game = getGameBySocket(socket.id);
        recordGameAndElo(game, result);

        if (game && game.tournamentId) {
           recordTournamentGameResult(game.tournamentId, game.white.user.id, game.black.user.id, result.winner);
        }
      }
    });

    socket.on('offer_draw', (data) => {
      const result = handleDrawOffer(data.roomId, socket.id);
      if (result) {
        if (result.accepted) {
          io.to(data.roomId).emit('game_over', result.gameOver);
          const game = getGameBySocket(socket.id);
          recordGameAndElo(game, result.gameOver);
        } else {
          socket.to(data.roomId).emit('draw_offered', { offeredBy: result.offeredBy });
        }
      }
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
      removeSocketFromQueue(socket.id);
      
      const game = getGameBySocket(socket.id);
      if (game) {
        const result = handleDisconnect(socket.id, (abandonmentResult) => {
          // Callback fired after 60s if not reconnected
          io.to(abandonmentResult.roomId).emit('game_over', {
            reason: abandonmentResult.reason,
            winner: abandonmentResult.winner
          });
          recordGameAndElo(game, abandonmentResult);
          if (game.tournamentId) {
            recordTournamentGameResult(game.tournamentId, game.white.user.id, game.black.user.id, abandonmentResult.winner);
          }
        });
        
        if (result) {
          // Notify opponent about disconnection
          io.to(result.roomId).emit('opponent_disconnected', {
            colorDisconnected: result.colorDisconnected
          });
        }
      }
    });
  });

  ioInstance = io;
  return io;
}

function getIo() {
  return ioInstance;
}

module.exports = { initSocket, getIo };

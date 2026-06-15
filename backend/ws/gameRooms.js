// backend/ws/gameRooms.js
const { createGame, validateMove, isGameOver } = require('./moveValidation');

// activeGames = { roomId: { chess, timeControl, white, black, status, lastMoveTime, disconnectTimers, drawOffer } }
const activeGames = {};

function createRoom(roomId, player1, player2, timeControl) {
  // Randomly assign colors
  const p1IsWhite = Math.random() > 0.5;
  const white = p1IsWhite ? player1 : player2;
  const black = p1IsWhite ? player2 : player1;

  const timeSeconds = (timeControl.minutes * 60) || 180;

  activeGames[roomId] = {
    roomId,
    chess: createGame(),
    timeControl,
    white: {
      socketId: white.socket.id,
      user: white.user,
      timeRemaining: timeSeconds,
      connected: true
    },
    black: {
      socketId: black.socket.id,
      user: black.user,
      timeRemaining: timeSeconds,
      connected: true
    },
    status: 'active',
    lastMoveTime: Date.now(),
    disconnectTimers: {},
    drawOffer: null // 'white' or 'black'
  };

  return activeGames[roomId];
}

function getGameBySocket(socketId) {
  for (const roomId in activeGames) {
    const game = activeGames[roomId];
    if (game.white.socketId === socketId || game.black.socketId === socketId) {
      return game;
    }
  }
  return null;
}

function handleMove(roomId, socketId, source, target, promotion) {
  const game = activeGames[roomId];
  if (!game || game.status !== 'active') return { error: 'Game not active' };

  const isWhite = game.white.socketId === socketId;
  const isBlack = game.black.socketId === socketId;

  if (!isWhite && !isBlack) return { error: 'Not a player' };

  const turn = game.chess.turn();
  if ((turn === 'w' && !isWhite) || (turn === 'b' && !isBlack)) {
    return { error: 'Not your turn' };
  }

  const move = validateMove(game.chess, source, target, promotion);
  if (!move) {
    return { error: 'Invalid move' };
  }

  // Clear any draw offers
  game.drawOffer = null;

  // Handle time calculation
  const now = Date.now();
  const timeElapsed = (now - game.lastMoveTime) / 1000;
  game.lastMoveTime = now;

  if (turn === 'w') {
    game.white.timeRemaining -= timeElapsed;
    game.white.timeRemaining += (game.timeControl.increment || 0);
  } else {
    game.black.timeRemaining -= timeElapsed;
    game.black.timeRemaining += (game.timeControl.increment || 0);
  }

  // Check for game over
  let gameOver = isGameOver(game.chess);

  if (game.white.timeRemaining <= 0) {
    gameOver = { reason: 'timeout', winner: 'black' };
    game.white.timeRemaining = 0;
  } else if (game.black.timeRemaining <= 0) {
    gameOver = { reason: 'timeout', winner: 'white' };
    game.black.timeRemaining = 0;
  } else if (gameOver) {
    if (gameOver.reason === 'checkmate') {
      gameOver.winner = turn === 'w' ? 'white' : 'black'; // The player who just moved
    }
  }

  if (gameOver) {
    game.status = 'completed';
    clearDisconnectTimers(game);
  }

  return {
    success: true,
    move,
    fen: game.chess.fen(),
    whiteTime: game.white.timeRemaining,
    blackTime: game.black.timeRemaining,
    gameOver
  };
}

function handleResign(roomId, socketId) {
  const game = activeGames[roomId];
  if (!game || game.status !== 'active') return null;

  const isWhite = game.white.socketId === socketId;
  const isBlack = game.black.socketId === socketId;

  if (!isWhite && !isBlack) return null;

  game.status = 'completed';
  clearDisconnectTimers(game);
  return {
    reason: 'resignation',
    winner: isWhite ? 'black' : 'white'
  };
}

function handleDrawOffer(roomId, socketId) {
  const game = activeGames[roomId];
  if (!game || game.status !== 'active') return null;

  const isWhite = game.white.socketId === socketId;
  const isBlack = game.black.socketId === socketId;

  if (!isWhite && !isBlack) return null;

  const color = isWhite ? 'white' : 'black';
  const opponentColor = isWhite ? 'black' : 'white';

  if (game.drawOffer === opponentColor) {
    // Accept draw
    game.status = 'completed';
    clearDisconnectTimers(game);
    return {
      accepted: true,
      gameOver: { reason: 'agreement', winner: 'draw' }
    };
  } else {
    // Make offer
    game.drawOffer = color;
    return {
      accepted: false,
      offeredBy: color
    };
  }
}

function handleDisconnect(socketId, onAbandonment) {
  const game = getGameBySocket(socketId);
  if (!game || game.status !== 'active') return null;

  const isWhite = game.white.socketId === socketId;
  if (isWhite) game.white.connected = false;
  else game.black.connected = false;

  // Start 60s timer
  const color = isWhite ? 'white' : 'black';
  const opponentColor = isWhite ? 'black' : 'white';

  if (!game.disconnectTimers[color]) {
    game.disconnectTimers[color] = setTimeout(() => {
      if (game.status === 'active') {
        game.status = 'completed';
        onAbandonment({
          roomId: game.roomId,
          reason: 'abandoned',
          winner: opponentColor
        });
      }
    }, 60000);
  }

  return { roomId: game.roomId, colorDisconnected: color };
}

function handleReconnect(socketId, userId) {
  // Find game by userId since socketId changed
  for (const roomId in activeGames) {
    const game = activeGames[roomId];
    if (game.status !== 'active') continue;

    if (game.white.user.id === userId && !game.white.connected) {
      game.white.socketId = socketId;
      game.white.connected = true;
      clearTimeout(game.disconnectTimers['white']);
      delete game.disconnectTimers['white'];
      return game;
    } else if (game.black.user.id === userId && !game.black.connected) {
      game.black.socketId = socketId;
      game.black.connected = true;
      clearTimeout(game.disconnectTimers['black']);
      delete game.disconnectTimers['black'];
      return game;
    }
  }
  return null;
}

function clearDisconnectTimers(game) {
  if (game.disconnectTimers['white']) clearTimeout(game.disconnectTimers['white']);
  if (game.disconnectTimers['black']) clearTimeout(game.disconnectTimers['black']);
  game.disconnectTimers = {};
}

function removeGame(roomId) {
  const game = activeGames[roomId];
  if (game) clearDisconnectTimers(game);
  delete activeGames[roomId];
}

module.exports = {
  createRoom,
  getGameBySocket,
  handleMove,
  handleResign,
  handleDrawOffer,
  handleDisconnect,
  handleReconnect,
  removeGame
};

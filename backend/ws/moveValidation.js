// backend/ws/moveValidation.js
const { Chess } = require('chess.js');

function createGame(fen = undefined) {
  return new Chess(fen);
}

function validateMove(chessInstance, source, target, promotion = 'q') {
  try {
    const moves = chessInstance.moves({ verbose: true });
    const move = moves.find(m => m.from === source && m.to === target && (!m.promotion || m.promotion === promotion));
    if (move) {
      chessInstance.move(move);
      return move;
    }
    return null;
  } catch (e) {
    return null;
  }
}

function isGameOver(chessInstance) {
  if (chessInstance.isCheckmate()) return { reason: 'checkmate' };
  if (chessInstance.isStalemate()) return { reason: 'stalemate' };
  if (chessInstance.isThreefoldRepetition()) return { reason: 'threefold_repetition' };
  if (chessInstance.isInsufficientMaterial()) return { reason: 'insufficient_material' };
  if (chessInstance.isDraw()) return { reason: 'draw' };
  return null;
}

module.exports = {
  createGame,
  validateMove,
  isGameOver
};

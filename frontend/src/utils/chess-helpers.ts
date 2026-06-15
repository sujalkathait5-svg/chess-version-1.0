// src/utils/chess-helpers.ts
import { Chess } from "chess.js";
import { Color, FENChar } from "../chess-logic/models";

const PIECE_VALUES: Record<string, number> = {
  p: 1, P: 1,
  n: 3, N: 3,
  b: 3, B: 3,
  r: 5, R: 5,
  q: 9, Q: 9,
  k: 0, K: 0
};

const INITIAL_COUNTS: Record<string, number> = {
  p: 8, n: 2, b: 2, r: 2, q: 1,
  P: 8, N: 2, B: 2, R: 2, Q: 1,
};

export interface MaterialState {
  whiteScore: number;
  blackScore: number;
  whiteAdvantage: number;
  blackAdvantage: number;
  capturedByWhite: string[]; // array of black pieces ('p', 'n', etc)
  capturedByBlack: string[]; // array of white pieces ('P', 'N', etc)
}

export function calculateMaterial(fen: string): MaterialState {
  const boardPart = fen.split(" ")[0];
  const currentCounts: Record<string, number> = {
    p: 0, n: 0, b: 0, r: 0, q: 0,
    P: 0, N: 0, B: 0, R: 0, Q: 0,
  };

  let whiteScore = 0;
  let blackScore = 0;

  for (const char of boardPart) {
    if (currentCounts[char] !== undefined) {
      currentCounts[char]++;
      if (char === char.toUpperCase()) {
        whiteScore += PIECE_VALUES[char];
      } else {
        blackScore += PIECE_VALUES[char];
      }
    }
  }

  const capturedByWhite: string[] = [];
  const capturedByBlack: string[] = [];

  // White captures Black pieces (lowercase)
  ['q', 'r', 'b', 'n', 'p'].forEach(piece => {
    const missing = INITIAL_COUNTS[piece] - currentCounts[piece];
    for (let i = 0; i < missing; i++) {
      capturedByWhite.push(piece);
    }
  });

  // Black captures White pieces (uppercase)
  ['Q', 'R', 'B', 'N', 'P'].forEach(piece => {
    const missing = INITIAL_COUNTS[piece] - currentCounts[piece];
    for (let i = 0; i < missing; i++) {
      capturedByBlack.push(piece);
    }
  });

  return {
    whiteScore,
    blackScore,
    whiteAdvantage: Math.max(0, whiteScore - blackScore),
    blackAdvantage: Math.max(0, blackScore - whiteScore),
    capturedByWhite,
    capturedByBlack
  };
}

export function getIllegalMoveReasonChessJS(chess: Chess, from: string, to: string): string {
  const piece = chess.get(from as any);
  if (!piece) return "No piece selected.";
  
  const fromColor = piece.color;
  const targetPiece = chess.get(to as any);
  
  if (targetPiece && targetPiece.color === fromColor) {
    const pName = targetPiece.type === 'p' ? 'pawn' : targetPiece.type === 'n' ? 'knight' : targetPiece.type === 'b' ? 'bishop' : targetPiece.type === 'r' ? 'rook' : targetPiece.type === 'q' ? 'queen' : 'king';
    return `You cannot capture your own ${pName}.`;
  }
  
  const inCheckBefore = chess.inCheck();
  
  const fromFile = from.charCodeAt(0) - 97;
  const fromRank = parseInt(from[1]) - 1;
  const toFile = to.charCodeAt(0) - 97;
  const toRank = parseInt(to[1]) - 1;
  
  const dx = toFile - fromFile;
  const dy = toRank - fromRank;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  
  const pieceType = piece.type;
  
  if (pieceType === 'p') {
    const dir = fromColor === 'w' ? 1 : -1;
    if (dy * dir < 0) {
      return "Pawns can only move forward.";
    }
    if (absDx === 1 && absDy === 1 && !targetPiece) {
      return "Pawns can only move diagonally when capturing an opponent's piece.";
    }
    if (absDx === 0 && absDy > 0 && targetPiece) {
      return "Pawns cannot capture pieces directly in front of them.";
    }
    const startRank = fromColor === 'w' ? 1 : 6;
    if (absDy === 2) {
      if (fromRank !== startRank) {
        return "Pawns can only move two squares forward on their first move.";
      }
      const intermediateRank = fromRank + dir;
      const intermediateSquare = String.fromCharCode(97 + fromFile) + (intermediateRank + 1);
      if (chess.get(intermediateSquare as any)) {
        return "The path is blocked by another piece.";
      }
    }
    if (absDx > 1 || absDy > 2 || (absDx > 0 && absDy !== 1)) {
      return "Invalid pawn move. Pawns move one square forward (or two on their first move) and capture one square diagonally forward.";
    }
  } else if (pieceType === 'n') {
    const isLShape = (absDx === 1 && absDy === 2) || (absDx === 2 && absDy === 1);
    if (!isLShape) {
      return "Knights must move in an L-shape (2 squares one way, 1 square perpendicular).";
    }
  } else if (pieceType === 'b') {
    if (absDx !== absDy) {
      return "Bishops can only move diagonally.";
    }
    if (isPathBlockedChessJS(chess, fromFile, fromRank, toFile, toRank)) {
      return "The bishop's path is blocked by another piece.";
    }
  } else if (pieceType === 'r') {
    if (absDx !== 0 && absDy !== 0) {
      return "Rooks can only move horizontally or vertically.";
    }
    if (isPathBlockedChessJS(chess, fromFile, fromRank, toFile, toRank)) {
      return "The rook's path is blocked by another piece.";
    }
  } else if (pieceType === 'q') {
    if (absDx !== absDy && absDx !== 0 && absDy !== 0) {
      return "Queens can only move diagonally, horizontally, or vertically.";
    }
    if (isPathBlockedChessJS(chess, fromFile, fromRank, toFile, toRank)) {
      return "The queen's path is blocked by another piece.";
    }
  } else if (pieceType === 'k') {
    if (absDx > 1 || absDy > 1) {
      const isCastlingAttempt = fromRank === (fromColor === 'w' ? 0 : 7) && fromFile === 4 && absDx === 2 && absDy === 0;
      if (isCastlingAttempt) {
        if (inCheckBefore) {
          return "You cannot castle while in check.";
        }
        return "Castling is invalid. Ensure neither the king nor rook has moved, the path is clear, and the king does not pass through or land on a square attacked by an enemy piece.";
      }
      return "Kings can only move one square in any direction.";
    }
  }
  
  if (inCheckBefore) {
    return "Your King is in check! You must play a move that resolves the check.";
  }
  
  if (pieceType === 'k') {
    return "Kings cannot move into squares controlled by opponent pieces (moving into check).";
  }
  
  return "This move is invalid because it would expose your King to check (the piece is pinned).";
}

function isPathBlockedChessJS(chess: Chess, fromFile: number, fromRank: number, toFile: number, toRank: number): boolean {
  const dx = Math.sign(toFile - fromFile);
  const dy = Math.sign(toRank - fromRank);
  let f = fromFile + dx;
  let r = fromRank + dy;
  while (f !== toFile || r !== toRank) {
    const sq = String.fromCharCode(97 + f) + (r + 1);
    if (chess.get(sq as any)) {
      return true;
    }
    f += dx;
    r += dy;
  }
  return false;
}

export function explainIllegalMoveCustom(
  boardView: (FENChar | null)[][],
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  isInCheck: boolean
): string {
  const piece = boardView[fromX][fromY];
  if (!piece) return "No piece selected.";

  const targetPiece = boardView[toX][toY];
  const isWhite = piece === piece.toUpperCase();
  const pieceColor = isWhite ? Color.White : Color.Black;

  if (targetPiece) {
    const isTargetWhite = targetPiece === targetPiece.toUpperCase();
    const targetColor = isTargetWhite ? Color.White : Color.Black;
    if (pieceColor === targetColor) {
      const pName = targetPiece.toLowerCase() === 'p' ? 'pawn' : targetPiece.toLowerCase() === 'n' ? 'knight' : targetPiece.toLowerCase() === 'b' ? 'bishop' : targetPiece.toLowerCase() === 'r' ? 'rook' : targetPiece.toLowerCase() === 'q' ? 'queen' : 'king';
      return `You cannot capture your own ${pName}.`;
    }
  }

  const dx = toX - fromX;
  const dy = toY - fromY;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  const pieceType = piece.toLowerCase();

  if (pieceType === 'p') {
    const dir = pieceColor === Color.White ? 1 : -1;
    if (dx * dir < 0) {
      return "Pawns can only move forward.";
    }
    if (dy === 0) {
      return "Pawns can only move forward, not sideways.";
    }
    if (absDy === 1 && absDx === 1 && !targetPiece) {
      return "Pawns can only move diagonally when capturing an opponent's piece.";
    }
    if (absDy === 0 && absDx > 0 && targetPiece) {
      return "Pawns cannot capture pieces directly in front of them.";
    }
    const startRow = pieceColor === Color.White ? 1 : 6;
    if (absDx === 2) {
      if (fromX !== startRow) {
        return "Pawns can only move two squares forward on their first move.";
      }
      if (absDy !== 0) {
        return "Pawns cannot move diagonally two squares.";
      }
      const intermediateRow = fromX + dir;
      if (boardView[intermediateRow][fromY]) {
        return "The path is blocked by another piece.";
      }
    }
    if (absDy > 1 || absDx > 2 || (absDy > 0 && absDx !== 1)) {
      return "Invalid pawn move. Pawns move one square forward (or two on their first move) and capture one square diagonally forward.";
    }
  } else if (pieceType === 'n') {
    const isLShape = (absDx === 1 && absDy === 2) || (absDx === 2 && absDy === 1);
    if (!isLShape) {
      return "Knights must move in an L-shape (2 squares in one direction, 1 square perpendicular).";
    }
  } else if (pieceType === 'b') {
    if (absDx !== absDy) {
      return "Bishops can only move diagonally.";
    }
    if (isPathBlockedCustom(boardView, fromX, fromY, toX, toY)) {
      return "The bishop's path is blocked by another piece.";
    }
  } else if (pieceType === 'r') {
    if (absDx !== 0 && absDy !== 0) {
      return "Rooks can only move horizontally or vertically.";
    }
    if (isPathBlockedCustom(boardView, fromX, fromY, toX, toY)) {
      return "The rook's path is blocked by another piece.";
    }
  } else if (pieceType === 'q') {
    if (absDx !== absDy && absDx !== 0 && absDy !== 0) {
      return "Queens can only move diagonally, horizontally, or vertically.";
    }
    if (isPathBlockedCustom(boardView, fromX, fromY, toX, toY)) {
      return "The queen's path is blocked by another piece.";
    }
  } else if (pieceType === 'k') {
    if (absDx > 1 || absDy > 1) {
      const isCastlingAttempt = fromX === (pieceColor === Color.White ? 0 : 7) && fromY === 4 && absDy === 2 && absDx === 0;
      if (isCastlingAttempt) {
        if (isInCheck) {
          return "You cannot castle while in check.";
        }
        return "Castling is invalid. Ensure neither the king nor rook has moved, the path is clear, and the king does not pass through or land on a square attacked by an enemy piece.";
      }
      return "Kings can only move one square in any direction.";
    }
  }

  if (isInCheck) {
    return "Your King is in check! You must play a move that resolves the check.";
  }

  if (pieceType === 'k') {
    return "Kings cannot move into squares controlled by opponent pieces (moving into check).";
  }

  return "This move is invalid because it would expose your King to check (the piece is pinned).";
}

function isPathBlockedCustom(boardView: (FENChar | null)[][], fromX: number, fromY: number, toX: number, toY: number): boolean {
  const dx = Math.sign(toX - fromX);
  const dy = Math.sign(toY - fromY);
  let x = fromX + dx;
  let y = fromY + dy;
  while (x !== toX || y !== toY) {
    if (boardView[x][y]) {
      return true;
    }
    x += dx;
    y += dy;
  }
  return false;
}


import { Piece } from "./pieces/piece";

export const Color = {
    White: 0,
    Black: 1
} as const;
export type Color = typeof Color[keyof typeof Color];

export type Coords = {
    x: number;
    y: number;
}

export const FENChar = {
    WhitePawn: "P",
    WhiteKnight: "N",
    WhiteBishop: "B",
    WhiteRook: "R",
    WhiteQueen: "Q",
    WhiteKing: "K",
    BlackPawn: "p",
    BlackKnight: "n",
    BlackBishop: "b",
    BlackRook: "r",
    BlackQueen: "q",
    BlackKing: "k"
} as const;
export type FENChar = typeof FENChar[keyof typeof FENChar];

export const pieceImagePaths: Readonly<Record<FENChar, string>> = {
    [FENChar.WhitePawn]: "/assets/pieces/piece folder 2/white pawn.svg",
    [FENChar.WhiteKnight]: "/assets/pieces/piece folder 2/white knight.svg",
    [FENChar.WhiteBishop]: "/assets/pieces/piece folder 2/white bishop.svg",
    [FENChar.WhiteRook]: "/assets/pieces/piece folder 2/white rook.svg",
    [FENChar.WhiteQueen]: "/assets/pieces/piece folder 2/white queen.svg",
    [FENChar.WhiteKing]: "/assets/pieces/piece folder 2/white king.svg",
    [FENChar.BlackPawn]: "/assets/pieces/piece folder 2/black pawn.svg",
    [FENChar.BlackKnight]: "/assets/pieces/piece folder 2/black knight.svg",
    [FENChar.BlackBishop]: "/assets/pieces/piece folder 2/black bishop.svg",
    [FENChar.BlackRook]: "/assets/pieces/piece folder 2/black rook.svg",
    [FENChar.BlackQueen]: "/assets/pieces/piece folder 2/black queen.svg",
    [FENChar.BlackKing]: "/assets/pieces/piece folder 2/black king.svg"
}

export type SafeSquares = Map<string, Coords[]>;

export const MoveType = {
    Capture: 0,
    Castling: 1,
    Promotion: 2,
    Check: 3,
    CheckMate: 4,
    BasicMove: 5
} as const;
export type MoveType = typeof MoveType[keyof typeof MoveType];

export type LastMove = {
    piece: Piece;
    prevX: number;
    prevY: number;
    currX: number;
    currY: number;
    moveType: Set<MoveType>;
}

type KingChecked = {
    isInCheck: true;
    x: number;
    y: number;
}

type KingNotChecked = {
    isInCheck: false;
}

export type CheckState = KingChecked | KingNotChecked;

export type MoveList = ([string, string?])[];

export type GameHistory = {
    lastMove: LastMove | undefined;
    checkState: CheckState;
    board: (FENChar | null)[][];
    fen: string;
}[];

export const columns = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;

export type SelectedSquare = {
    piece: FENChar;
    x: number;
    y: number;
} | {
    piece: null;
};

export type TimeControl = {
    id: string;
    name: string;
    category: "bullet" | "blitz" | "rapid" | "classical";
    minutes: number;
    incrementSeconds: number;
    label: string;
};

export const timeControlsList: TimeControl[] = [
  { id: "1m", name: "1 min", category: "bullet", minutes: 1, incrementSeconds: 0, label: "1 min" },
  { id: "1+1", name: "1 | 1", category: "bullet", minutes: 1, incrementSeconds: 1, label: "1 | 1" },
  { id: "2+1", name: "2 | 1", category: "bullet", minutes: 2, incrementSeconds: 1, label: "2 | 1" },
  { id: "3m", name: "3 min", category: "blitz", minutes: 3, incrementSeconds: 0, label: "3 min" },
  { id: "3+2", name: "3 | 2", category: "blitz", minutes: 3, incrementSeconds: 2, label: "3 | 2" },
  { id: "5m", name: "5 min", category: "blitz", minutes: 5, incrementSeconds: 0, label: "5 min" },
  { id: "10m", name: "10 min", category: "rapid", minutes: 10, incrementSeconds: 0, label: "10 min" },
  { id: "15+10", name: "15 | 10", category: "rapid", minutes: 15, incrementSeconds: 10, label: "15 | 10" },
  { id: "30m", name: "30 min", category: "rapid", minutes: 30, incrementSeconds: 0, label: "30 min" },
];

export type MoveClassification = "brilliant" | "great" | "best" | "excellent" | "good" | "book" | "inaccuracy" | "mistake" | "miss" | "blunder";

export const classificationImagePaths: Readonly<Record<MoveClassification, string>> = {
    brilliant: "/assets/move classification/phpQcwe5E.png",
    great: "/assets/move classification/phpmDwOPG.png",
    best: "/assets/move classification/phpbFKLz5.png",
    excellent: "/assets/move classification/php12KLQL.png",
    good: "/assets/move classification/phpE0gpKi.png",
    book: "/assets/move classification/phpdFgJU0.png",
    inaccuracy: "/assets/move classification/phpStQeGp.png",
    mistake: "/assets/move classification/phpJ6F97j.png",
    miss: "/assets/move classification/phprSK0EW.png",
    blunder: "/assets/move classification/phprZy2C4.png"
};

export type MoveAnalysis = {
    moveIndex: number;
    playedMoveStr: string;
    classification: MoveClassification;
    cpl: number;
    evalBefore: number;
    evalAfter: number;
    bestMoveStr: string;
    continuationLine: string;
    comment: string;
};

export type GameReviewStats = {
    whiteAccuracy: number;
    blackAccuracy: number;
    whiteClassifications: Record<MoveClassification, number>;
    blackClassifications: Record<MoveClassification, number>;
    moveAnalyses: MoveAnalysis[];
    estimatedRatingWhite: number;
    estimatedRatingBlack: number;
};

export type SavedGame = {
    id: string;
    date: string;
    timeControl: string;
    gameMode: "friend" | "computer";
    computerLevel: number | null;
    result: string;
    moves: MoveList;
    pgn: string;
    review: GameReviewStats | null;
    gameHistory: GameHistory;
};

const lichessPieceMap: Record<string, string> = {
  K: "wK", Q: "wQ", R: "wR", B: "wB", N: "wN", P: "wP",
  k: "bK", q: "bQ", r: "bR", b: "bB", n: "bN", p: "bP"
};

export const getPieceImgPath = (piece: string, style: string): string => {
  const pStyle = style || "neo";
  
  if (pStyle === "custom") {
    const customMap: Record<string, string> = {
      P: "wp", N: "wn", B: "wb", R: "wr", Q: "wq", K: "wk",
      p: "bp", n: "bn", b: "bb", r: "br", q: "bq", k: "bk"
    };
    const filename = customMap[piece];
    return `/assets/pieces/piece folder 1/${filename}.png`;
  }
  
  if (pStyle === "classic" || pStyle === "merida" || pStyle === "alpha" || pStyle === "caliente") {
    const filename = lichessPieceMap[piece];
    if (filename) {
      const folder = pStyle === "classic" ? "cburnett" : pStyle;
      return `https://lichess1.org/assets/piece/${folder}/${filename}.svg`;
    }
  }
  
  // Fallback to local neo pieces (in piece folder 2)
  const neoPaths: Record<string, string> = {
    P: "/assets/pieces/piece folder 2/white pawn.svg",
    N: "/assets/pieces/piece folder 2/white knight.svg",
    B: "/assets/pieces/piece folder 2/white bishop.svg",
    R: "/assets/pieces/piece folder 2/white rook.svg",
    Q: "/assets/pieces/piece folder 2/white queen.svg",
    K: "/assets/pieces/piece folder 2/white king.svg",
    p: "/assets/pieces/piece folder 2/black pawn.svg",
    n: "/assets/pieces/piece folder 2/black knight.svg",
    b: "/assets/pieces/piece folder 2/black bishop.svg",
    r: "/assets/pieces/piece folder 2/black rook.svg",
    q: "/assets/pieces/piece folder 2/black queen.svg",
    k: "/assets/pieces/piece folder 2/black king.svg",
  };
  return neoPaths[piece] || "";
};

export type GameEndReason = 
  | 'checkmate' | 'resignation' | 'timeout' 
  | 'stalemate' | 'draw-agreement' 
  | 'repetition' | 'insufficient-material' | 'fifty-move';

export interface GameEndState {
  reason: GameEndReason;
  winner: 'white' | 'black' | null;
  loserSquare: string | null;   // King square of the losing side
  winnerSquare: string | null;  // King square of the winning side
}
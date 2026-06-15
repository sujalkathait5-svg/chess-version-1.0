// frontend/src/contexts/GameContext.tsx
import { createContext, useState, useCallback, useRef, useEffect, type ReactNode } from "react";
import { ChessBoard as ChessBoardClass } from "../chess-logic/chess-board";
import { useSound } from "../hooks/useSound";
import { useTheme } from "../hooks/useTheme";
import { Color, FENChar, type Coords, type CheckState, type LastMove, type MoveList as MoveListType, type GameHistory, type TimeControl, type SavedGame, type GameReviewStats, type GameEndReason, type GameEndState } from "../chess-logic/models";
import { getBestMove, getEvaluation, terminateWorker } from "../services/stockfish";

const MoveType = {
  Capture: 0, Castling: 1, Promotion: 2, Check: 3, CheckMate: 4, BasicMove: 5,
} as const;
type MoveType = typeof MoveType[keyof typeof MoveType];

export interface GameContextType {
  // Board
  boardInstance: ChessBoardClass;
  boardView: (FENChar | null)[][];
  playerColor: typeof Color.White | typeof Color.Black;
  lastMove: LastMove | undefined;
  checkState: CheckState;
  moveList: MoveListType;
  gameHistory: GameHistory;
  gameHistoryPointer: number;
  gameOverMessage: string | undefined;
  gameEndState: GameEndState | null;

  // Selection
  selectedSquare: { x: number; y: number; piece: FENChar } | null;
  pieceSafeSquares: Coords[];
  isPromotionActive: boolean;
  promotionCoords: Coords | null;

  // Game mode
  gameMode: "friend" | "computer";
  computerColor: typeof Color.White | typeof Color.Black | null;
  computerLevel: number | null;
  flipMode: boolean;
  setFlipMode: (v: boolean | ((p: boolean) => boolean)) => void;
  isComputerThinking: boolean;
  hasActiveGame: boolean;

  // Time
  activeTimeControl: TimeControl | null;
  whiteTime: number;
  blackTime: number;
  setWhiteTime: React.Dispatch<React.SetStateAction<number>>;
  setBlackTime: React.Dispatch<React.SetStateAction<number>>;

  // Eval
  realtimeEval: { evaluation: number | null; mate: number | null };

  // Hints
  hintSquares: { from: { x: number; y: number }; to: { x: number; y: number } } | null;
  isHintLoading: boolean;

  // Review
  reviewStats: GameReviewStats | null;
  setReviewStats: React.Dispatch<React.SetStateAction<GameReviewStats | null>>;
  reviewMoveIndex: number;
  setReviewMoveIndex: React.Dispatch<React.SetStateAction<number>>;
  isReviewingWalkthrough: boolean;
  setIsReviewingWalkthrough: React.Dispatch<React.SetStateAction<boolean>>;
  analysisProgress: { completed: number; total: number } | null;
  setAnalysisProgress: React.Dispatch<React.SetStateAction<{ completed: number; total: number } | null>>;

  // Game saved state
  isGameSaved: boolean;
  gameStartTime: number;

  // Saved games
  savedGames: SavedGame[];
  setSavedGames: React.Dispatch<React.SetStateAction<SavedGame[]>>;

  // Actions
  handleSquareClick: (x: number, y: number) => void;
  handlePromotePiece: (piece: FENChar) => void;
  handleClosePromotion: () => void;
  showPreviousPosition: (moveIndex: number) => void;
  handleResign: () => void;
  handleOfferDraw: () => void;
  handleAbort: () => void;
  handleShowHint: () => void;
  handleResetGame: () => void;
  handleUndo: () => void;
  handleRedo: () => void;
  handlePlayComputer: (config: { color: typeof Color.White | typeof Color.Black; level: number; timeControl: TimeControl | null }) => void;
  handlePlayFriend: (config?: { timeControl: TimeControl | null }) => void;
  handleSelectTimeControl: (control: TimeControl) => void;
  handleGameEnd: (reason: GameEndReason, winner: "white" | "black" | null, customBoardView?: (FENChar | null)[][]) => void;

  // Rating
  showGameOverModal: boolean;
  setShowGameOverModal: (v: boolean) => void;
  gameDurationStr: string;
  ratingDeltas: { whiteBefore: number; whiteAfter: number; blackBefore: number; blackAfter: number } | null;
  setRatingDeltas: React.Dispatch<React.SetStateAction<{ whiteBefore: number; whiteAfter: number; blackBefore: number; blackAfter: number } | null>>;

  // Refs
  boardInstanceRef: React.MutableRefObject<ChessBoardClass>;
  gameEndStateRef: React.MutableRefObject<GameEndState | null>;
  timerRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>;
  isGameSavedRef: React.MutableRefObject<boolean>;
  isMountedRef: React.MutableRefObject<boolean>;
  analysisAbortControllerRef: React.MutableRefObject<AbortController | null>;
  isAnalyzingRef: React.MutableRefObject<boolean>;
  boardFocusedRef: React.MutableRefObject<boolean>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { playMoveSound, playSound } = useSound();
  const { autoFlip } = useTheme();

  // Board Instance
  const [boardInstance, setBoardInstance] = useState(() => new ChessBoardClass());
  const [boardView, setBoardView] = useState(() => boardInstance.chessBoardView);
  const [playerColor, setPlayerColor] = useState(() => boardInstance.playerColor);
  const [lastMove, setLastMove] = useState<LastMove | undefined>(() => boardInstance.lastMove);
  const [checkState, setCheckState] = useState<CheckState>(() => boardInstance.checkState);
  const [moveList, setMoveList] = useState<MoveListType>(() => [...boardInstance.moveList]);
  const [gameHistory, setGameHistory] = useState<GameHistory>(() => [...boardInstance.gameHistory]);
  const [gameHistoryPointer, setGameHistoryPointer] = useState(0);
  const [gameOverMessage, setGameOverMessage] = useState<string | undefined>(() => boardInstance.gameOverMessage);
  const [gameEndState, setGameEndState] = useState<GameEndState | null>(null);

  // Selection
  const [selectedSquare, setSelectedSquare] = useState<{ x: number; y: number; piece: FENChar } | null>(null);
  const [pieceSafeSquares, setPieceSafeSquares] = useState<Coords[]>([]);
  const [isPromotionActive, setIsPromotionActive] = useState(false);
  const [promotionCoords, setPromotionCoords] = useState<Coords | null>(null);

  // Game mode
  const [gameMode, setGameMode] = useState<"friend" | "computer">("friend");
  const [computerColor, setComputerColor] = useState<typeof Color.White | typeof Color.Black | null>(null);
  const [computerLevel, setComputerLevel] = useState<number | null>(null);
  const [flipMode, setFlipMode] = useState(false);
  const [isComputerThinking, setIsComputerThinking] = useState(false);
  const [hasActiveGame, setHasActiveGame] = useState(false);

  // Time
  const [activeTimeControl, setActiveTimeControl] = useState<TimeControl | null>(null);
  const [whiteTime, setWhiteTime] = useState(0);
  const [blackTime, setBlackTime] = useState(0);

  // Eval
  const [realtimeEval, setRealtimeEval] = useState<{ evaluation: number | null; mate: number | null }>({ evaluation: 0.0, mate: null });

  // Hints
  const [hintSquares, setHintSquares] = useState<{ from: { x: number; y: number }; to: { x: number; y: number } } | null>(null);
  const [isHintLoading, setIsHintLoading] = useState(false);

  // Review
  const [reviewStats, setReviewStats] = useState<GameReviewStats | null>(null);
  const [reviewMoveIndex, setReviewMoveIndex] = useState(0);
  const [isReviewingWalkthrough, setIsReviewingWalkthrough] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<{ completed: number; total: number } | null>(null);

  // Game saved state
  const [isGameSaved, setIsGameSaved] = useState(false);
  const [gameStartTime, setGameStartTime] = useState(() => Date.now());
  const [gameDurationStr, setGameDurationStr] = useState("0:00");
  const [showGameOverModal, setShowGameOverModal] = useState(false);
  const [ratingDeltas, setRatingDeltas] = useState<{ whiteBefore: number; whiteAfter: number; blackBefore: number; blackAfter: number } | null>(null);

  // Saved games
  const [savedGames, setSavedGames] = useState<SavedGame[]>(() => {
    try {
      const raw = localStorage.getItem("kg_saved_games");
      return JSON.parse(raw ?? 'null') ?? [];
    } catch {
      return [];
    }
  });

  // Refs
  const boardInstanceRef = useRef(boardInstance);
  const gameEndStateRef = useRef<GameEndState | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isGameSavedRef = useRef(false);
  const isMountedRef = useRef(true);
  const analysisAbortControllerRef = useRef<AbortController | null>(null);
  const isAnalyzingRef = useRef(false);
  const boardFocusedRef = useRef(true);
  const whiteLowTimePlayedRef = useRef(false);
  const blackLowTimePlayedRef = useRef(false);

  useEffect(() => { boardInstanceRef.current = boardInstance; }, [boardInstance]);
  useEffect(() => { isGameSavedRef.current = isGameSaved; }, [isGameSaved]);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Persist saved games
  useEffect(() => {
    try { localStorage.setItem("kg_saved_games", JSON.stringify(savedGames)); }
    catch { /* ignore */ }
  }, [savedGames]);

  // King location helper
  const getKingSquare = useCallback((color: "white" | "black", customBoardView?: (FENChar | null)[][]): string | null => {
    const kingChar = color === "white" ? FENChar.WhiteKing : FENChar.BlackKing;
    const currentBoard = customBoardView || boardInstanceRef.current.chessBoardView;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (currentBoard[r][c] === kingChar) {
          return `${String.fromCharCode(97 + c)}${r + 1}`;
        }
      }
    }
    return null;
  }, []);

  // Game end handler
  const handleGameEnd = useCallback((reason: GameEndReason, winner: "white" | "black" | null, customBoardView?: (FENChar | null)[][]) => {
    if (gameEndStateRef.current) return;
    const boardToUse = customBoardView || boardInstanceRef.current.chessBoardView;
    const loserSquare = winner ? getKingSquare(winner === "white" ? "black" : "white", boardToUse) : null;
    const winnerSquare = winner ? getKingSquare(winner, boardToUse) : null;
    const endState: GameEndState = { reason, winner, loserSquare, winnerSquare };
    gameEndStateRef.current = endState;
    setGameEndState(endState);
    if (timerRef.current) clearInterval(timerRef.current);

    let msg = "";
    if (reason === "checkmate") msg = `${winner === "white" ? "White" : "Black"} won by checkmate`;
    else if (reason === "resignation") { const w = winner === "white" ? "White" : "Black"; const l = winner === "white" ? "Black" : "White"; msg = `${l} Resigned → ${w} Wins`; }
    else if (reason === "timeout") msg = `${winner === "white" ? "White" : "Black"} won on time`;
    else if (reason === "stalemate") msg = "Stalemate";
    else if (reason === "draw-agreement") msg = "Draw by agreement";
    else if (reason === "repetition") msg = "Draw due three fold repetition rule";
    else if (reason === "insufficient-material") msg = "Draw due insufficient material";
    else if (reason === "fifty-move") msg = "Draw due fifty move rule";
    setGameOverMessage(msg);
    boardInstanceRef.current.setGameOver(true, msg);
    terminateWorker();

    // Play unified game ending sounds staggered
    playSound("gameEnd");
    setTimeout(() => {
      if (winner === null) {
        playSound("draw");
      } else {
        if (gameMode === "computer") {
          const humanColor = computerColor === Color.White ? Color.Black : Color.White;
          const winnerColor = winner === "white" ? Color.White : Color.Black;
          if (humanColor === winnerColor) {
            playSound("win");
          } else {
            playSound("lose");
          }
        } else {
          // Local/Friend pass-and-play
          playSound("win");
        }
      }
    }, 300);
  }, [getKingSquare, playSound, gameMode, computerColor]);

  // Update board after move
  const updateBoard = useCallback((prevX: number, prevY: number, newX: number, newY: number, promotedPiece: FENChar | null) => {
    if (gameEndStateRef.current !== null || boardInstance.isGameOver) return;
    try {
      const activeColorBeforeMove = boardInstance.playerColor;
      boardInstance.move(prevX, prevY, newX, newY, promotedPiece);
      setBoardView(boardInstance.chessBoardView);
      setPlayerColor(boardInstance.playerColor);
      setLastMove(boardInstance.lastMove);
      setCheckState(boardInstance.checkState);
      setMoveList([...boardInstance.moveList]);
      setGameHistory([...boardInstance.gameHistory]);
      setGameHistoryPointer(boardInstance.gameHistory.length - 1);

      if (boardInstance.gameOverMessage) {
        let reason: GameEndReason = "draw-agreement";
        let winner: "white" | "black" | null = null;
        if (boardInstance.gameOverMessage.includes("checkmate")) { reason = "checkmate"; winner = boardInstance.gameOverMessage.toLowerCase().startsWith("white") ? "white" : "black"; }
        else if (boardInstance.gameOverMessage.includes("Stalemate")) reason = "stalemate";
        else if (boardInstance.gameOverMessage.includes("three fold") || boardInstance.gameOverMessage.includes("repetition")) reason = "repetition";
        else if (boardInstance.gameOverMessage.includes("fifty move")) reason = "fifty-move";
        else if (boardInstance.gameOverMessage.includes("insufficient")) reason = "insufficient-material";
        handleGameEnd(reason, winner, boardInstance.chessBoardView);
      }

      setSelectedSquare(null);
      setPieceSafeSquares([]);
      setIsPromotionActive(false);
      setPromotionCoords(null);

      if (activeTimeControl && activeTimeControl.incrementSeconds > 0) {
        const inc = activeTimeControl.incrementSeconds * 1000;
        if (activeColorBeforeMove === Color.White) setWhiteTime(prev => prev + inc);
        else setBlackTime(prev => prev + inc);
      }

      setHintSquares(null);

      if (boardInstance.lastMove) {
        playMoveSound(boardInstance.lastMove.moveType as unknown as Set<MoveType>);
      }

      if (gameMode === "friend" && autoFlip) {
        setFlipMode(prev => !prev);
      }
    } catch (e) {
      console.error("Move error:", e);
    }
  }, [boardInstance, playMoveSound, activeTimeControl, gameMode, autoFlip, handleGameEnd]);

  // Computer move trigger
  const triggerComputerMove = useCallback(async (
    currentInstance: ChessBoardClass,
    currentFen: string,
    currentCompColor: typeof Color.White | typeof Color.Black,
    level: number
  ) => {
    setIsComputerThinking(true);
    try {
      const bestMove = await getBestMove(currentFen, level, currentCompColor);
      if (!isMountedRef.current) return;
      if (gameEndStateRef.current !== null || boardInstanceRef.current.isGameOver) return;
      if (boardInstanceRef.current === currentInstance && currentInstance.boardAsFEN === currentFen && !currentInstance.isGameOver && currentInstance.playerColor === currentCompColor) {
        updateBoard(bestMove.prevX, bestMove.prevY, bestMove.newX, bestMove.newY, bestMove.promotedPiece);
      }
    } catch (err) {
      if (isMountedRef.current) console.error("Computer play turn failed:", err);
    } finally {
      if (isMountedRef.current) setIsComputerThinking(false);
    }
  }, [updateBoard]);

  // Computer auto-move effect
  useEffect(() => {
    if (gameMode !== "computer" || gameOverMessage !== undefined || boardInstance.isGameOver || gameEndStateRef.current !== null || computerColor === null || playerColor !== computerColor || isComputerThinking) return;
    const timer = setTimeout(() => {
      triggerComputerMove(boardInstance, boardInstance.boardAsFEN, computerColor, computerLevel || 3);
    }, 200);
    return () => clearTimeout(timer);
  }, [playerColor, gameMode, computerColor, computerLevel, gameOverMessage, boardInstance, triggerComputerMove, isComputerThinking]);

  // Real-time eval
  useEffect(() => {
    if (gameOverMessage) return;
    if (gameHistoryPointer !== gameHistory.length - 1) return;
    let isMounted = true;
    const currentFen = boardInstance.boardAsFEN;
    getEvaluation(currentFen, 5).then((res) => {
      if (isMounted) setRealtimeEval({ evaluation: res.evaluation, mate: res.mate });
    });
    return () => { isMounted = false; };
  }, [gameHistoryPointer, gameHistory.length, gameOverMessage, boardInstance]);

  // Timer effect
  useEffect(() => {
    if (gameOverMessage || !activeTimeControl) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      if (playerColor === Color.White) {
        setWhiteTime(prev => {
          if (prev <= 100) { setTimeout(() => handleGameEnd("timeout", "black"), 0); return 0; }
          if (prev > 100 && prev <= 10000 && !whiteLowTimePlayedRef.current) {
            whiteLowTimePlayedRef.current = true;
            playSound("lowTime");
          }
          return prev - 100;
        });
      } else {
        setBlackTime(prev => {
          if (prev <= 100) { setTimeout(() => handleGameEnd("timeout", "white"), 0); return 0; }
          if (prev > 100 && prev <= 10000 && !blackLowTimePlayedRef.current) {
            blackLowTimePlayedRef.current = true;
            playSound("lowTime");
          }
          return prev - 100;
        });
      }
    }, 100);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [playerColor, gameOverMessage, activeTimeControl, handleGameEnd, playSound]);

  // Stagger game over modal
  useEffect(() => {
    if (!gameEndState) return;
    const timer = setTimeout(() => setShowGameOverModal(true), 900);
    return () => clearTimeout(timer);
  }, [gameEndState]);

  // Track game duration
  useEffect(() => {
    if (!gameOverMessage || isGameSavedRef.current) return;
    const durationMs = Date.now() - gameStartTime;
    const totalSeconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    setGameDurationStr(`${minutes}:${seconds < 10 ? "0" : ""}${seconds}`);
  }, [gameOverMessage, gameStartTime]);

  // Square click handler
  const handleSquareClick = useCallback((x: number, y: number) => {
    if (gameOverMessage !== undefined) return;
    if (isPromotionActive) return;
    const isComputerTurn = gameMode === "computer" && computerColor !== null && playerColor === computerColor;
    if (isComputerTurn || isComputerThinking) return;
    if (gameHistoryPointer !== gameHistory.length - 1) return;

    const piece = boardView[x][y];
    if (selectedSquare && pieceSafeSquares.some(c => c.x === x && c.y === y)) {
      const isPawnSelected = selectedSquare.piece === FENChar.WhitePawn || selectedSquare.piece === FENChar.BlackPawn;
      const isPawnOnLastRank = isPawnSelected && (x === 7 || x === 0);
      if (!isPromotionActive && isPawnOnLastRank) {
        setPieceSafeSquares([]);
        setIsPromotionActive(true);
        setPromotionCoords({ x, y });
        return;
      }
      updateBoard(selectedSquare.x, selectedSquare.y, x, y, null);
      return;
    }

    if (!piece) { setSelectedSquare(null); setPieceSafeSquares([]); return; }
    const isWhitePiece = piece === piece.toUpperCase();
    const isWrongColor = (isWhitePiece && playerColor === Color.Black) || (!isWhitePiece && playerColor === Color.White);
    if (isWrongColor) return;
    if (selectedSquare && selectedSquare.x === x && selectedSquare.y === y) { setSelectedSquare(null); setPieceSafeSquares([]); return; }
    setSelectedSquare({ x, y, piece });
    setPieceSafeSquares(boardInstance.safeSquares.get(x + "," + y) || []);
  }, [gameOverMessage, isPromotionActive, gameMode, computerColor, playerColor, isComputerThinking, gameHistoryPointer, gameHistory.length, boardView, selectedSquare, pieceSafeSquares, boardInstance, updateBoard]);

  // Promotion
  const handlePromotePiece = useCallback((piece: FENChar) => {
    if (!promotionCoords || !selectedSquare) return;
    updateBoard(selectedSquare.x, selectedSquare.y, promotionCoords.x, promotionCoords.y, piece);
  }, [promotionCoords, selectedSquare, updateBoard]);

  const handleClosePromotion = useCallback(() => {
    if (promotionCoords && selectedSquare) {
      const queenPiece = playerColor === Color.White ? FENChar.WhiteQueen : FENChar.BlackQueen;
      handlePromotePiece(queenPiece);
    } else {
      setSelectedSquare(null); setPieceSafeSquares([]); setIsPromotionActive(false); setPromotionCoords(null);
    }
  }, [promotionCoords, selectedSquare, playerColor, handlePromotePiece]);

  // Move history navigation
  const showPreviousPosition = useCallback((moveIndex: number) => {
    if (moveIndex < 0 || moveIndex >= gameHistory.length) return;
    const historyItem = gameHistory[moveIndex];
    setBoardView(historyItem.board);
    setLastMove(historyItem.lastMove);
    setCheckState(historyItem.checkState);
    setGameHistoryPointer(moveIndex);
    if (reviewStats) setReviewMoveIndex(moveIndex - 1);
    setSelectedSquare(null); setPieceSafeSquares([]); setIsPromotionActive(false); setPromotionCoords(null);
  }, [gameHistory, reviewStats]);

  // Keyboard nav
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isPromotionActive) {
        if (e.key === "Escape") {
          e.preventDefault();
          const queenPiece = playerColor === Color.White ? FENChar.WhiteQueen : FENChar.BlackQueen;
          handlePromotePiece(queenPiece);
        }
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        if (boardFocusedRef.current) e.preventDefault();
        if (e.key === "ArrowLeft" && gameHistoryPointer > 0) showPreviousPosition(gameHistoryPointer - 1);
        else if (e.key === "ArrowRight" && gameHistoryPointer < gameHistory.length - 1) showPreviousPosition(gameHistoryPointer + 1);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [gameHistoryPointer, gameHistory, showPreviousPosition, isPromotionActive, playerColor, handlePromotePiece]);

  // Reset game states helper
  const resetGameStates = useCallback(() => {
    const freshBoard = new ChessBoardClass();
    setBoardInstance(freshBoard);
    setBoardView(freshBoard.chessBoardView);
    setPlayerColor(freshBoard.playerColor);
    setLastMove(undefined);
    setCheckState(freshBoard.checkState);
    setMoveList([...freshBoard.moveList]);
    setGameHistory([...freshBoard.gameHistory]);
    setGameHistoryPointer(0);
    setGameOverMessage(undefined);
    isGameSavedRef.current = false;
    setIsGameSaved(false);
    setRealtimeEval({ evaluation: 0.0, mate: null });
    setReviewStats(null);
    setReviewMoveIndex(0);
    setIsReviewingWalkthrough(false);
    setShowGameOverModal(false);
    setRatingDeltas(null);
    setGameStartTime(Date.now());
    setHintSquares(null);
    setIsHintLoading(false);
    gameEndStateRef.current = null;
    setGameEndState(null);
    whiteLowTimePlayedRef.current = false;
    blackLowTimePlayedRef.current = false;
  }, []);

  // Action handlers
  const handleResign = useCallback(() => {
    const humanColor = gameMode === "computer" && computerColor !== null ? (computerColor === Color.White ? Color.Black : Color.White) : playerColor;
    const winner = humanColor === Color.White ? "black" : "white";
    handleGameEnd("resignation", winner);
  }, [gameMode, computerColor, playerColor, handleGameEnd]);

  const handleOfferDraw = useCallback(() => { handleGameEnd("draw-agreement", null); }, [handleGameEnd]);
  const handleAbort = useCallback(() => { handleGameEnd("draw-agreement", null); }, [handleGameEnd]);

  const handleShowHint = useCallback(async () => {
    if (gameOverMessage || isHintLoading || isComputerThinking) return;
    setIsHintLoading(true);
    const requestedFen = boardInstance.boardAsFEN;
    const currentInstance = boardInstance;
    try {
      const bestMove = await getBestMove(requestedFen, computerLevel || 3, playerColor);
      if (!isMountedRef.current) return;
      if (bestMove && boardInstanceRef.current === currentInstance && boardInstanceRef.current.boardAsFEN === requestedFen) {
        setHintSquares({ from: { x: bestMove.prevX, y: bestMove.prevY }, to: { x: bestMove.newX, y: bestMove.newY } });
      }
    } catch (err) {
      if (isMountedRef.current) console.error("Hint fetch failed:", err);
    } finally {
      if (isMountedRef.current) setIsHintLoading(false);
    }
  }, [gameOverMessage, isHintLoading, isComputerThinking, boardInstance, computerLevel, playerColor]);

  const handleResetGame = useCallback(() => {
    resetGameStates();
    const newInstance = new ChessBoardClass();
    setBoardInstance(newInstance);
    setBoardView(newInstance.chessBoardView);
    setPlayerColor(newInstance.playerColor);
    setLastMove(undefined);
    setCheckState({ isInCheck: false });
    setMoveList([]);
    setGameHistory(newInstance.gameHistory);
    setGameHistoryPointer(0);
    setGameOverMessage(undefined);
    setSelectedSquare(null); setPieceSafeSquares([]); setIsPromotionActive(false); setPromotionCoords(null);
    setIsComputerThinking(false);
    if (activeTimeControl) { const ms = activeTimeControl.minutes * 60 * 1000; setWhiteTime(ms); setBlackTime(ms); }
    if (gameMode === "computer" && computerColor === Color.White) setFlipMode(true);
    else setFlipMode(false);
  }, [resetGameStates, activeTimeControl, gameMode, computerColor]);

  const handleUndo = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    let success: boolean;
    if (gameMode === "computer") { success = boardInstance.undo() && boardInstance.undo(); }
    else { success = boardInstance.undo(); }
    if (success) {
      setBoardView(boardInstance.chessBoardView);
      setPlayerColor(boardInstance.playerColor);
      setLastMove(boardInstance.lastMove);
      setCheckState(boardInstance.checkState);
      setMoveList([...boardInstance.moveList]);
      setGameHistory([...boardInstance.gameHistory]);
      setGameHistoryPointer(boardInstance.gameHistory.length - 1);
      setGameOverMessage(boardInstance.gameOverMessage);
      if (!boardInstance.gameOverMessage) { setGameEndState(null); gameEndStateRef.current = null; }
      setSelectedSquare(null); setPieceSafeSquares([]); setIsPromotionActive(false); setPromotionCoords(null);
      setShowGameOverModal(false); setRatingDeltas(null);
      isGameSavedRef.current = false; setIsGameSaved(false);
    }
  }, [boardInstance, gameMode]);

  const handleRedo = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    let success: boolean;
    if (gameMode === "computer") { success = boardInstance.redo() && boardInstance.redo(); }
    else { success = boardInstance.redo(); }
    if (success) {
      setBoardView(boardInstance.chessBoardView);
      setPlayerColor(boardInstance.playerColor);
      setLastMove(boardInstance.lastMove);
      setCheckState(boardInstance.checkState);
      setMoveList([...boardInstance.moveList]);
      setGameHistory([...boardInstance.gameHistory]);
      setGameHistoryPointer(boardInstance.gameHistory.length - 1);
      setGameOverMessage(boardInstance.gameOverMessage);
      if (!boardInstance.gameOverMessage) { setGameEndState(null); gameEndStateRef.current = null; }
      setSelectedSquare(null); setPieceSafeSquares([]); setIsPromotionActive(false); setPromotionCoords(null);
    }
  }, [boardInstance, gameMode]);

  const handlePlayComputer = useCallback((config: { color: typeof Color.White | typeof Color.Black; level: number; timeControl: TimeControl | null }) => {
    resetGameStates();
    setGameMode("computer");
    setComputerColor(config.color);
    setComputerLevel(config.level);
    setIsComputerThinking(false);
    setHasActiveGame(true);
    setActiveTimeControl(config.timeControl);
    const newInstance = new ChessBoardClass();
    setBoardInstance(newInstance);
    setBoardView(newInstance.chessBoardView);
    setPlayerColor(newInstance.playerColor);
    setLastMove(undefined);
    setCheckState({ isInCheck: false });
    setMoveList([]); setGameHistory(newInstance.gameHistory); setGameHistoryPointer(0);
    setGameOverMessage(undefined); setSelectedSquare(null); setPieceSafeSquares([]);
    setIsPromotionActive(false); setPromotionCoords(null);
    if (config.timeControl) { const ms = config.timeControl.minutes * 60 * 1000; setWhiteTime(ms); setBlackTime(ms); }
    else { setWhiteTime(0); setBlackTime(0); }
    if (config.color === Color.White) setFlipMode(true);
    else setFlipMode(false);
    playSound("gameStart");
  }, [resetGameStates, playSound]);

  const handlePlayFriend = useCallback((config?: { timeControl: TimeControl | null }) => {
    resetGameStates();
    const tc = config?.timeControl || null;
    setActiveTimeControl(tc);
    setGameMode("friend");
    setComputerColor(null);
    setComputerLevel(null);
    setHasActiveGame(true);
    const newInstance = new ChessBoardClass();
    setBoardInstance(newInstance);
    setBoardView(newInstance.chessBoardView);
    setPlayerColor(newInstance.playerColor);
    setLastMove(undefined);
    setCheckState({ isInCheck: false });
    setMoveList([]); setGameHistory(newInstance.gameHistory); setGameHistoryPointer(0);
    setGameOverMessage(undefined); setSelectedSquare(null); setPieceSafeSquares([]);
    setIsPromotionActive(false); setPromotionCoords(null);
    setIsComputerThinking(false); setFlipMode(false);
    if (tc) { const ms = tc.minutes * 60 * 1000; setWhiteTime(ms); setBlackTime(ms); }
    else { setWhiteTime(0); setBlackTime(0); }
    playSound("gameStart");
  }, [resetGameStates, playSound]);

  const handleSelectTimeControl = useCallback((control: TimeControl) => {
    handlePlayFriend({ timeControl: control });
  }, [handlePlayFriend]);

  const value: GameContextType = {
    boardInstance, boardView, playerColor, lastMove, checkState, moveList, gameHistory, gameHistoryPointer, gameOverMessage, gameEndState,
    selectedSquare, pieceSafeSquares, isPromotionActive, promotionCoords,
    gameMode, computerColor, computerLevel, flipMode, setFlipMode, isComputerThinking, hasActiveGame,
    activeTimeControl, whiteTime, blackTime, setWhiteTime, setBlackTime,
    realtimeEval,
    hintSquares, isHintLoading,
    reviewStats, setReviewStats, reviewMoveIndex, setReviewMoveIndex, isReviewingWalkthrough, setIsReviewingWalkthrough, analysisProgress, setAnalysisProgress,
    isGameSaved, gameStartTime,
    savedGames, setSavedGames,
    handleSquareClick, handlePromotePiece, handleClosePromotion, showPreviousPosition,
    handleResign, handleOfferDraw, handleAbort, handleShowHint, handleResetGame, handleUndo, handleRedo,
    handlePlayComputer, handlePlayFriend, handleSelectTimeControl, handleGameEnd,
    showGameOverModal, setShowGameOverModal, gameDurationStr, ratingDeltas, setRatingDeltas,
    boardInstanceRef, gameEndStateRef, timerRef, isGameSavedRef, isMountedRef, analysisAbortControllerRef, isAnalyzingRef, boardFocusedRef,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

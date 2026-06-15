import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { ChessBoard as ChessBoardClass } from "./chess-logic/chess-board";
import { Color, FENChar, classificationImagePaths, timeControlsList, getPieceImgPath } from "./chess-logic/models";
import type { Coords, CheckState, LastMove, MoveList as MoveListType, GameHistory, TimeControl, SavedGame, GameReviewStats, GameEndReason, GameEndState } from "./chess-logic/models";
import { ChessBoard } from "./components/ChessBoard";
import { GameSettings } from "./components/GameSettings";
import { MoveList } from "./components/MoveList";
import { ComputerDialog } from "./components/ComputerDialog";
import { FriendDialog } from "./components/FriendDialog";
import { ChessTimer } from "./components/ChessTimer";
import { EvaluationBar } from "./components/EvaluationBar";
import { DashboardHome } from "./components/DashboardHome";
import { GameReviewPanel } from "./components/GameReviewPanel";
import { BoardOverlayBadges } from "./components/BoardOverlayBadges";
import { GameOverModal } from "./components/GameOverModal";
import { getBestMove, getEvaluation, analyzeGame, terminateWorker } from "./services/stockfish";
import { getOpeningName } from "./services/openings";
import { calculateMaterial, explainIllegalMoveCustom } from "./utils/chess-helpers";
import { Trophy, Copy, Download, RefreshCw, ArrowLeft, Settings, LayoutDashboard, Play, Swords, History, BookOpen, TrendingUp, Sun, Moon, Search, FlaskConical, Puzzle, User, AlertTriangle } from "lucide-react";
import { AnalysisBoardPage } from "./pages/AnalysisBoardPage";
import { TournamentsPage } from "./pages/TournamentsPage";
import { PuzzlesPage } from "./pages/PuzzlesPage";
import { OnlinePlayPage } from "./pages/OnlinePlayPage";
import { TournamentLobby } from "./pages/TournamentLobby";
import { ProfilePage } from "./pages/ProfilePage";
import { CustomizationDialog } from "./components/CustomizationDialog";
import { useTheme } from "./hooks/useTheme";
import { useSound } from "./hooks/useSound";
import { Agentation } from "agentation";
import { SoundManager } from "./utils/soundManager";
import { AuthModal } from "./components/AuthModal";
import { authService } from "./services/authService";
import { useAuth } from "./hooks/useAuth";
import { NotificationCenter } from "./components/NotificationCenter";

const MoveType = {
  Capture: 0,
  Castling: 1,
  Promotion: 2,
  Check: 3,
  CheckMate: 4,
  BasicMove: 5,
} as const;
type MoveType = typeof MoveType[keyof typeof MoveType];

const DEFAULT_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2394a3b8'><circle cx='12' cy='12' r='12' fill='%231e293b'/><path d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z' fill='%23475569'/></svg>";

const reconstructGameEndState = (result: string, boardView: (FENChar | null)[][]): GameEndState | null => {
  if (!result) return null;
  const lower = result.toLowerCase();
  let reason: GameEndReason;
  let winner: "white" | "black" | null = null;

  if (lower.includes("checkmate")) {
    reason = "checkmate";
    winner = lower.startsWith("white") ? "white" : "black";
  } else if (lower.includes("resigned") || lower.includes("resignation")) {
    reason = "resignation";
    if (lower.includes("white resigned") || lower.startsWith("white resigned")) {
      winner = "black";
    } else if (lower.includes("black resigned") || lower.startsWith("black resigned")) {
      winner = "white";
    } else {
      winner = lower.includes("white wins") ? "white" : "black";
    }
  } else if (lower.includes("time") || lower.includes("timeout")) {
    reason = "timeout";
    winner = lower.startsWith("white") ? "white" : "black";
  } else if (lower.includes("stalemate")) {
    reason = "stalemate";
  } else if (lower.includes("repetition")) {
    reason = "repetition";
  } else if (lower.includes("insufficient")) {
    reason = "insufficient-material";
  } else if (lower.includes("fifty")) {
    reason = "fifty-move";
  } else if (lower.includes("draw")) {
    reason = "draw-agreement";
  } else {
    return null;
  }

  const getKingSquareFromBoard = (color: "white" | "black"): string | null => {
    const kingChar = color === "white" ? FENChar.WhiteKing : FENChar.BlackKing;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (boardView[r][c] === kingChar) {
          return `${String.fromCharCode(97 + c)}${r + 1}`;
        }
      }
    }
    return null;
  };

  const loserSquare = winner ? getKingSquareFromBoard(winner === "white" ? "black" : "white") : null;
  const winnerSquare = winner ? getKingSquareFromBoard(winner) : null;

  return { reason, winner, loserSquare, winnerSquare };
};

function App() {
  const APP_VERSION = "1.0.0";
  const navigate = useNavigate();
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  // Check version key at startup; clear stale keys if there's a mismatch.
  useEffect(() => {
    try {
      const storedVersion = localStorage.getItem("kg_app_version");
      if (storedVersion !== APP_VERSION) {
        // If there's a version mismatch, we can run migrations or clear stale keys.
        // For now, we update the version key gracefully.
        localStorage.setItem("kg_app_version", APP_VERSION);
      }
    } catch (e) {
      console.warn("localStorage version check failed:", e);
    }
  }, []);

  // Navigation State
  const [view, setView] = useState<"dashboard" | "play" | "review">(() => {
    if (location.pathname === "/play") return "play";
    if (location.pathname === "/review") return "review";
    return "dashboard";
  });
  const [appTheme, setAppTheme] = useState<"dark" | "light">("dark");
  const [userName, setUserName] = useState(() => {
    const stored = localStorage.getItem("kg_user_name");
    return (stored && stored !== "Sujal") ? stored : "Player";
  });
  const [userAvatar, setUserAvatar] = useState(() => localStorage.getItem("kg_user_avatar") || DEFAULT_AVATAR);

  // FIX: Wrap all localStorage.setItem calls to handle QuotaExceededError
  // gracefully. If storage is full the app continues to work — data just
  // isn't persisted for that write.
  const safeLocalStorageSet = (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      if (e instanceof DOMException && e.name === "QuotaExceededError") {
        console.warn(`localStorage quota exceeded — could not save "${key}". Old game data may need clearing.`);
      }
    }
  };

  useEffect(() => {
    safeLocalStorageSet("kg_user_name", userName);
  }, [userName]);

  useEffect(() => {
    safeLocalStorageSet("kg_user_avatar", userAvatar);
  }, [userAvatar]);


  // Local Game History Storage
  // FIX B-013: Wrap JSON.parse in try/catch. If the browser tab was force-closed
  // mid-write, the stored JSON may be truncated/corrupted. Without this guard,
  // JSON.parse throws a SyntaxError and the app renders a blank white screen.
  const [savedGames, setSavedGames] = useState<SavedGame[]>(() => {
    try {
      const raw = localStorage.getItem("kg_saved_games");
      return JSON.parse(raw ?? 'null') ?? [];
    } catch {
      console.warn("kg_saved_games was corrupted — resetting game history.");
      return [];
    }
  });

  // Active Chess Board State
  const [boardInstance, setBoardInstance] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const customFen = params.get("fen");
    const board = new ChessBoardClass();
    if (customFen) {
      try {
        board.loadFEN(customFen);
      } catch (e) { console.warn("Invalid initial FEN parameter", e); }
    }
    return board;
  });
  const [boardView, setBoardView] = useState(() => boardInstance.chessBoardView);
  const [playerColor, setPlayerColor] = useState(() => boardInstance.playerColor);
  const [lastMove, setLastMove] = useState<LastMove | undefined>(() => boardInstance.lastMove);
  const [checkState, setCheckState] = useState<CheckState>(() => boardInstance.checkState);
  const [moveList, setMoveList] = useState<MoveListType>(() => [...boardInstance.moveList]);
  const [gameHistory, setGameHistory] = useState<GameHistory>(() => [...boardInstance.gameHistory]);
  const [gameHistoryPointer, setGameHistoryPointer] = useState(0);
  const [gameOverMessage, setGameOverMessage] = useState<string | undefined>(() => boardInstance.gameOverMessage);
  const [gameEndState, setGameEndState] = useState<GameEndState | null>(null);
  const gameEndStateRef = useRef<GameEndState | null>(null);

  // Time & Clock States
  const [activeTimeControl, setActiveTimeControl] = useState<TimeControl | null>(null);
  const [whiteTime, setWhiteTime] = useState(0);
  const [blackTime, setBlackTime] = useState(0);
  const timerRef = useRef<any | null>(null);
  const boardInstanceRef = useRef(boardInstance);
  useEffect(() => {
    boardInstanceRef.current = boardInstance;
  }, [boardInstance]);

  // Real-time Evaluation State
  const [realtimeEval, setRealtimeEval] = useState<{ evaluation: number | null; mate: number | null }>({ evaluation: 0.0, mate: null });

  // Game Review States
  const [analysisProgress, setAnalysisProgress] = useState<{ completed: number; total: number } | null>(null);
  const [reviewStats, setReviewStats] = useState<GameReviewStats | null>(null);
  const [reviewMoveIndex, setReviewMoveIndex] = useState(0);
  const [isReviewingWalkthrough, setIsReviewingWalkthrough] = useState(false);

  // UI state — from shared contexts
  const ctxTheme = useTheme();
  const ctxSound = useSound();
  const { boardTheme, pieceStyle, showMoveHints, autoFlip, setBoardTheme, setPieceStyle, setAutoFlip } = ctxTheme;
  const { soundEnabled, setSoundEnabled } = ctxSound;
  const [flipMode, setFlipMode] = useState(false);
  const [gameMode, setGameMode] = useState<"friend" | "computer">("friend");
  const [computerColor, setComputerColor] = useState<Color | null>(null);
  const [computerLevel, setComputerLevel] = useState<number | null>(null);
  const [showComputerDialog, setShowComputerDialog] = useState(false);
  const [showFriendDialog, setShowFriendDialog] = useState(false);
  const [isComputerThinking, setIsComputerThinking] = useState(false);

  // Interactive square selections
  const [selectedSquare, setSelectedSquare] = useState<{ x: number; y: number; piece: FENChar } | null>(null);
  const [pieceSafeSquares, setPieceSafeSquares] = useState<Coords[]>([]);
  const [moveError, setMoveError] = useState<string | null>(null);

  useEffect(() => {
    if (!moveError) return;
    const timer = setTimeout(() => {
      setMoveError(null);
    }, 3500);
    return () => clearTimeout(timer);
  }, [moveError]);

  // Promotion handling
  const [isPromotionActive, setIsPromotionActive] = useState(false);
  const [promotionCoords, setPromotionCoords] = useState<Coords | null>(null);

  // Hint system state
  const [hintSquares, setHintSquares] = useState<{ from: { x: number; y: number }; to: { x: number; y: number } } | null>(null);
  const [isHintLoading, setIsHintLoading] = useState(false);

  // Helper to locate the king's square on the board
  const getKingSquare = useCallback((color: "white" | "black", customBoardView?: (FENChar | null)[][]): string | null => {
    const kingChar = color === "white" ? FENChar.WhiteKing : FENChar.BlackKing;
    const currentBoard = customBoardView || boardInstanceRef.current.chessBoardView;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (currentBoard[r][c] === kingChar) {
          const fileLetter = String.fromCharCode(97 + c);
          const rankNum = r + 1;
          return `${fileLetter}${rankNum}`;
        }
      }
    }
    return null;
  }, []);

  // Centralized game end handler
  const handleGameEnd = useCallback((reason: GameEndReason, winner: "white" | "black" | null, customBoardView?: (FENChar | null)[][]) => {
    if (gameEndStateRef.current) return; // guard: only fires once per game
    const boardToUse = customBoardView || boardInstanceRef.current.chessBoardView;
    const loserSquare = winner ? getKingSquare(winner === "white" ? "black" : "white", boardToUse) : null;
    const winnerSquare = winner ? getKingSquare(winner, boardToUse) : null;
    const endState: GameEndState = { reason, winner, loserSquare, winnerSquare };
    gameEndStateRef.current = endState;
    setGameEndState(endState);

    // Stop clock timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    // Set legacy gameOverMessage
    let msg = "";
    if (reason === "checkmate") {
      msg = `${winner === "white" ? "White" : "Black"} won by checkmate`;
    } else if (reason === "resignation") {
      const winnerName = winner === "white" ? "White" : "Black";
      const loserName = winner === "white" ? "Black" : "White";
      msg = `${loserName} Resigned → ${winnerName} Wins`;
    } else if (reason === "timeout") {
      msg = `${winner === "white" ? "White" : "Black"} won on time`;
    } else if (reason === "stalemate") {
      msg = "Stalemate";
    } else if (reason === "draw-agreement") {
      msg = "Draw by agreement";
    } else if (reason === "repetition") {
      msg = "Draw due three fold repetition rule";
    } else if (reason === "insufficient-material") {
      msg = "Draw due insufficient material";
    } else if (reason === "fifty-move") {
      msg = "Draw due fifty move rule";
    }
    setGameOverMessage(msg);

    // Sync logical chess board & stop Stockfish worker
    boardInstanceRef.current.setGameOver(true, msg);
    terminateWorker();
  }, [getKingSquare]);

  const isGameSavedRef = useRef(false);
  const [isGameSaved, setIsGameSaved] = useState(false);
  useEffect(() => { isGameSavedRef.current = isGameSaved; }, [isGameSaved]);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const analysisRunIdRef = useRef<string | null>(null);
  const isAnalyzingRef = useRef(false);
  const analysisAbortControllerRef = useRef<AbortController | null>(null);
  const [hasActiveGame, setHasActiveGame] = useState(false);

  // Auth context for syncing auth state
  const authContext = useAuth();

  // Persistent Ratings & Game Settings States
  const [userRating, setUserRating] = useState(() => Number(localStorage.getItem("kg_user_rating") || "1200"));
  const userRatingRef = useRef(userRating);
  useEffect(() => { userRatingRef.current = userRating; }, [userRating]);
  const [friendWhiteRating, setFriendWhiteRating] = useState(() => Number(localStorage.getItem("kg_friend_white_rating") || "1200"));
  const [friendBlackRating, setFriendBlackRating] = useState(() => Number(localStorage.getItem("kg_friend_black_rating") || "1200"));
  const [highestRating, setHighestRating] = useState(() => Number(localStorage.getItem("kg_highest_rating") || "1200"));
  const highestRatingRef = useRef(highestRating);
  useEffect(() => { highestRatingRef.current = highestRating; }, [highestRating]);
  const [showGameOverModal, setShowGameOverModal] = useState(false);
  const [showCustomizationDialog, setShowCustomizationDialog] = useState(false);
  const [gameStartTime, setGameStartTime] = useState(() => Date.now());
  const [gameDurationStr, setGameDurationStr] = useState("0:00");
  const [ratingDeltas, setRatingDeltas] = useState<{
    whiteBefore: number;
    whiteAfter: number;
    blackBefore: number;
    blackAfter: number;
  } | null>(null);

  // Sync Ratings to LocalStorage (themes/sound handled by ThemeContext/SoundContext)
  useEffect(() => { safeLocalStorageSet("kg_user_rating", userRating.toString()); }, [userRating]);
  useEffect(() => { safeLocalStorageSet("kg_friend_white_rating", friendWhiteRating.toString()); }, [friendWhiteRating]);
  useEffect(() => { safeLocalStorageSet("kg_friend_black_rating", friendBlackRating.toString()); }, [friendBlackRating]);
  useEffect(() => { safeLocalStorageSet("kg_highest_rating", highestRating.toString()); }, [highestRating]);

  // Sync Saved Games to Local Storage
  useEffect(() => {
    safeLocalStorageSet("kg_saved_games", JSON.stringify(savedGames));
  }, [savedGames]);

  // Synchronize preferences to cloud on change
  useEffect(() => {
    if (currentUser) {
      authService.savePreferences({
        boardTheme,
        pieceStyle,
        soundEnabled,
        moveHints: showMoveHints,
        autoFlip
      }).catch(console.error);
    }
  }, [currentUser, boardTheme, pieceStyle, soundEnabled, showMoveHints, autoFlip]);

  // Synchronize avatar to cloud on change
  useEffect(() => {
    if (currentUser && userAvatar && userAvatar !== currentUser.avatarUrl) {
      authService.updateAvatar(userAvatar)
        .then(() => {
          setCurrentUser(prev => prev ? { ...prev, avatarUrl: userAvatar } : null);
        })
        .catch(console.error);
    }
  }, [userAvatar, currentUser]);

  // Sound playback utility - must be before effects that use it
  const soundManagerRef = useMemo(() => ({ current: new SoundManager(!soundEnabled) }), []);

  // Sync view state with URL path changes
  useEffect(() => {
    if (location.pathname === "/") setView("dashboard");
    else if (location.pathname === "/play") setView("play");
    else if (location.pathname === "/review") setView("review");
  }, [location.pathname]);

  // Restore session on mount
  useEffect(() => {
    authService.getMe().then((user) => {
      setCurrentUser(user);
      if (user.username) setUserName(user.username);
      if (user.avatarUrl) setUserAvatar(user.avatarUrl);
      if (user.preferences) {
        if (user.preferences.boardTheme) ctxTheme.setBoardTheme(user.preferences.boardTheme);
        if (user.preferences.pieceStyle) ctxTheme.setPieceStyle(user.preferences.pieceStyle);
        if (user.preferences.soundEnabled !== undefined) {
          ctxSound.setSoundEnabled(user.preferences.soundEnabled);
          soundManagerRef.current?.setMuted(!user.preferences.soundEnabled);
        }
        if (user.preferences.moveHints !== undefined) ctxTheme.setShowMoveHints(user.preferences.moveHints);
        if (user.preferences.autoFlip !== undefined) ctxTheme.setAutoFlip(user.preferences.autoFlip);
      }
      
      // Fetch matches from server
      authService.getGames().then((serverGames) => {
        setSavedGames(serverGames || []);
      });
    }).catch(() => {
      // Not logged in — that's fine
    });
  }, []);

  // Login handler
  const handleLoginSuccess = (user: any) => {
    setCurrentUser(user);
    authContext.handleLoginSuccess(user);
    if (user.username) setUserName(user.username);
    if (user.avatarUrl) setUserAvatar(user.avatarUrl);
    if (user.preferences) {
      if (user.preferences.boardTheme) ctxTheme.setBoardTheme(user.preferences.boardTheme);
      if (user.preferences.pieceStyle) ctxTheme.setPieceStyle(user.preferences.pieceStyle);
      if (user.preferences.soundEnabled !== undefined) {
        ctxSound.setSoundEnabled(user.preferences.soundEnabled);
        soundManagerRef.current?.setMuted(!user.preferences.soundEnabled);
      }
      if (user.preferences.moveHints !== undefined) ctxTheme.setShowMoveHints(user.preferences.moveHints);
      if (user.preferences.autoFlip !== undefined) ctxTheme.setAutoFlip(user.preferences.autoFlip);
    }

    // Trigger migration of local games!
    triggerLocalStorageMigration(user);
  };

  // Local storage migration helper
  const triggerLocalStorageMigration = async (user: any) => {
    try {
      const raw = localStorage.getItem("kg_saved_games");
      if (!raw) return;
      
      const localGames = JSON.parse(raw);
      if (!Array.isArray(localGames) || localGames.length === 0) return;
      
      console.log(`Migrating ${localGames.length} local games to the database...`);
      
      for (const game of localGames) {
        const isCpu = game.gameMode === "computer";
        const isWhiteW = game.result.toLowerCase().includes("white won") || game.result.toLowerCase().includes("white wins");
        const isDrawW = game.result.toLowerCase().includes("draw") || game.result.toLowerCase().includes("stalemate") || game.result.toLowerCase().includes("repetition");
        
        const whitePlayerId = isCpu
          ? (game.computerColor === Color.White ? `stockfish_level_${game.computerLevel}` : user.id)
          : user.id;
        const blackPlayerId = isCpu
          ? (game.computerColor === Color.Black ? `stockfish_level_${game.computerLevel}` : user.id)
          : "friend_guest";

        const body = {
          gameId: game.id || `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          whitePlayerId,
          blackPlayerId,
          mode: isCpu ? "vs_ai" : "vs_friend",
          timeControl: game.timeControlObj || null,
          result: isDrawW ? "draw" : (isWhiteW ? "white" : "black"),
          termination: reconstructGameEndState(game.result, boardView)?.reason || "checkmate",
          opening: {
            eco: game.opening?.eco || "C00",
            name: game.opening?.name || getOpeningName(game.moves.map((m: any) => m[0])) || "Opening",
            ply: game.opening?.ply || game.moves.length
          },
          moves: game.moves.map((m: any, idx: number) => ({
            san: m[0],
            uci: m[1] || "",
            fen: game.gameHistory?.[idx + 1]?.fen || "",
            clock: 0
          })),
          pgn: game.pgn,
          totalMoves: game.moves.length,
          duration: game.duration || 300,
          playedAt: game.date || new Date().toISOString()
        };
        
        await authService.saveGame(body);
        
        if (game.review) {
          await authService.saveAnalysis(body.gameId, {
            engineVersion: "stockfish-18",
            whiteAccuracy: game.review.whiteAccuracy,
            blackAccuracy: game.review.blackAccuracy,
            whiteEstimatedRating: game.review.estimatedRatingWhite,
            blackEstimatedRating: game.review.estimatedRatingBlack,
            moves: (game.review.moveAnalyses || []).map((m: any) => ({
              moveIndex: m.moveIndex,
              san: m.playedMoveStr,
              fen: "",
              evalBefore: m.evalBefore,
              evalAfter: m.evalAfter,
              bestMove: m.bestMoveStr,
              classification: m.classification,
              cpLoss: m.cpl,
              continuation: m.continuationLine ? [m.continuationLine] : []
            })),
            classificationCounts: {
              white: game.review.whiteClassifications || {},
              black: game.review.blackClassifications || {}
            }
          });
        }
      }
      
      localStorage.removeItem("kg_saved_games");
      const syncedGames = await authService.getGames();
      setSavedGames(syncedGames || []);
    } catch (err) {
      console.error("Migration failed:", err);
    }
  };

  // Settings handlers — delegates to shared contexts; SoundManager sync via useEffect below
  const handleToggleSound = () => {
    ctxSound.toggleSound();
  };

  const handleToggleMoveHints = () => {
    ctxTheme.toggleMoveHints();
  };

  const handleToggleStockfish = (enabled: boolean) => {
    if (enabled) {
      setGameMode("computer");
      if (computerColor === null) {
        setComputerColor(playerColor === Color.White ? Color.Black : Color.White);
      }
      if (computerLevel === null) {
        setComputerLevel(5);
      }
    } else {
      setGameMode("friend");
      setComputerColor(null);
      setComputerLevel(null);
    }
  };


  // Player clock ticking logic
  useEffect(() => {
    if (gameOverMessage || view !== "play" || !activeTimeControl) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      if (playerColor === Color.White) {
        setWhiteTime((prev) => {
          if (prev <= 100) {
            setTimeout(() => handleGameEnd("timeout", "black"), 0);
            return 0;
          }
          return prev - 100;
        });
      } else {
        setBlackTime((prev) => {
          if (prev <= 100) {
            setTimeout(() => handleGameEnd("timeout", "white"), 0);
            return 0;
          }
          return prev - 100;
        });
      }
    }, 100);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [playerColor, gameOverMessage, view, activeTimeControl]);

  // Real-time evaluation background fetch
  // FIX B-014: Guard with gameHistoryPointer so we only evaluate the LIVE
  // position, not every historical board the user browses in move history.
  useEffect(() => {
    if (gameOverMessage || view !== "play") return;
    // Only fetch eval when viewing the current live position.
    if (gameHistoryPointer !== gameHistory.length - 1) return;

    let isMounted = true;
    const currentFen = boardInstance.boardAsFEN;

    getEvaluation(currentFen, 5).then((res) => {
      if (isMounted) {
        setRealtimeEval({ evaluation: res.evaluation, mate: res.mate });
      }
    });

    return () => {
      isMounted = false;
    };
    // Use gameHistoryPointer instead of boardView to avoid firing on nav (B-014).
  }, [gameHistoryPointer, gameHistory.length, gameOverMessage, view, boardInstance]);

  // Generate PGN String
  const generatePGNString = (finalResult: string = "*") => {
    let pgnText = "";
    pgnText += `[Event "Casual Match"]\n`;
    pgnText += `[Site "KingsGauntlet Chess Arena"]\n`;
    pgnText += `[Date "${new Date().toISOString().split("T")[0]}"]\n`;
    pgnText += `[White "${gameMode === "computer" && computerColor === Color.White ? "Stockfish CPU" : "Player White"}"]\n`;
    pgnText += `[Black "${gameMode === "computer" && computerColor === Color.Black ? "Stockfish CPU" : "Player Black"}"]\n`;
    pgnText += `[Result "${finalResult}"]\n\n`;

    moveList.forEach((pair, idx) => {
      pgnText += `${idx + 1}. ${pair[0]} ${pair[1] || ""} `;
    });

    return pgnText.trim();
  };

  const handleCopyPGN = () => {
    const pgn = generatePGNString(gameOverMessage || "*");
    navigator.clipboard.writeText(pgn).then(() => {
      alert("PGN copied to clipboard!");
    });
  };

  const handleDownloadPGN = () => {
    const pgn = generatePGNString(gameOverMessage || "*");
    const blob = new Blob([pgn], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chess_game_${Date.now()}.pgn`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Autosave game to history and calculate rating updates when game finishes
  useEffect(() => {
    // FIX B-003: Check the synchronous ref first. This blocks both invocations
    // of the effect in React StrictMode from executing the rating logic.
    if (!gameOverMessage || isGameSavedRef.current) return;
    // Mark saved SYNCHRONOUSLY via ref before any async state updates.
    isGameSavedRef.current = true;
    setIsGameSaved(true);

    // Calculate duration
    const durationMs = Date.now() - gameStartTime;
    const totalSeconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const durationStr = `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
    setGameDurationStr(durationStr);

    // Determine outcome
    const msgLower = gameOverMessage.toLowerCase();
    const isDrawResult = msgLower.includes("draw") || msgLower.includes("stalemate") || msgLower.includes("agreement") || msgLower.includes("repetition") || msgLower.includes("fifty move") || msgLower.includes("insufficient");
    const isWhiteWinResult = msgLower.startsWith("white won") || msgLower.startsWith("white wins") || msgLower.includes("white wins");

    // Calculate new ratings
    let whiteBefore: number;
    let whiteAfter: number;
    let blackBefore: number;
    let blackAfter: number;

    const outcome = isWhiteWinResult ? 1 : (isDrawResult ? 0.5 : 0);

    // Rating calculation helper
    const calculateElo = (ratingA: number, ratingB: number, outcomeVal: number): number => {
      const K = 32;
      const expected = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
      return Math.round(ratingA + K * (outcomeVal - expected));
    };

    if (gameMode === "computer") {
      const stockfishRating = computerLevel === 6 ? 3200 : 800 + ((computerLevel || 1) - 1) * 400;

      if (computerColor === Color.White) {
        // Human is Black, CPU is White
        whiteBefore = stockfishRating;
        whiteAfter = stockfishRating; // CPU rating doesn't change
        // FIX B-003: Use ref to read the LATEST rating, not the closure-captured stale value
        blackBefore = userRatingRef.current;
        blackAfter = calculateElo(userRatingRef.current, stockfishRating, 1 - outcome);
        const newHighest = Math.max(highestRatingRef.current, blackAfter);
        if (blackAfter !== userRatingRef.current) setUserRating(blackAfter);
        if (newHighest !== highestRatingRef.current) setHighestRating(newHighest);
        setRatingDeltas({ whiteBefore, whiteAfter, blackBefore, blackAfter });
      } else {
        // Human is White, CPU is Black
        blackBefore = stockfishRating;
        blackAfter = stockfishRating; // CPU rating doesn't change
        whiteBefore = userRatingRef.current;
        whiteAfter = calculateElo(userRatingRef.current, stockfishRating, outcome);
        const newHighest = Math.max(highestRatingRef.current, whiteAfter);
        if (whiteAfter !== userRatingRef.current) setUserRating(whiteAfter);
        if (newHighest !== highestRatingRef.current) setHighestRating(newHighest);
        setRatingDeltas({ whiteBefore, whiteAfter, blackBefore, blackAfter });
      }
    } else {
      // Local Friend mode
      const wCur = friendWhiteRating;
      const bCur = friendBlackRating;
      whiteBefore = wCur;
      whiteAfter = calculateElo(wCur, bCur, outcome);
      blackBefore = bCur;
      blackAfter = calculateElo(bCur, wCur, 1 - outcome);
      const newHighest = Math.max(highestRatingRef.current, whiteAfter, blackAfter);
      setFriendWhiteRating(whiteAfter);
      setFriendBlackRating(blackAfter);
      if (newHighest !== highestRatingRef.current) setHighestRating(newHighest);
      setRatingDeltas({ whiteBefore, whiteAfter, blackBefore, blackAfter });
    }


    const pgn = generatePGNString(gameOverMessage);
    const gameId = `game_${Date.now()}`;
    const newGame: SavedGame = {
      id: gameId,
      date: new Date().toISOString(),
      timeControl: activeTimeControl ? activeTimeControl.name : "Casual",
      gameMode,
      computerLevel,
      result: gameOverMessage,
      moves: [...moveList],
      pgn,
      review: null,
      gameHistory: [...gameHistory],
    };

    if (currentUser) {
      const whitePlayerId = gameMode === "computer"
        ? (computerColor === Color.White ? `stockfish_level_${computerLevel}` : currentUser.id)
        : currentUser.id;
      const blackPlayerId = gameMode === "computer"
        ? (computerColor === Color.Black ? `stockfish_level_${computerLevel}` : currentUser.id)
        : "friend_guest";

      const body = {
        gameId,
        whitePlayerId,
        blackPlayerId,
        mode: gameMode === "computer" ? "vs_ai" : "vs_friend",
        timeControl: activeTimeControl ? {
          base: activeTimeControl.minutes * 60,
          increment: activeTimeControl.incrementSeconds || 0
        } : null,
        result: isDrawResult ? "draw" : (isWhiteWinResult ? "white" : "black"),
        termination: reconstructGameEndState(gameOverMessage, boardView)?.reason || "checkmate",
        opening: {
          eco: "C00",
          name: getOpeningName(moveList.map(m => m[0])) || "Opening",
          ply: moveList.length
        },
        moves: moveList.map((m, idx) => ({
          san: m[0],
          uci: m[1] || "",
          fen: gameHistory[idx + 1]?.fen || "",
          clock: 0
        })),
        pgn,
        totalMoves: moveList.length,
        duration: totalSeconds,
        playedAt: newGame.date
      };

      authService.saveGame(body).then((res: any) => {
        const userChange = computerColor === Color.White ? res.eloChange.black : res.eloChange.white;
        setRatingDeltas({
          whiteBefore: computerColor === Color.White ? 800 : currentUser.ratings.vsAI,
          whiteAfter: computerColor === Color.White ? 800 : currentUser.ratings.vsAI + userChange,
          blackBefore: computerColor === Color.White ? currentUser.ratings.vsAI : 800,
          blackAfter: computerColor === Color.White ? currentUser.ratings.vsAI + userChange : 800,
        });

        authService.getMe().then((updatedUser) => {
          setCurrentUser(updatedUser);
          setSavedGames((prev) => [newGame, ...prev]);
        });
      }).catch((err) => {
        console.error("Cloud save failed, saving locally:", err);
        setSavedGames((prev) => [newGame, ...prev]);
      });
    } else {
      setSavedGames((prev) => [newGame, ...prev]);
    }
    // FIX B-003: Rating state values (userRating, friendWhiteRating, etc.) are
    // intentionally EXCLUDED from the dep array. Including them caused the effect
    // to re-run after setUserRating, doubling the Elo calculation. We read the
    // current rating values inside functional updaters instead.
  }, [gameOverMessage, activeTimeControl, gameMode, computerLevel, computerColor, moveList, gameHistory, gameStartTime]);

  // Stagger modal open by badge animation duration (matches CSS animation)
  useEffect(() => {
    if (!gameEndState) return;
    const timer = setTimeout(() => setShowGameOverModal(true), 900);
    return () => clearTimeout(timer);
  }, [gameEndState]);



  // Preload and unlock audio
  useEffect(() => {
    const soundSrcs = [
      "/assets/sound/move.mp3",
      "/assets/sound/promote.mp3",
      "/assets/sound/capture.mp3",
      "/assets/sound/castling.mp3",
      "/assets/sound/checkmate.mp3",
      "/assets/sound/check.mp3",
      "/assets/sound/incorrect-move.mp3",
    ];

    soundManagerRef.current?.preload(soundSrcs);

    const handleInteraction = () => {
      soundManagerRef.current?.unlock().then(() => {
        if (soundManagerRef.current?.isUnlocked()) {
          cleanup();
        }
      });
    };

    const cleanup = () => {
      document.removeEventListener("touchstart", handleInteraction);
      document.removeEventListener("touchend", handleInteraction);
      document.removeEventListener("click", handleInteraction);
    };

    // If not already unlocked (e.g. desktop), listen for user gestures
    if (soundManagerRef.current?.isUnlocked()) {
      // already unlocked
    } else {
      document.addEventListener("touchstart", handleInteraction);
      document.addEventListener("touchend", handleInteraction);
      document.addEventListener("click", handleInteraction);
    }

    // FIX: Re-unlock on tab-return so iOS/Android don't silence us after a switch.
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        soundManagerRef.current?.unlock();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cleanup();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  // Sync soundEnabled state changes to soundManager
  useEffect(() => {
    soundManagerRef.current?.setMuted(!soundEnabled);
  }, [soundEnabled]);

  const playMoveSound = useCallback((moveTypeSet?: Set<MoveType>) => {
    if (!soundEnabled) return;
    let src = "/assets/sound/move.mp3";
    if (moveTypeSet) {
      if (moveTypeSet.has(MoveType.CheckMate)) src = "/assets/sound/checkmate.mp3";
      else if (moveTypeSet.has(MoveType.Check)) src = "/assets/sound/check.mp3";
      else if (moveTypeSet.has(MoveType.Promotion)) src = "/assets/sound/promote.mp3";
      else if (moveTypeSet.has(MoveType.Capture)) src = "/assets/sound/capture.mp3";
      else if (moveTypeSet.has(MoveType.Castling)) src = "/assets/sound/castling.mp3";
    }

    soundManagerRef.current?.play(src);
  }, [soundEnabled]);


  // Sync board logical operations with React states
  const updateBoard = useCallback((
    prevX: number,
    prevY: number,
    newX: number,
    newY: number,
    promotedPiece: FENChar | null
  ) => {
    if (gameEndStateRef.current !== null || boardInstance.isGameOver) {
      return;
    }
    try {
      const activeColorBeforeMove = boardInstance.playerColor;

      boardInstance.move(prevX, prevY, newX, newY, promotedPiece);

      setBoardView(boardInstance.chessBoardView);
      setPlayerColor(boardInstance.playerColor);
      setLastMove(boardInstance.lastMove);
      setCheckState(boardInstance.checkState);
      setMoveList([...boardInstance.moveList]);
      setGameHistory([...boardInstance.gameHistory]);

      const newPointer = boardInstance.gameHistory.length - 1;
      setGameHistoryPointer(newPointer);
      if (boardInstance.gameOverMessage) {
  let reason: GameEndReason;
        let winner: "white" | "black" | null = null;
        if (boardInstance.gameOverMessage.includes("checkmate")) {
          reason = "checkmate";
          winner = boardInstance.gameOverMessage.toLowerCase().startsWith("white") ? "white" : "black";
        } else if (boardInstance.gameOverMessage.includes("Stalemate")) {
          reason = "stalemate";
        } else if (boardInstance.gameOverMessage.includes("three fold") || boardInstance.gameOverMessage.includes("repetition")) {
          reason = "repetition";
        } else if (boardInstance.gameOverMessage.includes("fifty move")) {
          reason = "fifty-move";
        } else if (boardInstance.gameOverMessage.includes("insufficient")) {
          reason = "insufficient-material";
        }
        handleGameEnd(reason, winner, boardInstance.chessBoardView);
      }

      // Reset selection state
      setSelectedSquare(null);
      setPieceSafeSquares([]);
      setIsPromotionActive(false);
      setPromotionCoords(null);

      // Add increment to player clocks
      if (activeTimeControl && activeTimeControl.incrementSeconds > 0) {
        const inc = activeTimeControl.incrementSeconds * 1000;
        if (activeColorBeforeMove === Color.White) {
          setWhiteTime((prev) => prev + inc);
        } else {
          setBlackTime((prev) => prev + inc);
        }
      }

      // Clear hint on every move
      setHintSquares(null);

      // Play sound
      if (boardInstance.lastMove) {
        playMoveSound(boardInstance.lastMove.moveType as unknown as Set<MoveType>);
      }

      // Auto-flip in vs Friend mode if enabled
      if (gameMode === "friend" && autoFlip) {
        setFlipMode(prev => !prev);
      }
    } catch (e) {
      console.error("Move error:", e);
    }
  }, [boardInstance, playMoveSound, activeTimeControl, gameMode, autoFlip]);

  // Trigger Stockfish CPU moves
  const triggerComputerMove = useCallback(async (
    currentInstance: ChessBoardClass,
    currentFen: string,
    currentCompColor: Color,
    level: number
  ) => {
    setIsComputerThinking(true);
    try {
      const bestMove = await getBestMove(currentFen, level, currentCompColor);
      if (!isMountedRef.current) return;
      if (gameEndStateRef.current !== null || boardInstanceRef.current.isGameOver) return;
      if (
        boardInstanceRef.current === currentInstance &&
        currentInstance.boardAsFEN === currentFen &&
        !currentInstance.isGameOver &&
        currentInstance.playerColor === currentCompColor
      ) {
        updateBoard(
          bestMove.prevX,
          bestMove.prevY,
          bestMove.newX,
          bestMove.newY,
          bestMove.promotedPiece
        );
      }
    } catch (err) {
      if (isMountedRef.current) {
        console.error("Computer play turn failed:", err);
      }
    } finally {
      if (isMountedRef.current) {
        setIsComputerThinking(false);
      }
    }
  }, [updateBoard]);

  // Check and execute computer move if it is its turn
  useEffect(() => {
    if (
      gameMode !== "computer" ||
      gameOverMessage !== undefined ||
      boardInstance.isGameOver ||
      gameEndStateRef.current !== null ||
      computerColor === null ||
      playerColor !== computerColor ||
      isComputerThinking
    )
      return;

    if (playerColor !== computerColor) return;

    const timer = setTimeout(() => {
      triggerComputerMove(
        boardInstance,
        boardInstance.boardAsFEN,
        computerColor,
        computerLevel || 3
      );
    }, 200); // 200ms — minimal visual delay while still feeling responsive

    return () => clearTimeout(timer);
  }, [playerColor, gameMode, computerColor, computerLevel, gameOverMessage, boardInstance, triggerComputerMove, view]);

  // Click on chessboard square
  const handleSquareClick = (x: number, y: number) => {
    if (gameOverMessage !== undefined) return;

    // FIX B-007: Block ALL board interaction while the promotion dialog is open.
    // Without this, clicking any legal square would execute a silent null-promotion
    // (which the engine treats as Queen), bypassing the user's choice dialog.
    if (isPromotionActive) return;

    // Prevent human clicking when computer is thinking
    const isComputerTurn =
      gameMode === "computer" && computerColor !== null && playerColor === computerColor;
    if (isComputerTurn || isComputerThinking) return;

    // Prevent moves when reviewing game history
    const isViewingPastState = gameHistoryPointer !== gameHistory.length - 1;
    if (isViewingPastState) return;

    const piece = boardView[x][y];

    // If safe square clicked, execute the move
    if (
      selectedSquare &&
      pieceSafeSquares.some((coords) => coords.x === x && coords.y === y)
    ) {
      const isPawnSelected =
        selectedSquare.piece === FENChar.WhitePawn || selectedSquare.piece === FENChar.BlackPawn;
      const isPawnOnLastRank = isPawnSelected && (x === 7 || x === 0);
      const shouldOpenPromotionDialog = !isPromotionActive && isPawnOnLastRank;

      if (shouldOpenPromotionDialog) {
        setPieceSafeSquares([]);
        setIsPromotionActive(true);
        setPromotionCoords({ x, y });
        return;
      }

      updateBoard(selectedSquare.x, selectedSquare.y, x, y, null);

      if (boardInstance.gameOverMessage && timerRef.current) {
        clearInterval(timerRef.current);
      }
      return;
    }

    if (!piece) {
      if (selectedSquare) {
        const reason = explainIllegalMoveCustom(
          boardView,
          selectedSquare.x,
          selectedSquare.y,
          x,
          y,
          checkState.isInCheck
        );
        setMoveError(reason);
        soundManagerRef.current?.play("/assets/sound/incorrect-move.mp3");
      }
      setSelectedSquare(null);
      setPieceSafeSquares([]);
      return;
    }

    // Restrict selecting opponent's pieces
    const isWhitePiece = piece === piece.toUpperCase();
    const isWrongColor =
      (isWhitePiece && playerColor === Color.Black) ||
      (!isWhitePiece && playerColor === Color.White);
    if (isWrongColor) {
      if (selectedSquare) {
        const reason = explainIllegalMoveCustom(
          boardView,
          selectedSquare.x,
          selectedSquare.y,
          x,
          y,
          checkState.isInCheck
        );
        setMoveError(reason);
        soundManagerRef.current?.play("/assets/sound/incorrect-move.mp3");
      }
      return;
    }

    // Toggle same square click
    if (selectedSquare && selectedSquare.x === x && selectedSquare.y === y) {
      setSelectedSquare(null);
      setPieceSafeSquares([]);
      return;
    }

    setSelectedSquare({ x, y, piece });
    setPieceSafeSquares(boardInstance.safeSquares.get(x + "," + y) || []);
  };

  // Pawn promotion choice
  const handlePromotePiece = (piece: FENChar) => {
    if (!promotionCoords || !selectedSquare) return;
    updateBoard(selectedSquare.x, selectedSquare.y, promotionCoords.x, promotionCoords.y, piece);
  };

  const handleClosePromotion = () => {
    if (promotionCoords && selectedSquare) {
      const queenPiece = playerColor === Color.White ? FENChar.WhiteQueen : FENChar.BlackQueen;
      handlePromotePiece(queenPiece);
    } else {
      setSelectedSquare(null);
      setPieceSafeSquares([]);
      setIsPromotionActive(false);
      setPromotionCoords(null);
    }
  };

  // Auto-promote to Queen if clicked outside the promotion overlay
  useEffect(() => {
    if (!isPromotionActive) return;
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".promotion-overlay")) {
        const queenPiece = playerColor === Color.White ? FENChar.WhiteQueen : FENChar.BlackQueen;
        handlePromotePiece(queenPiece);
      }
    };
    // Defer registration so the click that opened the dialog doesn't trigger it
    const timer = setTimeout(() => {
      document.addEventListener("click", handleDocumentClick);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", handleDocumentClick);
    };
  }, [isPromotionActive, playerColor, handlePromotePiece]);

  // Move history navigation
  const showPreviousPosition = useCallback((moveIndex: number) => {
    if (moveIndex < 0 || moveIndex >= gameHistory.length) return;
    const historyItem = gameHistory[moveIndex];
    setBoardView(historyItem.board);
    setLastMove(historyItem.lastMove);
    setCheckState(historyItem.checkState);
    setGameHistoryPointer(moveIndex);

    // Sync Game Review if it is active
    if (reviewStats) {
      setReviewMoveIndex(moveIndex - 1);
    }

    // Reset selection overlays when browsing history
    setSelectedSquare(null);
    setPieceSafeSquares([]);
    setIsPromotionActive(false);
    setPromotionCoords(null);
  }, [gameHistory, reviewStats]);

  // FIX: boardFocused ref — arrow keys call e.preventDefault() only when the
  // board is the active context. This prevents interference with other focusable
  // elements (text inputs, dialogs) that also use arrow keys.
  const boardFocusedRef = useRef(true);

  // Keyboard navigation for game history & Escape for promotion
  useEffect(() => {
    if (view !== "play" && view !== "review") return;
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
        // FIX B-008: Only preventDefault when the board is the active focus
        // context — prevents blocking arrow navigation in inputs/modals.
        if (boardFocusedRef.current) {
          e.preventDefault();
        }
        if (e.key === "ArrowLeft" && gameHistoryPointer > 0) {
          showPreviousPosition(gameHistoryPointer - 1);
        } else if (e.key === "ArrowRight" && gameHistoryPointer < gameHistory.length - 1) {
          showPreviousPosition(gameHistoryPointer + 1);
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [gameHistoryPointer, gameHistory, showPreviousPosition, view, isPromotionActive, playerColor, handlePromotePiece]);

  // Resign handler
  const handleResign = () => {
    // In computer mode: the human always resigns (opposite of CPU's color)
    // In friend mode: current turn player resigns
    const humanColor = gameMode === "computer" && computerColor !== null
      ? (computerColor === Color.White ? Color.Black : Color.White)
      : playerColor;
    const winnerColorName = humanColor === Color.White ? "Black" : "White";
    const winner = winnerColorName === "White" ? "white" : "black";
    handleGameEnd("resignation", winner);
  };

  // Draw offer / accept handler
  const handleOfferDraw = () => {
    handleGameEnd("draw-agreement", null);
  };

  // Abort handler — ends game without a result
  const handleAbort = () => {
    handleGameEnd("draw-agreement", null);
  };

  // Show Hint handler — fetches best move from engine and highlights squares
  const handleShowHint = async () => {
    if (gameOverMessage || isHintLoading || isComputerThinking) return;
    setIsHintLoading(true);
    const requestedFen = boardInstance.boardAsFEN;
    const currentInstance = boardInstance;
    try {
      const bestMove = await getBestMove(requestedFen, computerLevel || 3, playerColor);
      if (!isMountedRef.current) return;
      if (
        bestMove &&
        boardInstanceRef.current === currentInstance &&
        boardInstanceRef.current.boardAsFEN === requestedFen
      ) {
        setHintSquares({
          from: { x: bestMove.prevX, y: bestMove.prevY },
          to: { x: bestMove.newX, y: bestMove.newY }
        });
      }
    } catch (err) {
      if (isMountedRef.current) {
        console.error("Hint fetch failed:", err);
      }
    } finally {
      if (isMountedRef.current) {
        setIsHintLoading(false);
      }
    }
  };

  // Reset Game States helper
  const resetGameStates = () => {
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

    // FIX B-003: Reset the synchronous ref alongside the state.
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
  };

  const handleUndo = () => {
    // FIX B-004: Synchronously stop the clock BEFORE the undo mutates state.
    // The React clock useEffect cleanup is asynchronous — if we don't kill the
    // interval here, it can fire once more and subtract time from the wrong player.
    if (timerRef.current) clearInterval(timerRef.current);

    let success;
    if (gameMode === "computer") {
      const success1 = boardInstance.undo();
      const success2 = boardInstance.undo();
      success = success1 && success2;
    } else {
      success = boardInstance.undo();
    }

    if (success) {
      setBoardView(boardInstance.chessBoardView);
      setPlayerColor(boardInstance.playerColor);
      setLastMove(boardInstance.lastMove);
      setCheckState(boardInstance.checkState);
      setMoveList([...boardInstance.moveList]);
      setGameHistory([...boardInstance.gameHistory]);
      setGameHistoryPointer(boardInstance.gameHistory.length - 1);
      setGameOverMessage(boardInstance.gameOverMessage);
      if (!boardInstance.gameOverMessage) {
        setGameEndState(null);
        gameEndStateRef.current = null;
      }
      setSelectedSquare(null);
      setPieceSafeSquares([]);
      setIsPromotionActive(false);
      setPromotionCoords(null);
      setShowGameOverModal(false);
      setRatingDeltas(null);
      // FIX B-003: Reset both state and ref.
      isGameSavedRef.current = false;
      setIsGameSaved(false);
    }
  };

  const handleRedo = () => {
    // FIX B-004: Same clock-race fix as handleUndo — stop the interval
    // synchronously before the state change triggers re-render and effect cleanup.
    if (timerRef.current) clearInterval(timerRef.current);

    let success;
    if (gameMode === "computer") {
      const success1 = boardInstance.redo();
      const success2 = boardInstance.redo();
      success = success1 && success2;
    } else {
      success = boardInstance.redo();
    }

    if (success) {
      setBoardView(boardInstance.chessBoardView);
      setPlayerColor(boardInstance.playerColor);
      setLastMove(boardInstance.lastMove);
      setCheckState(boardInstance.checkState);
      setMoveList([...boardInstance.moveList]);
      setGameHistory([...boardInstance.gameHistory]);
      setGameHistoryPointer(boardInstance.gameHistory.length - 1);
      setGameOverMessage(boardInstance.gameOverMessage);
      if (!boardInstance.gameOverMessage) {
        setGameEndState(null);
        gameEndStateRef.current = null;
      }
      setSelectedSquare(null);
      setPieceSafeSquares([]);
      setIsPromotionActive(false);
      setPromotionCoords(null);
    }
  };

  // Restart / Reset Game
  const handleResetGame = () => {
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
    setSelectedSquare(null);
    setPieceSafeSquares([]);
    setIsPromotionActive(false);
    setPromotionCoords(null);
    setIsComputerThinking(false);

    // Set clock timers if timed game
    if (activeTimeControl) {
      const ms = activeTimeControl.minutes * 60 * 1000;
      setWhiteTime(ms);
      setBlackTime(ms);
    }

    if (gameMode === "computer" && computerColor === Color.White) {
      setFlipMode(true);
    } else {
      setFlipMode(false);
    }
  };

  const handleTriggerFriendMode = () => {
    resetGameStates();
    setGameMode("friend");
    setComputerColor(null);
    setComputerLevel(null);

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
    setSelectedSquare(null);
    setPieceSafeSquares([]);
    setIsPromotionActive(false);
    setPromotionCoords(null);
    setIsComputerThinking(false);
    setFlipMode(false);

    if (activeTimeControl) {
      const ms = activeTimeControl.minutes * 60 * 1000;
      setWhiteTime(ms);
      setBlackTime(ms);
    }
  };

  const handlePlayComputer = (config: { color: Color; level: number; timeControl: TimeControl | null }) => {
    resetGameStates();
    setGameMode("computer");
    setComputerColor(config.color);
    setComputerLevel(config.level);
    setShowComputerDialog(false);
    setIsComputerThinking(false);
    setHasActiveGame(true);

    // Set time control
    setActiveTimeControl(config.timeControl);

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
    setSelectedSquare(null);
    setPieceSafeSquares([]);
    setIsPromotionActive(false);
    setPromotionCoords(null);

    if (config.timeControl) {
      const ms = config.timeControl.minutes * 60 * 1000;
      setWhiteTime(ms);
      setBlackTime(ms);
    } else {
      setWhiteTime(0);
      setBlackTime(0);
    }

    if (config.color === Color.White) {
      setFlipMode(true);
    } else {
      setFlipMode(false);
    }

    setView("play");
  };

  // Start Casual untimed match or Local match from dialog
  // FIX B-010: Pass the resolved timeControl directly into the reset instead of
  // calling setActiveTimeControl first and then reading state (which is stale).
  const handlePlayFriend = (config?: { timeControl: TimeControl | null }) => {
    resetGameStates();
    const tc = config?.timeControl || null;
    setActiveTimeControl(tc);
    setGameMode("friend");
    setComputerColor(null);
    setComputerLevel(null);
    setShowFriendDialog(false);
    setHasActiveGame(true);
    setView("play");

    // Reset board
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
    setSelectedSquare(null);
    setPieceSafeSquares([]);
    setIsPromotionActive(false);
    setPromotionCoords(null);
    setIsComputerThinking(false);
    setFlipMode(false);

    // Set clocks using the locally resolved tc, not the stale React state.
    if (tc) {
      const ms = tc.minutes * 60 * 1000;
      setWhiteTime(ms);
      setBlackTime(ms);
    } else {
      setWhiteTime(0);
      setBlackTime(0);
    }
  };

  // Select Time Control and Start Play Arena (from Dashboard Grid directly)
  const handleSelectTimeControl = (control: TimeControl) => {
    handlePlayFriend({ timeControl: control });
  };

  const startAnalysis = async (
    fens: string[],
    moves: MoveListType,
    onSuccess: (stats: GameReviewStats) => void
  ) => {
    if (analysisAbortControllerRef.current) {
      analysisAbortControllerRef.current.abort();
    }
    terminateWorker();

    const controller = new AbortController();
    analysisAbortControllerRef.current = controller;
    
    isAnalyzingRef.current = true;
    const analysisId = ++openGameAnalysisIdRef.current;
    
    setAnalysisProgress({ completed: 0, total: fens.length });

    try {
      const stats = await analyzeGame(
        fens,
        moves,
        (comp, tot) => {
          if (!isMountedRef.current) return;
          if (openGameAnalysisIdRef.current !== analysisId) return;
          if (controller.signal.aborted) return;
          setAnalysisProgress({ completed: comp, total: tot });
        },
        controller.signal,
        (incrementalStats) => {
          if (!isMountedRef.current) return;
          if (openGameAnalysisIdRef.current !== analysisId) return;
          if (controller.signal.aborted) return;
          setReviewStats(incrementalStats);
        }
      );

      if (!isMountedRef.current) return;
      if (openGameAnalysisIdRef.current !== analysisId) return;
      if (controller.signal.aborted) return;

      onSuccess(stats);
    } catch (err: any) {
      if (!isMountedRef.current) return;
      if (openGameAnalysisIdRef.current !== analysisId) return;
      if (err.name === "AbortError") {
        console.log("Analysis aborted");
        return;
      }
      console.error("Analysis failed:", err);
    } finally {
      if (isMountedRef.current && openGameAnalysisIdRef.current === analysisId) {
        setAnalysisProgress(null);
        isAnalyzingRef.current = false;
      }
    }
  };

  // Open previously saved game from history
  // FIX B-005: Track a cancellation ID so async analyzeGame results from a
  // previous open-game call are discarded if the user opens a different game.
  const openGameAnalysisIdRef = useRef(0);
  const handleOpenGame = (game: SavedGame, mode: "play" | "review") => {
    // Restore states
    setMoveList(game.moves);
    setGameHistory(game.gameHistory);
    setGameHistoryPointer(game.gameHistory.length - 1);
    setGameOverMessage(game.result);
    setGameMode(game.gameMode);
    setComputerLevel(game.computerLevel);
    setFlipMode(false);
    setHasActiveGame(false);

    // Load last position
    const lastItem = game.gameHistory[game.gameHistory.length - 1];
    setBoardView(lastItem.board);
    setLastMove(lastItem.lastMove);
    setCheckState(lastItem.checkState);

    const endState = reconstructGameEndState(game.result, lastItem.board);
    gameEndStateRef.current = endState;
    setGameEndState(endState);

    setIsGameSaved(true);
    isGameSavedRef.current = true;

    // Re-instantiate the board class pre-seeded with the replayed game's state (GR-026 fix)
    const newBoard = new ChessBoardClass();
    newBoard.loadSavedGame(
      game.gameHistory,
      game.moves,
      game.result
    );
    setBoardInstance(newBoard);

    if (mode === "review") {
      setView("review");
      if (game.review) {
        setReviewStats(game.review);
        setReviewMoveIndex(-1); // Start reviews at index -1
        setIsReviewingWalkthrough(true);
      } else {
        // Trigger manual analysis on unreviewed history match.
        setReviewStats(null);
        setReviewMoveIndex(-1); // Start reviews at index -1
        setIsReviewingWalkthrough(true);

        const fens = game.gameHistory.map((h) => h.fen);
        startAnalysis(fens, game.moves, (stats) => {
          setReviewStats(stats);
          setReviewMoveIndex(-1); // Start reviews at index -1
          setIsReviewingWalkthrough(true);

          // Save back reviewed stats
          setSavedGames((prev) => {
            return prev.map((item) => (item.id === game.id ? { ...item, review: stats } : item));
          });

          if (currentUser) {
            authService.saveAnalysis(game.id, {
              engineVersion: "stockfish-18",
              whiteAccuracy: stats.whiteAccuracy,
              blackAccuracy: stats.blackAccuracy,
              whiteEstimatedRating: stats.estimatedRatingWhite,
              blackEstimatedRating: stats.estimatedRatingBlack,
              moves: stats.moveAnalyses.map((m) => ({
                moveIndex: m.moveIndex,
                san: m.playedMoveStr,
                fen: "",
                evalBefore: m.evalBefore,
                evalAfter: m.evalAfter,
                bestMove: m.bestMoveStr,
                classification: m.classification,
                cpLoss: m.cpl,
                continuation: m.continuationLine ? [m.continuationLine] : []
              })),
              classificationCounts: {
                white: stats.whiteClassifications,
                black: stats.blackClassifications
              }
            }).then(() => {
              authService.getMe().then(updatedUser => {
                setCurrentUser(updatedUser);
              });
            }).catch(console.error);
          }
        });
      }
    } else {
      setView("play");
      setActiveTimeControl(null); // casual replay
    }
  };

  // Clear Saved Matches
  const handleClearHistory = () => {
    if (confirm("Are you sure you want to clear your local game history? This cannot be undone.")) {
      setSavedGames([]);
    }
  };

  // Post game full review analysis orchestrator
  // FIX B-005: Use the same cancellation ID pattern as handleOpenGame to
  // prevent stale results from being applied if the user navigates away.
  const handleStartReviewProcess = async () => {
    // Read final history and moves arrays directly from the mutable boardInstance reference.
    const fens = boardInstanceRef.current.gameHistory.map((h) => h.fen);
    const activeMoves = boardInstanceRef.current.moveList;

    const pgn = generatePGNString(gameOverMessage || "*");

    // Deduplicate analysis trigger: skip if already run for this game PGN or exists in saved matches.
    if (analysisRunIdRef.current === pgn && reviewStats) {
      setView("review");
      setIsReviewingWalkthrough(true);
      setReviewMoveIndex(-1); // Start reviews at index -1
      return;
    }

    const match = savedGames.find(g => g.pgn === pgn && g.review !== null);
    if (match && match.review) {
      setView("review");
      setReviewStats(match.review);
      setIsReviewingWalkthrough(true);
      setReviewMoveIndex(-1); // Start reviews at index -1
      analysisRunIdRef.current = pgn;
      return;
    }

    setView("review");
    analysisRunIdRef.current = pgn;

    startAnalysis(fens, activeMoves, (stats) => {
      // Update the correct saved game in history by matching FENs
      setSavedGames((prev) => {
        return prev.map((item) => {
          const itemFens = item.gameHistory.map(h => h.fen);
          const isMatch = itemFens.length === fens.length && itemFens.every((f, i) => f === fens[i]);
          if (isMatch) {
            return { ...item, review: stats };
          }
          return item;
        });
      });

      // Verify we are still looking at the same game history before updating active review state
      setGameHistory((currHistory) => {
        const currentFens = currHistory.map(h => h.fen);
        const isSameGame = fens.length === currentFens.length && fens.every((f, i) => f === currentFens[i]);
        if (isSameGame) {
          setReviewStats(stats);
          setReviewMoveIndex(-1); // Start reviews at index -1
          setIsReviewingWalkthrough(true);
        }
        return currHistory;
      });
    });
  };

  // Review step walkthrough selector
  // Review step walkthrough selector
  const handleSelectReviewMove = (index: number) => {
    if (index < -1 || index >= (reviewStats?.moveAnalyses.length || 0)) return;
    setReviewMoveIndex(index);
    // showPosition at history index = index + 1 (since 0 is start)
    const historyItem = gameHistory[index + 1];
    if (historyItem) {
      setBoardView(historyItem.board);
      setLastMove(historyItem.lastMove);
      setCheckState(historyItem.checkState);
      setGameHistoryPointer(index + 1);
    }
  };

  const handleExitToDashboard = () => {
    if (analysisAbortControllerRef.current) {
      analysisAbortControllerRef.current.abort();
    }
    terminateWorker();
    setAnalysisProgress(null);
    isAnalyzingRef.current = false;
    setView("dashboard");
  };

  const handleCloseReviewWalkthrough = () => {
    if (analysisAbortControllerRef.current) {
      analysisAbortControllerRef.current.abort();
    }
    terminateWorker();
    setAnalysisProgress(null);
    isAnalyzingRef.current = false;

    setView("play");
    setIsReviewingWalkthrough(false);
    setReviewStats(null);
    // Force a full board class re-instantiation to prevent carrying over review states (GR-027 fix)
    const freshBoard = new ChessBoardClass();
    setBoardInstance(freshBoard);
    // Reset to current board position
    showPreviousPosition(gameHistory.length - 1);
  };

  // Helper to convert MoveList to flat array of SAN moves
  const getFlatMoves = (moves: MoveListType) => {
    const flat: string[] = [];
    moves.forEach((pair) => {
      flat.push(pair[0]);
      if (pair[1]) flat.push(pair[1]);
    });
    return flat;
  };

  const currentOpening = getOpeningName(getFlatMoves(moveList).slice(0, gameHistoryPointer));
  const reviewOpening = reviewStats ? getOpeningName(getFlatMoves(moveList).slice(0, reviewMoveIndex + 1)) : "";

  const reviewBadge = useMemo(() => {
    if (!isReviewingWalkthrough || !reviewStats || reviewStats.moveAnalyses.length === 0) return null;
    if (reviewMoveIndex === -1) return null;
    const analysis = reviewStats.moveAnalyses[reviewMoveIndex];
    if (!analysis) return null;

    const lastM = gameHistory[reviewMoveIndex + 1]?.lastMove;
    if (!lastM) return null;

    return {
      key: `review-badge-${reviewMoveIndex}`,
      x: lastM.currX,
      y: lastM.currY,
      classification: analysis.classification,
      imgSrc: classificationImagePaths[analysis.classification]
    };
  }, [reviewMoveIndex, reviewStats, gameHistory, isReviewingWalkthrough]);

  // Calculate material difference
  const currentFen = isReviewingWalkthrough
    ? (gameHistory[reviewMoveIndex + 1]?.fen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")
    : (gameHistory[gameHistory.length - 1]?.fen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const materialState = calculateMaterial(currentFen);

  return (
    <div className={`app-wrapper ${appTheme === "light" ? "light-theme" : ""}`}>
      {moveError && (
        <div className="invalid-move-toast">
          <AlertTriangle size={16} />
          <span>{moveError}</span>
        </div>
      )}
      {/* Sidebar Navigation */}
      <aside className="app-sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <Trophy size={18} style={{ color: "var(--accent)" }} />
          </div>
          <div className="sidebar-logo-text">
            <h2>Chess Arena</h2>
            <p>Analyze, Learn & Play</p>
          </div>
        </div>

        <nav className="sidebar-menu">
          <button
            className={`sidebar-menu-btn ${location.pathname === "/" ? "active" : ""}`}
            onClick={() => navigate("/")}
          >
            <LayoutDashboard size={16} />
            <span>Dashboard</span>
          </button>
          <button
            className={`sidebar-menu-btn ${location.pathname === "/play" ? "active" : ""}`}
            onClick={() => navigate("/play")}
          >
            <Play size={16} />
            <span>Play Game</span>
          </button>
          <button
            className={`sidebar-menu-btn ${location.pathname === "/review" ? "active" : ""}`}
            onClick={() => {
              if (reviewStats) navigate("/review");
              else alert("Run Game Review on a completed game to analyze positions.");
            }}
          >
            <Swords size={16} />
            <span>Analyze</span>
          </button>

          <button
            className="sidebar-menu-btn"
            onClick={() => {
              setView("dashboard");
              setTimeout(() => {
                const el = document.querySelector(".db-history");
                el?.scrollIntoView({ behavior: "smooth" });
              }, 100);
            }}
          >
            <History size={16} />
            <span>History</span>
          </button>
          <button
            className="sidebar-menu-btn"
            onClick={() => {
              setView("dashboard");
              setTimeout(() => {
                const el = document.querySelector(".openings-card-anchor");
                el?.scrollIntoView({ behavior: "smooth" });
              }, 100);
            }}
          >
            <BookOpen size={16} />
            <span>Openings</span>
          </button>
          <button
            className="sidebar-menu-btn"
            onClick={() => {
              setView("dashboard");
              setTimeout(() => {
                const el = document.querySelector(".stats-card-anchor");
                el?.scrollIntoView({ behavior: "smooth" });
              }, 100);
            }}
          >
            <TrendingUp size={16} />
            <span>Stats</span>
          </button>
          <button className="sidebar-menu-btn" onClick={() => setShowCustomizationDialog(true)}>
            <Settings size={16} />
            <span>Settings</span>
          </button>

          <div className="sidebar-divider" />

          <button
            className={`sidebar-menu-btn ${location.pathname === "/analysis" ? "active" : ""}`}
            onClick={() => navigate("/analysis")}
          >
            <FlaskConical size={16} />
            <span>Board Editor</span>
          </button>
          <button
            className={`sidebar-menu-btn ${location.pathname === "/tournaments" ? "active" : ""}`}
            onClick={() => navigate("/tournaments")}
          >
            <Trophy size={16} />
            <span>Tournaments</span>
          </button>
          <button
            className={`sidebar-menu-btn ${location.pathname === "/puzzles" ? "active" : ""}`}
            onClick={() => navigate("/puzzles")}
          >
            <Puzzle size={16} />
            <span>Puzzles</span>
          </button>
          {currentUser ? (
            <button
              className={`sidebar-menu-btn ${location.pathname === "/profile" ? "active" : ""}`}
              onClick={() => navigate("/profile")}
            >
              <User size={16} />
              <span>Profile</span>
            </button>
          ) : (
            <button
              className="sidebar-menu-btn"
              onClick={() => setShowAuthModal(true)}
            >
              <User size={16} />
              <span>Sign In</span>
            </button>
          )}
        </nav>

        {/* Sidebar promo card removed */}

        <div className="sidebar-footer">
          <div className="theme-toggle-row">
            <span className="theme-toggle-label">Theme</span>
            <div className="theme-toggle-buttons">
              <button
                className={`theme-btn ${appTheme === "dark" ? "active" : ""}`}
                onClick={() => setAppTheme("dark")}
                title="Dark Mode"
              >
                <Moon size={14} />
              </button>
              <button
                className={`theme-btn ${appTheme === "light" ? "active" : ""}`}
                onClick={() => setAppTheme("light")}
                title="Light Mode"
              >
                <Sun size={14} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Pane */}
      <div className="main-content">
        {/* Top Header */}
        <header className="top-header-bar">
          <div className="header-welcome">
            {view === "dashboard" ? (
              <>
                <h1>Welcome, {userName}!</h1>
                <p>Ready for your next match?</p>
              </>
            ) : view === "play" ? (
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <button
                  className="header-action-btn back-btn"
                  onClick={() => setView("dashboard")}
                  title="Back to Dashboard"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "36px",
                    height: "36px",
                    borderRadius: "8px",
                    border: "1px solid var(--glass-border)",
                    background: "rgba(255, 255, 255, 0.05)",
                    color: "var(--text-primary)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    padding: 0
                  }}
                >
                  <ArrowLeft size={16} />
                </button>
                <div>
                  <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Play Arena</h1>
                  <p style={{ margin: "2px 0 0", fontSize: "11px", color: "var(--text-muted)" }}>Challenge the engine or play locally</p>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <button
                  className="header-action-btn back-btn"
                  onClick={() => setView("dashboard")}
                  title="Back to Dashboard"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "36px",
                    height: "36px",
                    borderRadius: "8px",
                    border: "1px solid var(--glass-border)",
                    background: "rgba(255, 255, 255, 0.05)",
                    color: "var(--text-primary)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    padding: 0
                  }}
                >
                  <ArrowLeft size={16} />
                </button>
                <div>
                  <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Game Review</h1>
                  <p style={{ margin: "2px 0 0", fontSize: "11px", color: "var(--text-muted)" }}>Detailed moves and accuracy analysis</p>
                </div>
              </div>
            )}
          </div>

          <div className="header-right">
            <div className="search-container">
              <Search size={14} className="search-icon" />
              <input
                type="text"
                placeholder="Search games..."
                onChange={(e) => {
                  const dbSearch = document.querySelector(".db-search input") as HTMLInputElement;
                  if (dbSearch) {
                    dbSearch.value = e.target.value;
                    dbSearch.dispatchEvent(new Event("input", { bubbles: true }));
                  }
                }}
              />
            </div>



            <div className="profile-row flex-center" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              
              {/* Notifications */}
              {currentUser && <NotificationCenter />}

              <div className="profile-widget" onClick={() => setShowCustomizationDialog(true)} style={{ cursor: "pointer" }}>
                <div className="profile-avatar-wrap">
                  <img
                    src={userAvatar}
                    alt="Profile"
                    className="profile-avatar"
                  />
                  <span className="profile-status-dot" />
                </div>
                <div className="profile-details">
                  <span className="profile-name">{userName}</span>
                  <span className="profile-rating">
                    {highestRating} Rating
                  </span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content Area */}
        <div className="page-container">
          {/* Route-based pages (new architecture) */}
          <Routes>
            <Route path="/analysis" element={<AnalysisBoardPage />} />
            <Route path="/online" element={<OnlinePlayPage />} />
            <Route path="/tournaments" element={<TournamentsPage />} />
            <Route path="/tournaments/:id" element={<TournamentLobby />} />
            <Route path="/puzzles" element={<PuzzlesPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="*" element={null} />
          </Routes>

          {/* Legacy view-state based pages (existing) — only render on root path */}
          {(location.pathname === "/" || location.pathname === "/play" || location.pathname === "/review") && (<>
          {view === "dashboard" && (
            <DashboardHome
              savedGames={savedGames}
              timeControls={timeControlsList}
              onSelectTimeControl={handleSelectTimeControl}
              onSelectCasualPlay={() => setShowFriendDialog(true)}
              onSelectPlayComputer={() => setShowComputerDialog(true)}
              onSelectPlayOnline={() => navigate("/online")}
              onOpenGame={handleOpenGame}
              onClearHistory={handleClearHistory}
              highestRating={highestRating}
              pieceStyle={pieceStyle}
              boardTheme={boardTheme}
              currentUser={currentUser}
              onChallengeFriend={() => {
                setShowFriendDialog(true);
              }}
            />
          )}

          {view === "play" && (
            <div className="view-container">
              <div className="back-bar">
                <button className="back-to-dashboard-btn" onClick={() => setView("dashboard")}>
                  <ArrowLeft size={16} />
                  <span>Back to Dashboard</span>
                </button>
              </div>
              <main className="game-grid">
                {/* Left Column: Chess Board & Real-Time Eval Bar & Timers */}
                <div className="board-col flex-center">

                  {/* Clocks & Board Stack */}
                  <div className="board-game-container">
                    {/* Opponent Info Row (Clocks at top) */}
                    <div className="player-row top-row">
                      <div className="player-info-container">
                        <span className="player-title">
                          {gameMode === "computer"
                            ? `stockfish Lvl ${computerLevel}`
                            : (flipMode ? "Player White" : "Player Black")}
                        </span>
                        <div className="captured-pieces">
                          {(flipMode ? materialState.capturedByWhite : materialState.capturedByBlack).map((p, i) => (
                            <img key={i} src={getPieceImgPath(p, pieceStyle)} className={`captured-piece-img ${p === p.toUpperCase() ? "white-piece" : "black-piece"}`} alt={p} />
                          ))}
                          {(flipMode ? materialState.whiteAdvantage : materialState.blackAdvantage) > 0 && (
                            <span className="material-advantage">
                              +{(flipMode ? materialState.whiteAdvantage : materialState.blackAdvantage)}
                            </span>
                          )}
                        </div>
                      </div>
                      {activeTimeControl && (
                        <ChessTimer
                          timeLeftMs={flipMode ? whiteTime : blackTime}
                          isActive={flipMode ? playerColor === Color.White : playerColor === Color.Black}
                          playerName={flipMode ? "W" : "B"}
                          isLowTime={flipMode ? whiteTime < 15000 : blackTime < 15000}
                        />
                      )}
                    </div>

                    {currentOpening && (
                      <div className="opening-name-badge glass-panel">
                        <span className="opening-label">Opening</span>
                        <span className="opening-value">{currentOpening}</span>
                      </div>
                    )}

                    {/* Board and Eval Bar side by side */}
                    <div className="board-inner-stack">
                      <EvaluationBar
                        evaluation={realtimeEval.evaluation}
                        mate={realtimeEval.mate}
                        flipMode={flipMode}
                      />

                      <div style={{ position: "relative", flex: 1 }}>
                        <ChessBoard
                          key={`board-${gameHistoryPointer}`}
                          boardView={boardView}
                          playerColor={playerColor}
                          selectedSquare={selectedSquare}
                          pieceSafeSquares={showMoveHints ? pieceSafeSquares : []}
                          lastMove={lastMove}
                          checkState={checkState}
                          flipMode={flipMode}
                          isPromotionActive={isPromotionActive}
                          promotionCoords={promotionCoords}
                          onSquareClick={handleSquareClick}
                          onPromotePiece={handlePromotePiece}
                          onClosePromotion={handleClosePromotion}
                          hintSquares={hintSquares}
                          boardTheme={boardTheme}
                          pieceStyle={pieceStyle}
                          isReviewingWalkthrough={isReviewingWalkthrough}
                          overlayChildren={
                            <>
                              {/* Move review badge */}
                              {isReviewingWalkthrough && reviewBadge && (
                                <div
                                  key={reviewBadge.key}
                                  className="review-overlay-highlight"
                                  style={{
                                    bottom: `${flipMode ? (7 - reviewBadge.x) * 12.5 : reviewBadge.x * 12.5}%`,
                                    left: `${flipMode ? (7 - reviewBadge.y) * 12.5 : reviewBadge.y * 12.5}%`,
                                  }}
                                >
                                  <img
                                    src={reviewBadge.imgSrc}
                                    alt={reviewBadge.classification}
                                    className="review-overlay-img"
                                  />
                                </div>
                              )}

                              {/* ── Chess.com style game-over board badges ── */}
                              <BoardOverlayBadges
                                boardView={boardView}
                                flipMode={flipMode}
                                gameEndState={gameEndState}
                                isReviewMode={false}
                                currentReviewIndex={reviewMoveIndex}
                                totalMoves={moveList.length}
                              />
                            </>
                          }
                        />
                      </div>
                    </div>

                    {/* Your Info Row (Clocks at bottom) */}
                    <div className="player-row bottom-row">
                      <div className="player-info-container">
                        <span className="player-title text-indigo-400">
                          {flipMode ? "Player Black" : "Player White"}
                        </span>
                        <div className="captured-pieces">
                          {(!flipMode ? materialState.capturedByWhite : materialState.capturedByBlack).map((p, i) => (
                            <img key={i} src={getPieceImgPath(p, pieceStyle)} className={`captured-piece-img ${p === p.toUpperCase() ? "white-piece" : "black-piece"}`} alt={p} />
                          ))}
                          {(!flipMode ? materialState.whiteAdvantage : materialState.blackAdvantage) > 0 && (
                            <span className="material-advantage">
                              +{!flipMode ? materialState.whiteAdvantage : materialState.blackAdvantage}
                            </span>
                          )}
                        </div>
                      </div>
                      {activeTimeControl && (
                        <ChessTimer
                          timeLeftMs={flipMode ? blackTime : whiteTime}
                          isActive={flipMode ? playerColor === Color.Black : playerColor === Color.White}
                          playerName={flipMode ? "B" : "W"}
                          isLowTime={flipMode ? blackTime < 15000 : whiteTime < 15000}
                        />
                      )}
                    </div>
                  </div>

                </div>

                {/* Right Column: Game Controls, Move List & PGN Exporters */}
                <div className="sidebar-col">
                  <GameSettings
                    gameMode={gameMode}
                    computerColor={computerColor}
                    computerLevel={computerLevel}
                    activeColor={playerColor}
                    soundEnabled={soundEnabled}
                    onToggleSound={() => setSoundEnabled(!soundEnabled)}
                    onFlipBoard={() => setFlipMode(!flipMode)}
                    onResetGame={handleResetGame}
                    onTriggerComputerMode={() => setShowComputerDialog(true)}
                    onTriggerFriendMode={handleTriggerFriendMode}
                    gameOverMessage={gameOverMessage}
                    onResign={handleResign}
                    onOfferDraw={handleOfferDraw}
                    onAbort={handleAbort}
                    onExitMatch={() => setView("dashboard")}
                    autoFlip={autoFlip}
                    onToggleAutoFlip={() => setAutoFlip(!autoFlip)}
                    onShowHint={handleShowHint}
                    isHintLoading={isHintLoading}
                  />

                  {/* PGN Exporters Card */}
                  <div className="pgn-exporter-card glass-panel flex-center">
                    <h4>Export Game</h4>
                    <div className="exporter-buttons">
                      <button className="export-btn" onClick={handleCopyPGN} title="Copy PGN to clipboard">
                        <Copy size={14} />
                        <span>Copy PGN</span>
                      </button>
                      <button className="export-btn" onClick={handleDownloadPGN} title="Download PGN File">
                        <Download size={14} />
                        <span>Download PGN</span>
                      </button>
                    </div>
                  </div>

                  {/* Review Trigger when game finishes */}
                  {gameOverMessage && (
                    <button
                      className="review-game-trigger-btn flex-center"
                      onClick={handleStartReviewProcess}
                    >
                      <Trophy size={16} />
                      <span>Run Game Review</span>
                    </button>
                  )}

                  <MoveList
                    moveList={moveList}
                    gameHistoryPointer={gameHistoryPointer}
                    gameHistoryLength={gameHistory.length}
                    onShowPreviousPosition={showPreviousPosition}
                    onUndo={handleUndo}
                    onRedo={handleRedo}
                    canUndo={boardInstance.canUndo}
                    canRedo={boardInstance.canRedo}
                  />
                </div>
              </main>
            </div>
          )}

          {view === "review" && reviewStats && (
            <div className="view-container">
              <div className="back-bar">
                <button className="back-to-dashboard-btn" onClick={() => setView("dashboard")}>
                  <ArrowLeft size={16} />
                  <span>Back to Dashboard</span>
                </button>
              </div>
              <main className="game-grid">
                {/* Left Column: Board view in Walkthrough */}
                <div className="board-col flex-center">

                  <div className="board-game-container">
                    {/* Opponent info for review */}
                    <div className="player-row top-row">
                      <div className="player-info-container">
                        <span className="player-title">
                          {gameMode === "computer" ? ` stockfishLvl ${computerLevel}` : "Black Player"}
                        </span>
                        <div className="captured-pieces">
                          {materialState.capturedByBlack.map((p, i) => (
                            <img key={i} src={getPieceImgPath(p, pieceStyle)} className={`captured-piece-img ${p === p.toUpperCase() ? "white-piece" : "black-piece"}`} alt={p} />
                          ))}
                          {materialState.blackAdvantage > 0 && (
                            <span className="material-advantage">+{materialState.blackAdvantage}</span>
                          )}
                        </div>
                      </div>
                      <span className="acc-tag-top black">{reviewStats.blackAccuracy}% accuracy</span>
                    </div>

                    {reviewOpening && (
                      <div className="opening-name-badge glass-panel">
                        <span className="opening-label">Opening</span>
                        <span className="opening-value">{reviewOpening}</span>
                      </div>
                    )}

                    {/* Review Chess Board with overlays */}
                    <div className="board-inner-stack">
                      <div style={{ width: 24 }} /> {/* align width of eval bar */}

                      <div style={{ position: "relative", flex: 1 }}>
                        <ChessBoard
                          key={`board-${gameHistoryPointer}`}
                          boardView={boardView}
                          playerColor={playerColor}
                          selectedSquare={null}
                          pieceSafeSquares={[]}
                          lastMove={lastMove}
                          checkState={checkState}
                          flipMode={flipMode}
                          isPromotionActive={false}
                          promotionCoords={null}
                          onSquareClick={() => { }}
                          onPromotePiece={() => { }}
                          onClosePromotion={() => { }}
                          boardTheme={boardTheme}
                          pieceStyle={pieceStyle}
                          reviewBestMove={null}
                          isReviewingWalkthrough={true}
                          overlayChildren={
                            <>
                              {reviewBadge && (
                                <div
                                  key={reviewBadge.key}
                                  className="review-overlay-highlight"
                                  style={{
                                    bottom: `${flipMode ? (7 - reviewBadge.x) * 12.5 : reviewBadge.x * 12.5}%`,
                                    left: `${flipMode ? (7 - reviewBadge.y) * 12.5 : reviewBadge.y * 12.5}%`,
                                  }}
                                >
                                  <img
                                    src={reviewBadge.imgSrc}
                                    alt={reviewBadge.classification}
                                    className="review-overlay-img"
                                  />
                                </div>
                              )}
                              {/* ── Chess.com style game-over board badges ── */}
                              <BoardOverlayBadges
                                boardView={boardView}
                                flipMode={flipMode}
                                gameEndState={gameEndState}
                                isReviewMode={true}
                                currentReviewIndex={reviewMoveIndex}
                                totalMoves={moveList.length}
                              />
                            </>
                          }
                        />
                      </div>
                    </div>

                    {/* Your info for review */}
                    <div className="player-row bottom-row">
                      <div className="player-info-container">
                        <span className="player-title text-indigo-400">White Player</span>
                        <div className="captured-pieces">
                          {materialState.capturedByWhite.map((p, i) => (
                            <img key={i} src={getPieceImgPath(p, pieceStyle)} className={`captured-piece-img ${p === p.toUpperCase() ? "white-piece" : "black-piece"}`} alt={p} />
                          ))}
                          {materialState.whiteAdvantage > 0 && (
                            <span className="material-advantage">+{materialState.whiteAdvantage}</span>
                          )}
                        </div>
                      </div>
                      <span className="acc-tag-top white">{reviewStats.whiteAccuracy}% accuracy</span>
                    </div>
                  </div>

                </div>

                {/* Right Column: Game Review Dashboard (Stats categories and stepper walkthrough) */}
                <div className="sidebar-col review-sidebar-col">
                  <GameReviewPanel
                    reviewStats={reviewStats}
                    currentMoveIndex={reviewMoveIndex}
                    onSelectMove={handleSelectReviewMove}
                    onCloseReview={handleCloseReviewWalkthrough}
                    onExitToDashboard={handleExitToDashboard}
                    flipMode={flipMode}
                    isActiveMatch={hasActiveGame}
                    analysisProgress={analysisProgress}
                  />

                  <div className="review-move-list-wrapper">
                    <MoveList
                      moveList={moveList}
                      gameHistoryPointer={gameHistoryPointer}
                      gameHistoryLength={gameHistory.length}
                      onShowPreviousPosition={showPreviousPosition}
                      moveAnalyses={reviewStats.moveAnalyses}
                    />
                  </div>
                </div>
              </main>
            </div>
          )}

          {/* Analysis Batch Loader Overlay */}
          {analysisProgress && view !== "review" && (
            <div className="analysis-loader-overlay flex-center">
              <div className="loader-box glass-panel flex-center">
                <RefreshCw size={36} className="loader-spinner" />
                <h3>Stockfish Engine Reviewing Game</h3>
                <p>Analyzing moves and positions to classify blunders and accuracy...</p>
                <div className="progress-bar-container">
                  <div
                    className="progress-bar-fill"
                    style={{
                      width: `${analysisProgress.completed === analysisProgress.total
                          ? 100
                          : Math.min(100, Math.round((analysisProgress.completed / analysisProgress.total) * 100))
                        }%`
                    }}
                  />
                </div>
                <span className="progress-text">
                  {analysisProgress.completed} / {analysisProgress.total} positions evaluated
                </span>
              </div>
            </div>
          )}

          {/* Play against computer Dialog */}
          {showComputerDialog && (
            <ComputerDialog
              onClose={() => setShowComputerDialog(false)}
              onPlay={handlePlayComputer}
              initialTimeControlId={activeTimeControl?.id || "untimed"}
              pieceStyle={pieceStyle}
            />
          )}

          {showFriendDialog && (
            <FriendDialog
              onClose={() => setShowFriendDialog(false)}
              onPlay={handlePlayFriend}
              initialTimeControlId={activeTimeControl?.id || "untimed"}
            />
          )}

          {showCustomizationDialog && (
            <CustomizationDialog
              onClose={() => setShowCustomizationDialog(false)}
              boardTheme={boardTheme}
              onSelectBoardTheme={setBoardTheme}
              pieceStyle={pieceStyle}
              onSelectPieceStyle={setPieceStyle}
              soundEnabled={soundEnabled}
              onToggleSound={handleToggleSound}
              showMoveHints={showMoveHints}
              onToggleMoveHints={handleToggleMoveHints}
              gameMode={gameMode}
              onToggleStockfish={handleToggleStockfish}
              userName={userName}
              onChangeUserName={setUserName}
              userAvatar={userAvatar}
              onChangeUserAvatar={setUserAvatar}
            />
          )}

          {showAuthModal && (
            <AuthModal
              onClose={() => setShowAuthModal(false)}
              onSuccess={handleLoginSuccess}
              closable={true}
            />
          )}

          {/* Game Over Modal Summary */}
          {gameEndState && (
            <GameOverModal
              isOpen={showGameOverModal}
              onClose={() => setShowGameOverModal(false)}
              gameOverMessage={gameOverMessage || "Game Over"}
              gameEndState={gameEndState}
              whiteName={gameMode === "computer" && computerColor === Color.White ? `Stockfish Lvl ${computerLevel}` : (gameMode === "computer" ? "You" : "Player White")}
              blackName={gameMode === "computer" && computerColor === Color.Black ? `Stockfish Lvl ${computerLevel}` : (gameMode === "computer" ? "You" : "Player Black")}
              gameMode={gameMode}
              timeControl={activeTimeControl ? activeTimeControl.name : "Casual"}
              totalMoves={moveList.length}
              gameDuration={gameDurationStr}
              whiteRatingBefore={ratingDeltas?.whiteBefore}
              whiteRatingAfter={ratingDeltas?.whiteAfter}
              blackRatingBefore={ratingDeltas?.blackBefore}
              blackRatingAfter={ratingDeltas?.blackAfter}
              onRematch={handleResetGame}
              onRunReview={() => {
                setShowGameOverModal(false);
                handleStartReviewProcess();
              }}
              onCopyPGN={handleCopyPGN}
              onDownloadPGN={handleDownloadPGN}
              onExitToDashboard={() => {
                setShowGameOverModal(false);
                setView("dashboard");
              }}
            />
          )}

          </>)}
        </div> {/* close page-container */}
      </div> {/* close main-content */}

      {import.meta.env.DEV && <Agentation endpoint="http://localhost:4747" />}

      <style>{`
        .app-layout {
          max-width: 1280px;
          width: 100%;
          margin: 0 auto;
          padding: 24px 20px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          min-height: 100vh;
        }

        .app-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px 24px;
          border-radius: 16px;
          gap: 16px;
        }

        .header-logo {
          gap: 12px;
          justify-content: flex-start;
        }

        .logo-icon-wrap {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: var(--gradient-r);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 14px var(--accent-glow);
          flex-shrink: 0;
        }

        .logo-text h1 {
          font-family: var(--font-display);
          font-size: 19px;
          font-weight: 400;
          letter-spacing: 1px;
          color: var(--text-primary);
        }

        .logo-text p {
          font-size: 10px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.8px;
          font-family: var(--font-mono);
        }

        .header-modes {
          gap: 8px;
        }

        .header-mode-btn {
          padding: 8px 18px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary);
          border: 1px solid var(--glass-border);
          background: rgba(255,255,255,0.02);
          transition: all 0.15s ease;
        }

        .header-mode-btn:hover {
          color: var(--text-primary);
          background: rgba(255,255,255,0.06);
          border-color: rgba(255,255,255,0.14);
        }

        .header-mode-btn.active {
          color: #fff;
          background: var(--gradient-r);
          border-color: transparent;
          box-shadow: 0 4px 14px var(--accent-glow);
        }

        .thinking-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 7px 14px;
          border-radius: 999px;
          border: 1px solid rgba(0,82,255,0.3);
          background: rgba(0,82,255,0.08);
          font-size: 12px;
          font-weight: 600;
          color: var(--accent);
          animation: fade-in-up 0.3s ease;
        }

        .thinking-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--accent);
          animation: pulse-dot 1s infinite;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .header-settings-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary);
          border: 1px solid var(--glass-border);
          background: rgba(255,255,255,0.02);
          transition: all 0.15s ease;
          cursor: pointer;
        }

        .header-settings-btn:hover {
          color: var(--text-primary);
          background: rgba(255,255,255,0.06);
          border-color: rgba(255,255,255,0.14);
          transform: translateY(-1px);
        }

        .game-grid {
          display: grid;
          grid-template-columns: 1.2fr 0.8fr;
          gap: 20px;
          flex: 1;
        }

        .board-col {
          width: 100%;
          min-height: 400px;
        }

        .sidebar-col {
          display: flex;
          flex-direction: column;
          gap: 14px;
          justify-content: flex-start;
          max-height: calc(100vh - 120px);
          overflow-y: auto;
          overflow-x: hidden;
        }

        .review-sidebar-col {
          max-height: calc(100vh - 120px) !important;
          height: calc(100vh - 120px);
          overflow-y: hidden !important;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .review-sidebar-col .game-review-panel {
          flex: 1;
          min-height: 0;
          max-height: none !important;
          overflow-y: auto;
        }

        .review-move-list-wrapper {
          height: 240px;
          flex-shrink: 0;
        }

        .review-move-list-wrapper .move-list-panel {
          height: 100%;
        }

        .board-game-container {
          display: flex;
          flex-direction: column;
          gap: 8px;
          width: 100%;
          max-width: 620px;
        }

        .board-inner-stack {
          display: flex;
          gap: 10px;
          width: 100%;
          height: 100%;
        }

        .player-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          border-radius: 10px;
          background: rgba(255,255,255,0.02);
          border: 1px solid var(--glass-border);
        }

        .player-title {
          font-size: 13px;
          font-weight: 700;
          color: var(--text-primary);
          font-family: var(--font-mono);
        }

        .acc-tag-top {
          font-size: 11px;
          font-weight: 700;
          padding: 3px 10px;
          border-radius: 6px;
          text-transform: uppercase;
          font-family: var(--font-mono);
        }

        .acc-tag-top.white {
          background: #ffffff;
          color: #0f172a;
        }

        .acc-tag-top.black {
          background: #1e293b;
          color: #f8fafc;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        /* PGN Exporter Card */
        .pgn-exporter-card {
          flex-direction: column;
          gap: 10px;
          padding: 14px;
          justify-content: space-between;
        }

        .pgn-exporter-card h4 {
          font-size: 12px;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-family: var(--font-mono);
          align-self: flex-start;
        }

        .exporter-buttons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          width: 100%;
        }

        .export-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 9px 4px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          border: 1px solid var(--glass-border);
          background: rgba(255, 255, 255, 0.02);
          color: var(--text-secondary);
          transition: all 0.15s ease;
        }

        .export-btn:hover {
          background: rgba(255, 255, 255, 0.07);

          border-color: rgba(255, 255, 255, 0.2);
        }

        /* Review trigger button */
        .review-game-trigger-btn {
          width: 100%;
          padding: 13px;
          border-radius: 10px;
          background: rgba(0, 82, 255, 0.08);
          border: 1px solid rgba(0, 82, 255, 0.3);
          color: var(--accent);
          font-size: 14px;
          font-weight: 600;
          gap: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
          box-shadow: 0 4px 14px rgba(0, 82, 255, 0.1);
        }

        .review-game-trigger-btn:hover {
          background: rgba(0, 82, 255, 0.16);
          border-color: rgba(0, 82, 255, 0.5);
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(0, 82, 255, 0.18);
        }

        /* Batch Loader overlay styling */
        .analysis-loader-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(8, 8, 26, 0.85);
          backdrop-filter: blur(4px);
          z-index: 2000;
        }

        .loader-box {
          flex-direction: column;
          gap: 16px;
          padding: 36px;
          width: 90%;
          max-width: 460px;
          text-align: center;
          border: 1px solid rgba(0, 82, 255, 0.2);
        }

        .loader-spinner {
          color: var(--accent);
          animation: spin 1.2s linear infinite;
        }

        .loader-box h3 {
          font-family: var(--font-display);
          font-size: 20px;
          font-weight: 400;
          color: #ffffff;
        }

        .loader-box p {
          font-size: 13px;
          color: var(--text-muted);
          line-height: 1.6;
        }

        .progress-bar-container {
          width: 100%;
          height: 6px;
          background: rgba(0, 82, 255, 0.1);
          border-radius: 3px;
          overflow: hidden;
          border: 1px solid rgba(0, 82, 255, 0.15);
          margin-top: 8px;
        }

        .progress-bar-fill {
          height: 100%;
          background: var(--gradient-r);
          transition: width 0.4s ease;
          border-radius: 3px;
        }

        .progress-text {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-muted);
          font-family: var(--font-mono);
        }

        /* Walkthrough review badge overlays on Chessboard squares */
        .review-overlay-highlight {
          position: absolute;
          width: 12.5%;
          height: 12.5%;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          z-index: 15;
        }

        .review-overlay-img {
          width: 32%;
          height: 32%;
          object-fit: contain;
          position: absolute;
          top: 0;
          right: 0;
          transform: translate(50%, -50%);
          filter: drop-shadow(0 0 1.5px #fff) drop-shadow(0 2px 4px rgba(0, 0, 0, 0.4));
          animation: walkthrough-badge-bounce 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
          z-index: 20;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes walkthrough-badge-bounce {
          0% { transform: translate(50%, -50%) scale(0); }
          50% { transform: translate(50%, -50%) scale(1.15); }
          100% { transform: translate(50%, -50%) scale(1); }
        }

        .view-container {
          display: flex;
          flex-direction: column;
          gap: 14px;
          flex: 1;
        }

        .back-bar {
          display: flex;
          justify-content: flex-start;
          align-items: center;
        }

        .back-to-dashboard-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary);
          border: 1px solid var(--glass-border);
          background: rgba(255,255,255,0.02);
          transition: all 0.15s ease;
          cursor: pointer;
        }

        .back-to-dashboard-btn:hover {
          color: var(--text-primary);
          background: rgba(255,255,255,0.06);
          border-color: rgba(255,255,255,0.14);
          transform: translateX(-2px);
        }

        .opening-name-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
          border-radius: 10px;
          border: 1px solid rgba(217, 119, 6, 0.2);
          background: rgba(217, 119, 6, 0.04);
          animation: fade-in 0.3s ease;
          align-self: flex-start;
          width: fit-content;
        }

        .opening-label {
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #d97706; /* amber */
          background: rgba(217, 119, 6, 0.15);
          padding: 2px 6px;
          border-radius: 4px;
          font-family: var(--font-mono);
        }

        .opening-value {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
        }

        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* Responsive Breakpoints */
        @media (max-width: 900px) {
          .game-grid {
            grid-template-columns: 1fr;
          }
          
          .app-header {
            flex-direction: column;
            gap: 16px;
            text-align: center;
          }
          
        /* Invalid Move Toast Overlay */
        .invalid-move-toast {
          position: fixed;
          bottom: 30px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(239, 68, 68, 0.18);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(239, 68, 68, 0.4);
          color: #fca5a5;
          padding: 12px 24px;
          border-radius: 12px;
          font-weight: 600;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 10px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
          z-index: 9999;
          animation: toast-fade-in-up 0.3s ease-out forwards;
        }

        @keyframes toast-fade-in-up {
          from {
            opacity: 0;
            transform: translate(-50%, 20px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }
      `}</style>
    </div>
  );
}

export default App;

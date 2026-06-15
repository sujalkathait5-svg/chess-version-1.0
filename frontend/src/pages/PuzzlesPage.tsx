// frontend/src/pages/PuzzlesPage.tsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Puzzle, RefreshCcw, CheckCircle2, XCircle, ArrowRight, Lightbulb, List, AlertTriangle, Target, Swords, Shield, Crown, GitFork, Lock, Unlock, Link2, Zap, Flag, TrendingDown, CircleDot, Crosshair } from "lucide-react";
import { Chess } from "chess.js";
import { ChessBoard } from "../components/ChessBoard";
import { useTheme } from "../hooks/useTheme";
import { useSound } from "../hooks/useSound";
import { MoveType } from "../types/moveTypes";
import { authService } from "../services/authService";
import { Color, FENChar } from "../chess-logic/models";
import { getIllegalMoveReasonChessJS } from "../utils/chess-helpers";
import { PgnExport } from "../components/PgnExport";

export function PuzzlesPage() {
  const navigate = useNavigate();
  const { boardTheme, pieceStyle } = useTheme();
  const { playMoveSound, playIncorrectMoveSound } = useSound();

  // Levels List View States
  const [levels, setLevels] = useState<any[]>([]);
  const [levelsLoading, setLevelsLoading] = useState(true);
  const [activePuzzleId, setActivePuzzleId] = useState<string | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<string>("All");

  // Puzzle Play States
  const [puzzle, setPuzzle] = useState<any>(null);
  const [chess] = useState(() => new Chess());
  const [, setFen] = useState(chess.fen());
  const [playerColor, setPlayerColor] = useState<"w" | "b">("w");
  const [moveIndex, setMoveIndex] = useState(0); // Which move in the sequence we are at
  const [status, setStatus] = useState<"playing" | "success" | "failed">("playing");
  const [loading, setLoading] = useState(false);
  const [selectedSquare, setSelectedSquare] = useState<{ r: number, c: number } | null>(null);
  const [pieceSafeSquares, setPieceSafeSquares] = useState<{ x: number; y: number }[]>([]);
  const [isOpponentTurn, setIsOpponentTurn] = useState(false);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [fenHistory, setFenHistory] = useState<string[]>([]);
  const [reviewIndex, setReviewIndex] = useState<number>(-1);

  // Engine Hint States
  const [hintSquares, setHintSquares] = useState<{ from: { x: number; y: number }; to: { x: number; y: number } } | null>(null);
  const [hintLevel, setHintLevel] = useState(0);
  const [bestMoveArrow, setBestMoveArrow] = useState<{ from: { x: number; y: number }; to: { x: number; y: number } } | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);

  useEffect(() => {
    if (!moveError) return;
    const timer = setTimeout(() => {
      setMoveError(null);
    }, 3500);
    return () => clearTimeout(timer);
  }, [moveError]);

  useEffect(() => {
    let cancelled = false;
    const fetchLevels = async () => {
      setLevelsLoading(true);
      try {
        const token = localStorage.getItem('kg_auth_token');
        const headers: Record<string, string> = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        const res = await fetch('/api/puzzles', { headers });
        if (!cancelled && res.ok) {
          const data = await res.json();
          setLevels(data);
        }
      } catch {
        // Ignore fetch errors
      } finally {
        if (!cancelled) {
          setLevelsLoading(false);
        }
      }
    };
    if (activePuzzleId === null) {
      fetchLevels();
    }
    return () => { cancelled = true; };
  }, [activePuzzleId]);

  const selectLevel = async (puzzleId: string) => {
    setLoading(true);
    setHintSquares(null);
    setPieceSafeSquares([]);
    setActivePuzzleId(puzzleId);
    try {
      const res = await fetch(`/api/puzzles/${puzzleId}`);
      if (res.ok) {
        const data = await res.json();
        initPuzzle(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const initPuzzle = (data: any) => {
    setPuzzle(data);
    chess.load(data.fen);

    const initialFens = [chess.fen()];
    // Play the first move automatically if it's a Lichess-format puzzle 
    // (Lichess puzzles always have an EVEN number of moves: Opponent, Player, Opponent, Player...)
    if (data.moves && data.moves.length > 0 && data.moves.length % 2 === 0) {
      const firstMove = data.moves[0];
      const from = firstMove.substring(0, 2);
      const to = firstMove.substring(2, 4);
      const prom = firstMove.length > 4 ? firstMove[4] : undefined;
      const moves = chess.moves({ verbose: true });
      const moveObj = moves.find((m: any) => m.from === from && m.to === to && (!prom || m.promotion === prom));
      if (moveObj) {
        chess.move(moveObj);
        initialFens.push(chess.fen());
      }
      setMoveIndex(1);
    } else {
      setMoveIndex(0);
    }

    setFen(chess.fen());
    setPlayerColor(chess.turn());
    setStatus("playing");
    setSelectedSquare(null);
    setHintSquares(null);
    setHintLevel(0);
    setBestMoveArrow(null);
    setPieceSafeSquares([]);
    setMoveError(null);
    setWrongAttempts(0);
    setIsOpponentTurn(false);
    setFenHistory(initialFens);
    setReviewIndex(-1);
  };

  const handleRetry = () => {
    if (puzzle) {
      initPuzzle(puzzle);
    }
  };

  const loadNextLevel = () => {
    if (!puzzle) return;
    const currentIndex = levels.findIndex(l => l.id === puzzle.id);
    if (currentIndex !== -1 && currentIndex + 1 < levels.length) {
      selectLevel(levels[currentIndex + 1].id);
    } else {
      setActivePuzzleId(null);
    }
  };

  const handlePrevLevel = () => {
    if (!puzzle) return;
    const currentIndex = levels.findIndex(l => l.id === puzzle.id);
    if (currentIndex > 0) {
      selectLevel(levels[currentIndex - 1].id);
    }
  };

  const handleNextLevel = () => {
    if (!puzzle) return;
    const currentIndex = levels.findIndex(l => l.id === puzzle.id);
    if (currentIndex !== -1 && currentIndex + 1 < levels.length) {
      selectLevel(levels[currentIndex + 1].id);
    }
  };

  const handleReview = (direction: 'first' | 'prev' | 'next' | 'last') => {
    if (fenHistory.length === 0) return;
    let newIndex = reviewIndex === -1 ? fenHistory.length - 1 : reviewIndex;
    if (direction === 'first') newIndex = 0;
    if (direction === 'prev') newIndex = Math.max(0, newIndex - 1);
    if (direction === 'next') newIndex = Math.min(fenHistory.length - 1, newIndex + 1);
    if (direction === 'last') newIndex = fenHistory.length - 1;

    setReviewIndex(newIndex);
    chess.load(fenHistory[newIndex]);
    setFen(chess.fen());
  };

  // Convert {r, c} to "e2"
  const squareToAlgebraic = (r: number, c: number) => {
    return `${String.fromCharCode(97 + c)}${r + 1}`;
  };

  // Parse UCI move like "e2e4"
  const parseUciMove = (uci: string) => {
    if (!uci || uci.length < 4) return null;
    const fromY = uci.charCodeAt(0) - 97;
    const fromX = uci.charCodeAt(1) - 49;
    const toY = uci.charCodeAt(2) - 97;
    const toX = uci.charCodeAt(3) - 49;
    return {
      from: { x: fromX, y: fromY },
      to: { x: toX, y: toY }
    };
  };

  const handleShowHint = () => {
    if (status !== "playing" || !puzzle) return;

    const expectedMove = puzzle.moves[moveIndex];
    if (!expectedMove) return;
    const parsed = parseUciMove(expectedMove);
    if (!parsed) return;

    setHintLevel(prev => {
      const next = prev + 1;
      if (next === 1) {
        setHintSquares({ from: parsed.from, to: parsed.from }); // Just source
      } else if (next === 2) {
        setHintSquares({ from: parsed.from, to: parsed.to }); // Source and Dest
      } else if (next >= 3) {
        setHintSquares(null);
        setBestMoveArrow(parsed); // Show arrow
      }
      return next;
    });
  };

  const submitAttempt = async (solved: boolean) => {
    if (!puzzle || !authService.isAuthenticated()) return;
    try {
      const token = localStorage.getItem('kg_auth_token');
      await fetch(`/api/puzzles/${puzzle.id}/attempt`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ solved, time_taken: 0 })
      });
    } catch (err) {
      console.error(err);
    }
  };

  const getSafeSquares = (algebraicSquare: string) => {
    const legalMoves = chess.moves({ square: algebraicSquare as any, verbose: true }) as any[];
    return legalMoves.map((m: any) => {
      const toCol = m.to.charCodeAt(0) - 97;
      const toRow = m.to.charCodeAt(1) - 49;
      return { x: toRow, y: toCol };
    });
  };

  const handleSquareClick = (r: number, c: number) => {
    if (status !== "playing" || !puzzle || isOpponentTurn) return;

    const algebraic = squareToAlgebraic(r, c);

    if (selectedSquare) {
      const sourceAlgebraic = squareToAlgebraic(selectedSquare.r, selectedSquare.c);

      // Attempt move
      const moves = chess.moves({ verbose: true });
      const moveObj = moves.find(m => m.from === sourceAlgebraic && m.to === algebraic);

      if (moveObj) {
        // We have a valid chess move. Now check if it matches the puzzle solution
        const uciMove = moveObj.from + moveObj.to + (moveObj.promotion || '');
        const expectedMove = puzzle.moves[moveIndex];

        if (uciMove === expectedMove) {
          // Correct move!
          chess.move(moveObj);
          const moveTypeSet = new Set<MoveType>();
          if (chess.isCheckmate()) moveTypeSet.add(MoveType.CheckMate);
          else if (chess.isCheck()) moveTypeSet.add(MoveType.Check);
          if (moveObj.flags.includes('c') || moveObj.flags.includes('e')) moveTypeSet.add(MoveType.Capture);
          if (moveObj.flags.includes('k') || moveObj.flags.includes('q')) moveTypeSet.add(MoveType.Castling);
          if (moveObj.flags.includes('p')) moveTypeSet.add(MoveType.Promotion);

          const newFen = chess.fen();
          setFen(newFen);
          setFenHistory(prev => [...prev, newFen]);
          playMoveSound(moveTypeSet);
          setSelectedSquare(null);
          setPieceSafeSquares([]);
          setHintSquares(null);
          setBestMoveArrow(null);
          setHintLevel(0);

          const nextIndex = moveIndex + 1;

          if (nextIndex >= puzzle.moves.length) {
            // Puzzle solved!
            setStatus("success");
            submitAttempt(true);
          } else {
            // It's the opponent's turn to auto-play
            setMoveIndex(nextIndex);
            setIsOpponentTurn(true);
            setTimeout(() => {
              const oppMoveUci = puzzle.moves[nextIndex];
              // Parse UCI to play
              const oppFrom = oppMoveUci.substring(0, 2);
              const oppTo = oppMoveUci.substring(2, 4);
              const oppProm = oppMoveUci.length > 4 ? oppMoveUci[4] : undefined;

              const oppMoves = chess.moves({ verbose: true });
              const oppMoveObj = oppMoves.find((m: any) => m.from === oppFrom && m.to === oppTo && (!oppProm || m.promotion === oppProm));

              if (oppMoveObj) {
                chess.move(oppMoveObj);
                const oppMoveTypeSet = new Set<MoveType>();
                if (chess.isCheckmate()) oppMoveTypeSet.add(MoveType.CheckMate);
                else if (chess.isCheck()) oppMoveTypeSet.add(MoveType.Check);
                if (oppMoveObj.flags.includes('c') || oppMoveObj.flags.includes('e')) oppMoveTypeSet.add(MoveType.Capture);
                if (oppMoveObj.flags.includes('k') || oppMoveObj.flags.includes('q')) oppMoveTypeSet.add(MoveType.Castling);
                if (oppMoveObj.flags.includes('p')) oppMoveTypeSet.add(MoveType.Promotion);

                const oppFen = chess.fen();
                setFen(oppFen);
                setFenHistory(prev => [...prev, oppFen]);
                playMoveSound(oppMoveTypeSet);
                setMoveIndex(nextIndex + 1);

                if (nextIndex + 1 >= puzzle.moves.length) {
                  setStatus("success");
                  submitAttempt(true);
                }
              }
              setIsOpponentTurn(false);
            }, 500);
          }
        } else {
          // Wrong move
          setWrongAttempts(prev => prev + 1);
          setMoveError("Incorrect move. Try again.");
          playIncorrectMoveSound();
          setSelectedSquare(null);
          setPieceSafeSquares([]);

          // Highlight the source square if it's the 3rd wrong attempt (Hint Level 1)
          if (wrongAttempts >= 2 && hintLevel < 1) {
            const parsed = parseUciMove(expectedMove);
            if (parsed) {
              setHintSquares({ from: parsed.from, to: parsed.from }); // Just source square
              setHintLevel(1);
            }
          }
        }
      } else {
        // Check if clicking another piece of same color
        const piece = chess.board()[7 - r][c];
        if (piece && piece.color === playerColor) {
          setSelectedSquare({ r, c });
          setPieceSafeSquares(getSafeSquares(algebraic));
        } else {
          const reason = getIllegalMoveReasonChessJS(chess, sourceAlgebraic, algebraic);
          setMoveError(reason);
          playIncorrectMoveSound();
          setSelectedSquare(null);
          setPieceSafeSquares([]);
        }
      }
    } else {
      // Select piece
      const piece = chess.board()[7 - r][c];
      if (piece && piece.color === playerColor) {
        setSelectedSquare({ r, c });
        setPieceSafeSquares(getSafeSquares(algebraic));
      }
    }
  };

  const getBoardView = (): (FENChar | null)[][] => {
    const board = chess.board();
    const view: (FENChar | null)[][] = Array.from({ length: 8 }, () => Array(8).fill(null));
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[7 - r][c];
        if (piece) {
          view[r][c] = (piece.color === 'w' ? piece.type.toUpperCase() : piece.type) as FENChar;
        }
      }
    }
    return view;
  };

  const boardView = getBoardView();

  const currentLevelIndex = levels.findIndex(l => l.id === activePuzzleId);

  // If level selection screen is active
  if (activePuzzleId === null) {
    return (
      <div className="view-container" style={{ minHeight: "100vh", padding: "40px 20px" }}>
        <div className="back-bar" style={{ marginBottom: "30px", maxWidth: "900px", margin: "0 auto 30px" }}>
          <button className="back-to-dashboard-btn" onClick={() => navigate("/")}>
            <ArrowLeft size={16} />
            <span>Back to Dashboard</span>
          </button>
        </div>

        <div className="glass-panel" style={{ padding: "40px", maxWidth: "900px", margin: "0 auto", borderRadius: "16px" }}>
          <div style={{ textAlign: "center", marginBottom: "40px" }}>
            <h1 style={{ fontSize: "32px", fontWeight: 800, marginBottom: "12px", background: "linear-gradient(135deg, #fff 0%, #a5b4fc 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Tactical Chess Puzzles
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "16px" }}>
              Select a puzzle level to test your visualization and checkmate skills. Solve each level to pass.
            </p>
            <div style={{ marginTop: "20px" }}>
              <select
                value={selectedTheme}
                onChange={(e) => setSelectedTheme(e.target.value)}
                style={{
                  padding: "10px 16px",
                  borderRadius: "8px",
                  background: "rgba(255, 255, 255, 0.05)",
                  color: "white",
                  border: "1px solid var(--glass-border)",
                  outline: "none",
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                <option value="All" style={{ color: "black" }}>All Themes</option>
                <optgroup label="Checkmate" style={{ color: "#888" }}>
                  <option value="mateIn1" style={{ color: "black" }}>Mate in 1</option>
                  <option value="mateIn2" style={{ color: "black" }}>Mate in 2</option>
                  <option value="backRankMate" style={{ color: "black" }}>Back Rank Mate</option>
                  <option value="smotheredMate" style={{ color: "black" }}>Smothered Mate</option>
                  <option value="promotion" style={{ color: "black" }}>Promotion</option>
                </optgroup>
                <optgroup label="Tactics" style={{ color: "#888" }}>
                  <option value="fork" style={{ color: "black" }}>Fork</option>
                  <option value="pin" style={{ color: "black" }}>Pin</option>
                  <option value="skewer" style={{ color: "black" }}>Skewer</option>
                  <option value="discoveredAttack" style={{ color: "black" }}>Discovered Attack</option>
                  <option value="sacrifice" style={{ color: "black" }}>Sacrifice</option>
                </optgroup>
                <optgroup label="Endgame" style={{ color: "#888" }}>
                  <option value="endgame" style={{ color: "black" }}>Endgame</option>
                  <option value="rookEndgame" style={{ color: "black" }}>Rook Endgame</option>
                  <option value="kpk" style={{ color: "black" }}>K+P vs K</option>
                </optgroup>
              </select>
            </div>
          </div>

          {levelsLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
              <RefreshCcw className="spinner" size={40} style={{ animation: "spin 1s linear infinite", color: "var(--accent)" }} />
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "20px" }}>
              {levels
                .filter(lvl => selectedTheme === "All" || (typeof lvl.themes === 'string' ? lvl.themes.includes(selectedTheme) : lvl.themes?.includes(selectedTheme)))
                .map((lvl, index) => {
                  // Determine primary theme for visual differentiation
                  const themeList: string[] = typeof lvl.themes === 'string'
                    ? (lvl.themes.startsWith('[') ? JSON.parse(lvl.themes) : lvl.themes.split(' '))
                    : (lvl.themes || []);

                  const themeConfig: Record<string, { icon: React.ReactNode; color: string; label: string; bg: string }> = {
                    mateIn1:        { icon: <Target size={26} />,      color: "#ef4444", label: "Mate in 1",    bg: "rgba(239,68,68,0.12)" },
                    mateIn2:        { icon: <Swords size={26} />,      color: "#f97316", label: "Mate in 2",    bg: "rgba(249,115,22,0.12)" },
                    mate:           { icon: <Target size={26} />,      color: "#ef4444", label: "Checkmate",    bg: "rgba(239,68,68,0.10)" },
                    backRankMate:   { icon: <Shield size={26} />,      color: "#dc2626", label: "Back Rank",    bg: "rgba(220,38,38,0.12)" },
                    smotheredMate:  { icon: <CircleDot size={26} />,   color: "#9333ea", label: "Smothered",    bg: "rgba(147,51,234,0.12)" },
                    pawnMate:       { icon: <Crosshair size={26} />,   color: "#84cc16", label: "Pawn Mate",    bg: "rgba(132,204,22,0.12)" },
                    promotion:      { icon: <Crown size={26} />,       color: "#f59e0b", label: "Promotion",    bg: "rgba(245,158,11,0.12)" },
                    fork:           { icon: <GitFork size={26} />,     color: "#10b981", label: "Fork",         bg: "rgba(16,185,129,0.12)" },
                    knightFork:     { icon: <GitFork size={26} />,     color: "#10b981", label: "Knight Fork",  bg: "rgba(16,185,129,0.12)" },
                    queenFork:      { icon: <GitFork size={26} />,     color: "#06b6d4", label: "Queen Fork",   bg: "rgba(6,182,212,0.12)" },
                    pawnFork:       { icon: <Zap size={26} />,         color: "#84cc16", label: "Pawn Fork",    bg: "rgba(132,204,22,0.12)" },
                    pin:            { icon: <Lock size={26} />,        color: "#6366f1", label: "Pin",          bg: "rgba(99,102,241,0.12)" },
                    absolutePin:    { icon: <Lock size={26} />,        color: "#4f46e5", label: "Absolute Pin", bg: "rgba(79,70,229,0.12)" },
                    relativePin:    { icon: <Link2 size={26} />,       color: "#7c3aed", label: "Relative Pin", bg: "rgba(124,58,237,0.12)" },
                    breakPin:       { icon: <Unlock size={26} />,      color: "#8b5cf6", label: "Break Pin",    bg: "rgba(139,92,246,0.12)" },
                    skewer:         { icon: <Crosshair size={26} />,   color: "#0ea5e9", label: "Skewer",       bg: "rgba(14,165,233,0.12)" },
                    discoveredAttack:{ icon: <Zap size={26} />,        color: "#f59e0b", label: "Discovery",    bg: "rgba(245,158,11,0.12)" },
                    endgame:        { icon: <Flag size={26} />,        color: "#94a3b8", label: "Endgame",      bg: "rgba(148,163,184,0.12)" },
                    kpk:            { icon: <Flag size={26} />,        color: "#64748b", label: "K+P vs K",     bg: "rgba(100,116,139,0.12)" },
                    rookEndgame:    { icon: <Flag size={26} />,        color: "#475569", label: "Rook End",     bg: "rgba(71,85,105,0.12)" },
                    queenSacrifice: { icon: <TrendingDown size={26} />,color: "#e879f9", label: "Q Sacrifice",  bg: "rgba(232,121,249,0.12)" },
                    sacrifice:      { icon: <TrendingDown size={26} />,color: "#f472b6", label: "Sacrifice",    bg: "rgba(244,114,182,0.12)" },
                  };

                  // Pick best config by scanning themes in priority order
                  const priorityOrder = ['mateIn1', 'mateIn2', 'smotheredMate', 'backRankMate', 'pawnMate', 'promotion', 'queenSacrifice', 'sacrifice', 'knightFork', 'queenFork', 'pawnFork', 'fork', 'absolutePin', 'relativePin', 'breakPin', 'pin', 'skewer', 'discoveredAttack', 'rookEndgame', 'kpk', 'endgame', 'mate'];
                  const primaryTheme = priorityOrder.find(t => themeList.includes(t)) || 'mate';
                  const cfg = themeConfig[primaryTheme] || { icon: <Target size={26} />, color: "var(--accent)", label: "Puzzle", bg: "rgba(0,82,255,0.1)" };

                  // Difficulty label based on rating
                  const difficulty = lvl.rating < 700 ? { label: "Beginner", color: "#4ade80" }
                    : lvl.rating < 900 ? { label: "Easy", color: "#86efac" }
                      : lvl.rating < 1100 ? { label: "Medium", color: "#fbbf24" }
                        : lvl.rating < 1300 ? { label: "Hard", color: "#f97316" }
                          : { label: "Expert", color: "#ef4444" };

                  return (
                    <button
                      key={lvl.id}
                      onClick={() => selectLevel(lvl.id)}
                      className="level-card"
                      style={{
                        padding: "20px 16px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "10px",
                        cursor: "pointer",
                        transition: "all 0.3s ease",
                        background: cfg.bg,
                        border: `1px solid ${cfg.color}30`,
                        borderRadius: "16px",
                        position: "relative",
                        overflow: "hidden",
                      }}
                    >
                      {/* Solved indicator */}
                      {lvl.solved ? (
                        <div style={{
                          position: "absolute",
                          top: "10px",
                          left: "12px",
                          color: "#4ade80",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          filter: "drop-shadow(0 0 4px rgba(74,222,128,0.4))",
                        }} title="Solved">
                          <CheckCircle2 size={16} />
                        </div>
                      ) : null}

                      {/* Level badge */}
                      <div style={{
                        position: "absolute",
                        top: "10px",
                        right: "12px",
                        fontSize: "11px",
                        fontWeight: 700,
                        color: cfg.color,
                        opacity: 0.8,
                      }}>
                        #{index + 1}
                      </div>

                      {/* Theme icon */}
                      <div style={{ color: cfg.color, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>{cfg.icon}</div>

                      {/* Theme label */}
                      <span style={{
                        fontSize: "13px",
                        fontWeight: 700,
                        color: cfg.color,
                        textAlign: "center",
                        lineHeight: 1.2,
                      }}>
                        {cfg.label}
                      </span>

                      {/* Difficulty + Rating */}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                        <span style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          color: difficulty.color,
                          background: `${difficulty.color}15`,
                          padding: "2px 8px",
                          borderRadius: "20px",
                        }}>
                          {difficulty.label}
                        </span>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                          ★ {lvl.rating}
                        </span>
                      </div>
                    </button>
                  );
                })
              }
            </div>
          )}
        </div>

        <style>{`
          .level-card:hover {
            transform: translateY(-6px) scale(1.03);
            box-shadow: 0 12px 32px rgba(0, 0, 0, 0.3);
            filter: brightness(1.15);
          }
          .level-card {
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Active puzzle gameplay view
  return (
    <div className="view-container" style={{ display: "flex", flexDirection: "column", height: "100vh", padding: "20px" }}>
      {moveError && (
        <div className="invalid-move-toast">
          <AlertTriangle size={16} />
          <span>{moveError}</span>
        </div>
      )}
      <div className="back-bar" style={{ marginBottom: "20px", display: "flex", gap: "16px" }}>
        <button className="back-to-dashboard-btn" onClick={() => setActivePuzzleId(null)}>
          <List size={16} />
          <span>Back to Levels</span>
        </button>
        <button className="back-to-dashboard-btn" onClick={() => navigate("/")} style={{ background: "transparent", border: "none" }}>
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </button>
      </div>

      <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", gap: "40px" }}>
        {/* Left Side: Board */}
        <div style={{ position: "relative" }}>
          {loading ? (
            <div style={{ width: "500px", height: "500px", display: "flex", justifyContent: "center", alignItems: "center" }}>
              <RefreshCcw className="spinner" size={32} style={{ animation: "spin 1s linear infinite" }} />
            </div>
          ) : (
            <ChessBoard
              boardView={boardView}
              playerColor={playerColor === 'w' ? Color.White : Color.Black}
              selectedSquare={selectedSquare ? { x: selectedSquare.r, y: selectedSquare.c } : null}
              pieceSafeSquares={pieceSafeSquares}
              lastMove={undefined}
              checkState={{ isInCheck: false }}
              flipMode={playerColor === 'b'}
              isPromotionActive={false}
              promotionCoords={null}
              onSquareClick={handleSquareClick}
              onPromotePiece={() => { }}
              onClosePromotion={() => { }}
              boardTheme={boardTheme}
              pieceStyle={pieceStyle}
              hintSquares={hintSquares}
              reviewBestMove={bestMoveArrow}
            />
          )}

          {/* Overlays */}
          {status === "success" && reviewIndex === -1 && (
            <div style={{
              position: "absolute",
              top: 0, left: 0, right: 0, bottom: 0,
              background: "rgba(34, 197, 94, 0.2)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              backdropFilter: "blur(2px)",
              zIndex: 10,
              borderRadius: "8px"
            }}>
              <CheckCircle2 size={64} style={{ color: "#4ade80", marginBottom: "16px" }} />
              <h2 style={{ color: "white", margin: 0, textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}>Puzzle Solved!</h2>
              <button
                className="btn-primary"
                onClick={() => handleReview('last')}
                style={{ marginTop: "20px" }}
              >
                Review Game
              </button>
            </div>
          )}
          {status === "failed" && (
            <div style={{
              position: "absolute",
              top: 0, left: 0, right: 0, bottom: 0,
              background: "rgba(239, 68, 68, 0.2)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              backdropFilter: "blur(2px)",
              zIndex: 10,
              borderRadius: "8px"
            }}>
              <XCircle size={64} style={{ color: "#ef4444", marginBottom: "16px" }} />
              <h2 style={{ color: "white", margin: 0, textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}>Incorrect Move</h2>
            </div>
          )}
        </div>

        {/* Right Side: Controls */}
        <div className="glass-panel" style={{ width: "320px", padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "16px" }}>
            <Puzzle size={24} style={{ color: "var(--accent)" }} />
            <h2 style={{ margin: 0, fontSize: "20px" }}>Level {currentLevelIndex + 1}</h2>
          </div>

          {!loading && puzzle && (
            <>
              <div style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
                <div>Rating: <strong style={{ color: "var(--text-primary)" }}>{puzzle.rating}</strong></div>
                <div>Themes: {puzzle.themes.join(", ") || "None"}</div>
                <div style={{ marginTop: "12px", fontWeight: "bold", color: playerColor === 'w' ? "white" : "black", background: playerColor === 'w' ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.8)", padding: "8px", borderRadius: "6px", textAlign: "center" }}>
                  {playerColor === 'w' ? "White to move" : "Black to move"}
                </div>
              </div>

              {/* Prev / Next navigation row while playing */}
              <div style={{ display: "flex", gap: "10px", width: "100%", marginTop: "10px" }}>
                <button
                  onClick={handlePrevLevel}
                  disabled={currentLevelIndex === 0}
                  className="btn-secondary"
                  style={{
                    flex: 1,
                    padding: "8px",
                    cursor: currentLevelIndex === 0 ? "not-allowed" : "pointer",
                    opacity: currentLevelIndex === 0 ? 0.4 : 1,
                    fontSize: "13px"
                  }}
                >
                  Prev Level
                </button>
                <button
                  onClick={handleNextLevel}
                  disabled={currentLevelIndex === levels.length - 1}
                  className="btn-secondary"
                  style={{
                    flex: 1,
                    padding: "8px",
                    cursor: currentLevelIndex === levels.length - 1 ? "not-allowed" : "pointer",
                    opacity: currentLevelIndex === levels.length - 1 ? 0.4 : 1,
                    fontSize: "13px"
                  }}
                >
                  Skip Level
                </button>
              </div>

              {status === "playing" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "auto" }}>
                  <button
                    onClick={handleShowHint}
                    className="btn-secondary"
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      gap: "8px",
                      background: "rgba(255, 255, 255, 0.04)",
                      border: "1px solid var(--glass-border)",
                      color: "white",
                      width: "100%",
                      padding: "10px",
                      cursor: "pointer",
                      borderRadius: "6px"
                    }}
                  >
                    <Lightbulb size={16} style={{ color: "#fbbf24" }} />
                    <span>{hintLevel === 0 ? "Show Hint" : hintLevel === 1 ? "Show Destination" : "Show Solution"}</span>
                  </button>
                  <button
                    onClick={handleRetry}
                    className="btn-secondary"
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px",
                      fontSize: "13px"
                    }}
                  >
                    <RefreshCcw size={14} /> Restart Puzzle
                  </button>
                </div>
              )}

              {status === "success" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "auto" }}>
                  {reviewIndex !== -1 && (
                    <div style={{ display: "flex", gap: "8px", justifyContent: "center", marginBottom: "10px" }}>
                      <button className="btn-secondary" onClick={() => handleReview('first')} style={{ padding: "6px 12px" }}>{"<<"}</button>
                      <button className="btn-secondary" onClick={() => handleReview('prev')} style={{ padding: "6px 12px" }}>{"<"}</button>
                      <button className="btn-secondary" onClick={() => handleReview('next')} style={{ padding: "6px 12px" }}>{">"}</button>
                      <button className="btn-secondary" onClick={() => handleReview('last')} style={{ padding: "6px 12px" }}>{">>"}</button>
                    </div>
                  )}
                  <button className="btn-primary" onClick={loadNextLevel} style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "8px" }}>
                    Next Level <ArrowRight size={16} />
                  </button>
                  <PgnExport
                    pgn={(() => {
                      const temp = new Chess(puzzle.fen);
                      for (const m of puzzle.moves) {
                        const from = m.substring(0, 2);
                        const to = m.substring(2, 4);
                        const promotion = m.length > 4 ? m[4] : undefined;
                        temp.move({ from, to, promotion });
                      }
                      temp.header('Event', 'Puzzle', 'Site', 'KingsGauntlet', 'Date', new Date().toISOString().split('T')[0], 'Result', '1-0', 'PuzzleID', puzzle.id);
                      return temp.pgn();
                    })()}
                    filename={`puzzle_${puzzle.id}.pgn`}
                  />
                </div>
              )}

              {status === "failed" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "auto" }}>
                  <button className="btn-secondary" onClick={handleRetry} style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "8px" }}>
                    <RefreshCcw size={16} /> Try Again
                  </button>
                  <button className="btn-primary" onClick={loadNextLevel} style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", background: "var(--bg-panel)" }}>
                    Skip Level
                  </button>
                </div>
              )}
            </>
          )}

          {!authService.isAuthenticated() && (
            <div style={{ marginTop: "auto", fontSize: "12px", color: "var(--text-muted)", textAlign: "center" }}>
              Log in to track your puzzle rating and progress!
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// frontend/src/pages/AnalysisBoardPage.tsx
// Board Editor: Custom position setup, FEN/PGN import/export, engine analysis
import { useState, useCallback, useEffect, useMemo } from "react";
import { Chess } from "chess.js";
import { useTheme } from "../hooks/useTheme";
import { getPieceImgPath } from "../chess-logic/models";
import { useStockfishContinuous } from "../services/useStockfishContinuous";
import { EvaluationBar } from "../components/EvaluationBar";
import { ArrowLeft, RotateCcw, Copy, Download, Upload, FlipVertical, Save, Trash2, ToggleLeft, ToggleRight, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, AlertTriangle, Swords } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSound } from "../hooks/useSound";
import { getIllegalMoveReasonChessJS } from "../utils/chess-helpers";
import { PgnExport } from "../components/PgnExport";
import { ResponsiveContainer, LineChart, Line, YAxis, Tooltip, ReferenceLine } from "recharts";
import type { SavedPosition } from "../services/positionsService";
import { getSavedPositions, savePosition, deletePosition } from "../services/positionsService";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const EMPTY_FEN = "8/8/8/8/8/8/8/8 w - - 0 1";

const PIECE_PALETTE: { piece: string; fenChar: string; label: string }[] = [
  { piece: "K", fenChar: "K", label: "White King" },
  { piece: "Q", fenChar: "Q", label: "White Queen" },
  { piece: "R", fenChar: "R", label: "White Rook" },
  { piece: "B", fenChar: "B", label: "White Bishop" },
  { piece: "N", fenChar: "N", label: "White Knight" },
  { piece: "P", fenChar: "P", label: "White Pawn" },
  { piece: "k", fenChar: "k", label: "Black King" },
  { piece: "q", fenChar: "q", label: "Black Queen" },
  { piece: "r", fenChar: "r", label: "Black Rook" },
  { piece: "b", fenChar: "b", label: "Black Bishop" },
  { piece: "n", fenChar: "n", label: "Black Knight" },
  { piece: "p", fenChar: "p", label: "Black Pawn" },
];



function fenToBoard(fen: string): (string | null)[][] {
  const board: (string | null)[][] = Array.from({ length: 8 }, () => Array(8).fill(null));
  const rows = fen.split(" ")[0].split("/");
  for (let r = 0; r < 8; r++) {
    let col = 0;
    for (const ch of rows[r]) {
      if (/\d/.test(ch)) { col += parseInt(ch); }
      else { board[7 - r][col] = ch; col++; }
    }
  }
  return board;
}

function boardToFen(board: (string | null)[][], sideToMove: "w" | "b", castling: string, enPassant: string): string {
  const rows: string[] = [];
  for (let r = 7; r >= 0; r--) {
    let row = "";
    let empty = 0;
    for (let c = 0; c < 8; c++) {
      if (board[r][c]) {
        if (empty > 0) { row += empty; empty = 0; }
        row += board[r][c];
      } else { empty++; }
    }
    if (empty > 0) row += empty;
    rows.push(row);
  }
  return `${rows.join("/")} ${sideToMove} ${castling || "-"} ${enPassant || "-"} 0 1`;
}

function validatePosition(fen: string): string | null {
  try {
    new Chess(fen);
    
    // Check if opponent is left in check
    const parts = fen.split(' ');
    const sideToMove = parts[1];
    const opponentSide = sideToMove === 'w' ? 'b' : 'w';
    parts[1] = opponentSide;
    parts[3] = '-'; // clear EP target to avoid validation errors on turn flip
    try {
      const oppChess = new Chess(parts.join(' '));
      if (oppChess.isCheck()) {
        return "Opponent king can be captured (impossible check)";
      }
    } catch { /* ignore */ }

    return null;
  } catch (e: any) {
    return e.message.replace('Invalid FEN: ', '');
  }
}

export function AnalysisBoardPage() {
  const navigate = useNavigate();
  const { boardTheme, pieceStyle } = useTheme();
  const { playMoveSound, playIncorrectMoveSound } = useSound();

  // Board state
  const [board, setBoard] = useState(() => fenToBoard(START_FEN));
  const [sideToMove, setSideToMove] = useState<"w" | "b">("w");
  const [castlingRights, setCastlingRights] = useState({ K: true, Q: true, k: true, q: true });
  const [enPassantSquare, setEnPassantSquare] = useState("-");
  const [flipMode, setFlipMode] = useState(false);

  // Editor state
  const [selectedPalettePiece, setSelectedPalettePiece] = useState<string | null>(null);
  const [isEditorMode, setIsEditorMode] = useState(false);


  // FEN/PGN
  const [fenInput, setFenInput] = useState(START_FEN);
  const [fenError, setFenError] = useState<string | null>(null);
  const [pgnInput, setPgnInput] = useState("");
  const [pgnError, setPgnError] = useState<string | null>(null);

  // Engine analysis
  const [engineEnabled, setEngineEnabled] = useState(false);
  const [depth, setDepth] = useState(20);
  const [multiPv, setMultiPv] = useState(3);

  // Move history for analysis mode
  const [chess] = useState(() => new Chess());
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [historyPointer, setHistoryPointer] = useState(-1);
  const [historyFens, setHistoryFens] = useState<string[]>([START_FEN]);
  const [historyEvals, setHistoryEvals] = useState<(number | null)[]>([0]);

  // Interactive Analysis Mode States
  const [selectedSquare, setSelectedSquare] = useState<{ row: number; col: number } | null>(null);
  const [pieceSafeSquares, setPieceSafeSquares] = useState<{ row: number; col: number }[]>([]);
  const [moveError, setMoveError] = useState<string | null>(null);

  useEffect(() => {
    if (!moveError) return;
    const timer = setTimeout(() => {
      setMoveError(null);
    }, 3500);
    return () => clearTimeout(timer);
  }, [moveError]);

  const [positionName, setPositionName] = useState("");
  // Saved positions (from API)
  const [savedPositions, setSavedPositions] = useState<SavedPosition[]>([]);

  useEffect(() => {
    getSavedPositions().then(setSavedPositions).catch(() => {});
  }, []);

  // Compute current FEN
  const currentFen = useCallback(() => {
    const c = [
      castlingRights.K ? "K" : "",
      castlingRights.Q ? "Q" : "",
      castlingRights.k ? "k" : "",
      castlingRights.q ? "q" : "",
    ].join("") || "-";
    return boardToFen(board, sideToMove, c, enPassantSquare);
  }, [board, sideToMove, castlingRights, enPassantSquare]);

  // Sync FEN input when board changes - compute during render instead of effect
  const syncedFenInput = isEditorMode ? currentFen() : fenInput;
  const syncedPositionError = isEditorMode ? validatePosition(syncedFenInput) : null;

  const engineState = useStockfishContinuous(
    isEditorMode ? currentFen() : (historyFens[historyPointer + 1] || START_FEN),
    engineEnabled && !(isEditorMode && syncedPositionError),
    depth,
    multiPv
  );

  // Sync engine eval into historyEvals - compute during render
  const computedHistoryEvals = useMemo(() => {
    if (isEditorMode || !engineEnabled || engineState.evaluation === null) return historyEvals;
    const next = [...historyEvals];
    next[historyPointer + 1] = engineState.evaluation;
    return next;
  }, [isEditorMode, engineEnabled, engineState.evaluation, historyPointer, historyEvals]);

  const goToPosition = (idx: number) => {
    if (idx < 0) idx = -1;
    if (idx >= moveHistory.length) idx = moveHistory.length - 1;
    setHistoryPointer(idx);
    const fen = historyFens[idx + 1] || START_FEN;
    setBoard(fenToBoard(fen));
    const parts = fen.split(" ");
    setSideToMove((parts[1] || "w") as "w" | "b");
    chess.load(fen);
    setSelectedSquare(null);
    setPieceSafeSquares([]);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (isEditorMode) return;
      if (e.key === "ArrowLeft") {
        goToPosition(historyPointer - 1);
      } else if (e.key === "ArrowRight") {
        goToPosition(historyPointer + 1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [historyPointer, moveHistory.length, isEditorMode]);

  // Save positions to localStorage
  useEffect(() => {
    try { localStorage.setItem("kg_saved_positions", JSON.stringify(savedPositions)); }
    catch { /* ignore */ }
  }, [savedPositions]);

  const squareToAlgebraic = (r: number, c: number): string => {
    const file = String.fromCharCode(97 + c);
    const rank = r + 1;
    return `${file}${rank}`;
  };

  const getSafeSquares = (algebraicSquare: string) => {
    const legalMoves = chess.moves({ square: algebraicSquare as any, verbose: true }) as any[];
    return legalMoves.map((m: any) => {
      const toCol = m.to.charCodeAt(0) - 97;
      const toRow = m.to.charCodeAt(1) - 49;
      return { row: toRow, col: toCol };
    });
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, source: { type: "palette" | "board", piece: string, row?: number, col?: number }) => {
    e.dataTransfer.setData("application/json", JSON.stringify(source));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (isEditorMode) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    }
  };

  const handleDrop = (e: React.DragEvent, targetRow?: number, targetCol?: number) => {
    if (!isEditorMode) return;
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData("application/json"));
      if (targetRow !== undefined && targetCol !== undefined) {
        // Dropped on board
        setBoard(prev => {
          const next = prev.map(r => [...r]);
          if (data.type === "board" && data.row !== undefined && data.col !== undefined) {
            next[data.row][data.col] = null;
          }
          next[targetRow][targetCol] = data.piece;
          return next;
        });
      } else {
        // Dropped off board
        if (data.type === "board" && data.row !== undefined && data.col !== undefined) {
          setBoard(prev => {
            const next = prev.map(r => [...r]);
            next[data.row][data.col] = null;
            return next;
          });
        }
      }
    } catch { /* ignore */ }
  };

  // Board square click handler
  const handleBoardClick = (row: number, col: number) => {
    if (isEditorMode) {
      if (selectedPalettePiece) {
        setBoard(prev => {
          const next = prev.map(r => [...r]);
          next[row][col] = selectedPalettePiece;
          return next;
        });
      } else {
        // Remove piece
        setBoard(prev => {
          const next = prev.map(r => [...r]);
          next[row][col] = null;
          return next;
        });
      }
    } else {
      // Analysis mode — play moves using chess.js
      const algebraic = squareToAlgebraic(row, col);

      // If we click a safe target square, play the move!
      if (
        selectedSquare &&
        pieceSafeSquares.some(sq => sq.row === row && sq.col === col)
      ) {
        const fromSquare = squareToAlgebraic(selectedSquare.row, selectedSquare.col);
        const toSquare = algebraic;

        try {
          const piece = chess.get(fromSquare as any);
          const isPawn = piece?.type === "p";
          const targetRank = piece?.color === "w" ? "8" : "1";
          const promotion = isPawn && toSquare[1] === targetRank ? "q" : undefined;

          // Make the move on chess.js
          const moveObj = chess.move({ from: fromSquare, to: toSquare, promotion });
          if (moveObj) {
            // Truncate history if we are in the middle of it
            const nextHistory = moveHistory.slice(0, historyPointer + 1);
            const nextFens = historyFens.slice(0, historyPointer + 2);
            const nextEvals = historyEvals.slice(0, historyPointer + 2);

            nextHistory.push(moveObj.san);
            nextFens.push(chess.fen());
            nextEvals.push(null); // Will be filled by engine

            setMoveHistory(nextHistory);
            setHistoryFens(nextFens);
            setHistoryEvals(nextEvals);
            setHistoryPointer(nextHistory.length - 1);
            setBoard(fenToBoard(chess.fen()));
            setSideToMove(chess.turn());
            setSelectedSquare(null);
            setPieceSafeSquares([]);
            
            // Play move sound
            playMoveSound();
          }
        } catch {
          playIncorrectMoveSound();
        }
        return;
      }

      // Check if clicking another piece of the side to move
      const piece = chess.get(algebraic as any);
      if (piece && piece.color === chess.turn()) {
        setSelectedSquare({ row, col });
        setPieceSafeSquares(getSafeSquares(algebraic));
      } else {
        // Attempted move to illegal square
        if (selectedSquare) {
          const fromSquare = squareToAlgebraic(selectedSquare.row, selectedSquare.col);
          const reason = getIllegalMoveReasonChessJS(chess, fromSquare, algebraic);
          setMoveError(reason);
          playIncorrectMoveSound();
        }
        setSelectedSquare(null);
        setPieceSafeSquares([]);
      }
    }
  };

  const exportBoardToPNG = async () => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const size = 640;
    const sqSize = size / 8;
    canvas.width = size;
    canvas.height = size;

    // Simplified board colors
    const lightColor = boardTheme === "green" ? "#eeeed2" : (boardTheme === "blue" ? "#dee3e6" : "#f0d9b5");
    const darkColor = boardTheme === "green" ? "#769656" : (boardTheme === "blue" ? "#8ca2ad" : "#b58863");

    // Draw squares
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const isLight = (r + c) % 2 === 0;
        ctx.fillStyle = isLight ? lightColor : darkColor;
        ctx.fillRect(c * sqSize, r * sqSize, sqSize, sqSize);
      }
    }

    // Draw pieces
    const drawPiece = (piece: string, r: number, c: number) => {
      return new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, c * sqSize, r * sqSize, sqSize, sqSize);
          resolve();
        };
        img.onerror = () => resolve(); // Ignore load errors
        img.src = getPieceImgPath(piece, pieceStyle);
      });
    };

    const promises: Promise<void>[] = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const displayRow = flipMode ? 7 - r : r;
        const displayCol = flipMode ? 7 - c : c;
        const piece = board[displayRow][displayCol];
        if (piece) promises.push(drawPiece(piece, r, c));
      }
    }

    await Promise.all(promises);

    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `chess_position_${Date.now()}.png`;
    a.click();
  };

  const handleDownloadFEN = () => {
    try {
      const fen = fenInput.trim();
      const testChess = new Chess();
      testChess.load(fen); // Will throw specific Error message if invalid

      const blob = new Blob([fen], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `position_${Date.now()}.fen`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setFenError(e.message.replace('Invalid FEN: ', '') || "Invalid FEN string");
    }
  };

  // FEN import
  const handleLoadFEN = () => {
    try {
      const fen = fenInput.trim();
      const testChess = new Chess();
      testChess.load(fen); // Will throw specific Error message if invalid

      setBoard(fenToBoard(fen));
      const parts = fen.split(" ");
      setSideToMove((parts[1] || "w") as "w" | "b");
      const c = parts[2] || "-";
      setCastlingRights({ K: c.includes("K"), Q: c.includes("Q"), k: c.includes("k"), q: c.includes("q") });
      setEnPassantSquare(parts[3] || "-");
      setFenError(null);

      // Reset history
      chess.load(fen);
      setHistoryFens([fen]);
      setMoveHistory([]);
      setHistoryEvals([0]);
      setHistoryPointer(-1);
      setSelectedSquare(null);
      setPieceSafeSquares([]);
    } catch (e: any) {
      setFenError(e.message.replace('Invalid FEN: ', '') || "Invalid FEN string");
    }
  };

  // PGN import
  const handleLoadPGN = () => {
    try {
      const testChess = new Chess();
      testChess.loadPgn(pgnInput.trim());
      const history = testChess.history();
      const fens: string[] = [START_FEN];
      const evals: (number | null)[] = [0];
      const replayChess = new Chess();
      for (const move of history) {
        replayChess.move(move);
        fens.push(replayChess.fen());
        evals.push(null);
      }
      setBoard(fenToBoard(fens[fens.length - 1]));
      setHistoryFens(fens);
      setHistoryEvals(evals);
      setMoveHistory(history);
      setHistoryPointer(history.length - 1);
      setSideToMove(replayChess.turn() as "w" | "b");
      setPgnError(null);
      setIsEditorMode(false);

      chess.load(fens[fens.length - 1]);
      setSelectedSquare(null);
      setPieceSafeSquares([]);
    } catch (e: any) {
      setPgnError(e.message || "Invalid PGN");
    }
  };

  const handleReset = () => {
    setBoard(fenToBoard(START_FEN));
    setFenInput(START_FEN);
    setSideToMove("w");
    setCastlingRights({ K: true, Q: true, k: true, q: true });
    setEnPassantSquare("-");
    setHistoryFens([START_FEN]);
    setHistoryEvals([0]);
    setMoveHistory([]);
    setHistoryPointer(-1);
    
    chess.load(START_FEN);
    setSelectedSquare(null);
    setPieceSafeSquares([]);
  };

  // PGN export
  const handleExportPGN = () => {
    const ch = new Chess();
    for (const move of moveHistory) ch.move(move);
    return ch.pgn();
  };

  const handleSavePosition = async () => {
    if (!positionName.trim()) {
      alert("Please enter a name for the position");
      return;
    }
    try {
      const fen = isEditorMode ? currentFen() : chess.fen();
      const newPos = await savePosition(positionName, fen);
      setSavedPositions(prev => [newPos, ...prev]);
      setPositionName("");
    } catch (e: any) {
      alert("Failed to save: " + e.message);
    }
  };

  const handleLoadSavedPosition = (pos: SavedPosition) => {
    try {
      setFenInput(pos.fen);
      const testChess = new Chess();
      testChess.load(pos.fen);
      setBoard(fenToBoard(pos.fen));
      
      const parts = pos.fen.split(" ");
      setSideToMove((parts[1] || "w") as "w" | "b");
      const c = parts[2] || "-";
      setCastlingRights({ K: c.includes("K"), Q: c.includes("Q"), k: c.includes("k"), q: c.includes("q") });
      setEnPassantSquare(parts[3] || "-");
      
      chess.load(pos.fen);
      setHistoryFens([pos.fen]);
      setHistoryEvals([0]);
      setMoveHistory([]);
      setHistoryPointer(-1);
    } catch {
      alert("Failed to load position.");
    }
  };

  const handleDeleteSavedPosition = async (id: string) => {
    if (!confirm("Delete this position?")) return;
    try {
      await deletePosition(id);
      setSavedPositions(prev => prev.filter(p => p.id !== id));
    } catch (e: any) {
      alert("Failed to delete: " + e.message);
    }
  };

  const renderRow = (row: number) => flipMode ? 7 - row : row;
  const renderCol = (col: number) => flipMode ? 7 - col : col;

  return (
    <div className="analysis-board-page">
      {moveError && (
        <div className="invalid-move-toast">
          <AlertTriangle size={16} />
          <span>{moveError}</span>
        </div>
      )}
      {/* Header */}
      <div className="analysis-header">
        <button className="back-to-dashboard-btn" onClick={() => navigate("/")}>
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </button>
        <h2 className="analysis-title">
          <span className="gradient-text">Analysis Board</span>
        </h2>
        <div className="analysis-mode-toggle">
          <button
            className={`mode-btn ${!isEditorMode ? "active" : ""}`}
            onClick={() => setIsEditorMode(false)}
          >
            Analysis
          </button>
          <button
            className={`mode-btn ${isEditorMode ? "active" : ""}`}
            onClick={() => setIsEditorMode(true)}
          >
            Editor
          </button>
        </div>
      </div>

      <div className="analysis-layout">
        {/* Left: Board */}
        <div 
          className="analysis-board-section" 
          onDragOver={handleDragOver} 
          onDrop={(e) => handleDrop(e)} // allows dropping off board to delete pieces
        >
          {/* Engine eval bar */}
          {engineEnabled && (
            <EvaluationBar evaluation={engineState.evaluation} mate={engineState.mate} flipMode={flipMode} />
          )}

          <div className="analysis-board-wrapper">
            <div className={`analysis-board board-theme-${boardTheme}`}>
              {Array.from({ length: 8 }, (_, rowIdx) => {
                const row = renderRow(rowIdx);
                return (
                  <div key={rowIdx} className="analysis-board-row">
                    {Array.from({ length: 8 }, (_, colIdx) => {
                      const col = renderCol(colIdx);
                      const piece = board[row]?.[col];
                      const isLight = (row + col) % 2 === 0;
                      const isSelected = selectedSquare && selectedSquare.row === row && selectedSquare.col === col;
                      const isSafeTarget = pieceSafeSquares.some(sq => sq.row === row && sq.col === col);
                      const isPieceOfTurn = !isEditorMode && (() => {
                        const p = board[row]?.[col];
                        if (!p) return false;
                        const pColor = p === p.toUpperCase() ? 'w' : 'b';
                        return pColor === chess.turn();
                      })();
                      const cursorStyle = isEditorMode
                        ? (selectedPalettePiece ? "copy" : "pointer")
                        : (isPieceOfTurn || isSafeTarget ? "pointer" : "default");

                      return (
                        <div
                          key={colIdx}
                          className={`analysis-square ${isLight ? "light" : "dark"} ${isSelected ? "selected" : ""} ${isSafeTarget ? "safe-target" : ""}`}
                          onClick={() => handleBoardClick(row, col)}
                          onDragOver={handleDragOver}
                          onDrop={(e) => { e.stopPropagation(); handleDrop(e, row, col); }}
                          style={{ cursor: cursorStyle }}
                        >
                          {/* Coordinate labels */}
                          {colIdx === 0 && (
                            <span className="coord-rank">{row + 1}</span>
                          )}
                          {rowIdx === 7 && (
                            <span className="coord-file">{String.fromCharCode(97 + col)}</span>
                          )}
                          {piece && (
                            <img
                              src={getPieceImgPath(piece, pieceStyle)}
                              alt={piece}
                              className="analysis-piece-img"
                              draggable={isEditorMode}
                              onDragStart={(e) => handleDragStart(e, { type: "board", piece, row, col })}
                            />
                          )}
                          {/* Safe indicators */}
                          {isSafeTarget && (
                            <div className={`safe-indicator-overlay ${piece ? "has-piece" : ""}`}>
                              <div className="safe-dot"></div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Board controls */}
          <div className="analysis-board-controls">
            <button onClick={() => setFlipMode(f => !f)} title="Flip Board" className="board-ctrl-btn">
              <FlipVertical size={16} />
            </button>
            <button onClick={handleReset} title="Reset to Start" className="board-ctrl-btn">
              <RotateCcw size={16} />
            </button>
            <button onClick={() => { setBoard(fenToBoard(EMPTY_FEN)); setFenInput(EMPTY_FEN); chess.clear(); setSelectedSquare(null); setPieceSafeSquares([]); }} title="Clear Board" className="board-ctrl-btn">
              <Trash2 size={16} />
            </button>
            {!isEditorMode && moveHistory.length > 0 && (
              <>
                <button onClick={() => goToPosition(-1)} className="board-ctrl-btn" title="Start"><ChevronsLeft size={16} /></button>
                <button onClick={() => goToPosition(historyPointer - 1)} className="board-ctrl-btn" title="Previous"><ChevronLeft size={16} /></button>
                <button onClick={() => goToPosition(historyPointer + 1)} className="board-ctrl-btn" title="Next"><ChevronRight size={16} /></button>
                <button onClick={() => goToPosition(moveHistory.length - 1)} className="board-ctrl-btn" title="End"><ChevronsRight size={16} /></button>
              </>
            )}
          </div>

          {/* Engine info */}
          {engineEnabled && engineState.bestmove && (
            <div className="engine-info glass-panel">
              <div className="engine-info-header">
                <span className="engine-label">Depth: {engineState.depth}/{depth}</span>
                <input type="range" min={5} max={30} value={depth} onChange={e => setDepth(+e.target.value)} className="depth-slider" />
                <span className="engine-label ml-4">Lines: {multiPv}</span>
                <input type="range" min={1} max={5} value={multiPv} onChange={e => setMultiPv(+e.target.value)} className="depth-slider" />
              </div>
              <div className="engine-lines mt-2">
                {engineState.lines.map(line => (
                  <div key={line.multipv} className="engine-line">
                    <span className="engine-line-score">
                      {line.mate !== null ? `M${Math.abs(line.mate)}` : (line.evaluation !== null ? (line.evaluation > 0 ? '+' : '') + line.evaluation.toFixed(2) : '...')}
                    </span>
                    <span className="engine-line-moves ml-2 opacity-80">
                      {line.bestmove} {line.continuation}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Controls Panel */}
        <div className="analysis-controls-panel">
          {/* Editor Mode: Position Error */}
          {isEditorMode && syncedPositionError && (
            <div className="control-card glass-panel validation-error">
              <AlertTriangle size={16} />
              <span>{syncedPositionError}</span>
            </div>
          )}

          {/* Play from Position */}
          <div className="control-card glass-panel" style={{ display: 'flex', gap: '8px' }}>
            <button
              className="game-btn primary flex-1"
              style={{ padding: '8px', fontSize: '14px' }}
                disabled={isEditorMode && !!syncedPositionError}
                onClick={() => navigate(`/?fen=${encodeURIComponent(isEditorMode ? currentFen() : (historyFens[historyPointer + 1] || START_FEN))}&mode=computer`)}
            >
              <Swords size={16} /> Play Bot
            </button>
            <button
              className="game-btn flex-1"
              style={{ padding: '8px', fontSize: '14px' }}
              disabled={isEditorMode && !!syncedPositionError}
              onClick={() => {
                const url = `${window.location.origin}/?fen=${encodeURIComponent(isEditorMode ? currentFen() : (historyFens[historyPointer + 1] || START_FEN))}`;
                navigator.clipboard.writeText(url);
                alert("Challenge link copied!");
              }}
            >
              <Copy size={16} /> Share Link
            </button>
          </div>

          {/* Engine Toggle */}
          <div className="control-card glass-panel">
            <div className="control-card-header">
              <h3>Engine Analysis</h3>
              <button 
                onClick={() => setEngineEnabled(e => !e)} 
                className="toggle-btn"
                disabled={isEditorMode && !!syncedPositionError}
                title={isEditorMode && syncedPositionError ? "Position must be legal" : ""}
              >
                {engineEnabled ? <ToggleRight size={24} className="toggle-on" /> : <ToggleLeft size={24} className={`toggle-off ${isEditorMode && syncedPositionError ? 'opacity-50' : ''}`} />}
              </button>
            </div>
          </div>

          {/* Editor Mode: Piece Palette */}
          {isEditorMode && (
            <div className="control-card glass-panel">
              <h3>Piece Palette</h3>
              <p className="control-hint">Select a piece, then click a square to place it. Click without a piece selected to remove.</p>
              <div className="piece-palette-grid">
                {PIECE_PALETTE.map(p => (
                  <button
                    key={p.fenChar}
                    className={`palette-piece ${selectedPalettePiece === p.fenChar ? "selected" : ""}`}
                    onClick={() => setSelectedPalettePiece(prev => prev === p.fenChar ? null : p.fenChar)}
                    title={p.label}
                  >
                    <img 
                      src={getPieceImgPath(p.fenChar, pieceStyle)} 
                      alt={p.label} 
                      draggable
                      onDragStart={(e) => handleDragStart(e, { type: "palette", piece: p.fenChar })}
                    />
                  </button>
                ))}
                <button
                  className={`palette-piece eraser ${!selectedPalettePiece ? "selected" : ""}`}
                  onClick={() => setSelectedPalettePiece(null)}
                  title="Eraser (remove pieces)"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          )}

          {/* Editor Mode: Position Controls */}
          {isEditorMode && (
            <div className="control-card glass-panel">
              <h3>Position Settings</h3>

              {/* Side to move */}
              <div className="setting-row">
                <label>Side to Move</label>
                <div className="radio-group">
                  <button className={`radio-btn ${sideToMove === "w" ? "active" : ""}`} onClick={() => setSideToMove("w")}>White</button>
                  <button className={`radio-btn ${sideToMove === "b" ? "active" : ""}`} onClick={() => setSideToMove("b")}>Black</button>
                </div>
              </div>

              {/* Castling */}
              <div className="setting-row">
                <label>Castling Rights</label>
                <div className="castling-checkboxes">
                  {(["K", "Q", "k", "q"] as const).map(right => (
                    <label key={right} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={castlingRights[right]}
                        onChange={() => setCastlingRights(prev => ({ ...prev, [right]: !prev[right] }))}
                      />
                      <span>{right === "K" ? "K♔" : right === "Q" ? "Q♔" : right === "k" ? "k♚" : "q♚"}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* En passant */}
              <div className="setting-row">
                <label>En Passant Square</label>
                <input
                  type="text"
                  value={enPassantSquare}
                  onChange={e => setEnPassantSquare(e.target.value || "-")}
                  placeholder="-"
                  className="ep-input"
                  maxLength={2}
                />
              </div>
            </div>
          )}

          {/* FEN Input */}
          <div className="control-card glass-panel">
            <h3>FEN</h3>
            <div className="fen-input-row">
              <input
                type="text"
                value={syncedFenInput}
                onChange={e => { setFenInput(e.target.value); setFenError(null); }}
                placeholder="Paste FEN here..."
                className="fen-text-input"
              />
              <button onClick={handleLoadFEN} className="btn-sm btn-accent" title="Load FEN">
                <Upload size={14} />
              </button>
              <div className="action-buttons-grid">
                <button className="icon-btn" onClick={() => { navigator.clipboard.writeText(isEditorMode ? currentFen() : (historyFens[historyPointer + 1] || START_FEN)); alert("FEN copied!"); }} title="Copy FEN">
                  <Copy size={16} />
                </button>
                <button className="icon-btn" onClick={handleDownloadFEN} title="Download FEN File">
                  <Download size={16} /> FEN
                </button>
                <button className="icon-btn" onClick={exportBoardToPNG} title="Export Board to PNG">
                  <Download size={16} /> PNG
                </button>
              </div>
            </div>
            {fenError && <p className="error-msg">{fenError}</p>}
          </div>

          {/* PGN Import/Export */}
          <div className="control-card glass-panel">
            <h3>PGN</h3>
            <textarea
              value={pgnInput}
              onChange={e => { setPgnInput(e.target.value); setPgnError(null); }}
              placeholder="Paste PGN here..."
              className="pgn-textarea"
              rows={4}
            />
            <div className="pgn-buttons">
              <button onClick={handleLoadPGN} className="btn-sm btn-accent">
                <Upload size={14} />
                <span>Load PGN</span>
              </button>
              <button onClick={() => { const pgn = handleExportPGN(); navigator.clipboard.writeText(pgn); }} className="btn-sm">
                <Copy size={14} />
                <span>Copy PGN</span>
              </button>
              <button onClick={() => {
                const pgn = handleExportPGN();
                const blob = new Blob([pgn], { type: "text/plain" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url; a.download = `analysis_${Date.now()}.pgn`;
                document.body.appendChild(a); a.click(); document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }} className="btn-sm">
                <Download size={14} />
                <span>Download</span>
              </button>
            </div>
            {pgnError && <p className="error-msg">{pgnError}</p>}
          </div>

          {/* Save / Load Positions */}
          <div className="control-card glass-panel">
            <h3>Saved Positions</h3>
            <div className="save-position-row">
              <input
                type="text"
                value={positionName}
                onChange={e => setPositionName(e.target.value)}
                placeholder="Position name..."
                className="position-name-input"
              />
              <button onClick={handleSavePosition} className="btn-sm btn-accent">
                <Save size={14} />
                <span>Save</span>
              </button>
            </div>
            {savedPositions.length > 0 && (
              <div className="saved-positions-list">
                {savedPositions.map(pos => (
                  <div key={pos.id} className="saved-position-item">
                    <button className="saved-pos-name" onClick={() => handleLoadSavedPosition(pos)}>
                      {pos.name}
                    </button>
                    <span className="saved-pos-date">{new Date(pos.created_at).toLocaleDateString()}</span>
                    <button className="saved-pos-delete" onClick={() => handleDeleteSavedPosition(pos.id)}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Move history in analysis mode */}
          {!isEditorMode && moveHistory.length > 0 && (
            <>
              {/* Evaluation Graph */}
              <div className="control-card glass-panel" style={{ height: '140px', padding: '16px 8px 8px 0' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart 
                    data={computedHistoryEvals.map((ev, i) => ({ move: i, eval: ev !== null ? Math.max(-10, Math.min(10, ev)) : 0 }))} 
                    onClick={(e) => { if (e && e.activeTooltipIndex != null) goToPosition(Number(e.activeTooltipIndex) - 1); }}
                  >
                    <YAxis domain={[-10, 10]} hide />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const val = payload[0].value as number;
                          return (
                            <div style={{ background: 'rgba(0,0,0,0.8)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                              {val > 0 ? '+' : ''}{val.toFixed(1)}
                            </div>
                          );
                        }
                        return null;
                      }} 
                    />
                    <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" />
                    <Line 
                      type="monotone" 
                      dataKey="eval" 
                      stroke="var(--accent-primary)" 
                      strokeWidth={2} 
                      dot={false} 
                      activeDot={{ r: 4, fill: "var(--accent-primary)", stroke: "#fff" }} 
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="control-card glass-panel">
                <h3>Move History</h3>
                <div className="analysis-move-list">
                  {moveHistory.map((move, idx) => (
                    <span
                      key={idx}
                      className={`analysis-move ${idx === historyPointer ? "active" : ""}`}
                      onClick={() => goToPosition(idx)}
                    >
                      {idx % 2 === 0 && <span className="move-num">{Math.floor(idx / 2) + 1}.</span>}
                      {move}
                    </span>
                  ))}
                </div>
                <div className="mt-4">
                  <PgnExport 
                    pgn={(() => {
                      const temp = new Chess();
                      for (const move of moveHistory) temp.move(move);
                      temp.header('Event', 'Analysis', 'Date', new Date().toISOString().split('T')[0]);
                      return temp.pgn();
                    })()} 
                    filename={`analysis_${new Date().toISOString().split('T')[0]}.pgn`} 
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

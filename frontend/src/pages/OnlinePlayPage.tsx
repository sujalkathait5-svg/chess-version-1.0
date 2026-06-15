// frontend/src/pages/OnlinePlayPage.tsx
import { useState, useEffect, useRef } from "react";
import { socketService } from "../services/socketService";
import { Chess } from "chess.js";
import { ChessBoard } from "../components/ChessBoard";
import { EvaluationBar } from "../components/EvaluationBar";
import { ChessTimer } from "../components/ChessTimer";
import { useTheme } from "../hooks/useTheme";
import { useSound } from "../hooks/useSound";
import { ArrowLeft, Loader2, Flag, RotateCcw, AlertTriangle } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { Color, FENChar } from "../chess-logic/models";
import type { CheckState } from "../chess-logic/models";
import { getEvaluation } from "../services/stockfish";
import { PremoveService } from "../services/premoveService";
import type { Premove } from "../services/premoveService";
import { authService } from "../services/authService";
import { getIllegalMoveReasonChessJS } from "../utils/chess-helpers";
import { PgnExport } from "../components/PgnExport";

const getMoveSoundEvent = (chessInstance: Chess) => {
  const history = chessInstance.history({ verbose: true });
  if (history.length === 0) return "move";
  const lastMove = history[history.length - 1];
  
  const isCheckmate = chessInstance.isCheckmate();
  if (isCheckmate) return "checkmate";
  
  const isCheck = chessInstance.inCheck();
  if (isCheck) return "check";
  
  const flags = lastMove.flags;
  const isPromotion = flags.includes('p');
  if (isPromotion) return "promote";
  
  const isCastle = flags.includes('k') || flags.includes('q');
  if (isCastle) return "castle";
  
  const isCapture = flags.includes('c') || flags.includes('e');
  if (isCapture) return "capture";
  
  return "move";
};

export function OnlinePlayPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { boardTheme, pieceStyle } = useTheme();
  const { playMoveSound, playIncorrectMoveSound, playSound } = useSound();
  const whiteLowTimePlayed = useRef(false);
  const blackLowTimePlayed = useRef(false);

  const tournamentData = location.state?.tournamentMatch;

  // Matchmaking State
  const [isSearching, setIsSearching] = useState(!tournamentData);
  const [activeRoom, setActiveRoom] = useState<string | null>(tournamentData?.roomId ?? null);
  const [isTournament, setIsTournament] = useState(tournamentData?.isTournament ?? false);
  const [tournamentId, setTournamentId] = useState<string | null>(tournamentData?.tournamentId ?? null);
  
  // Game State
  const [chess] = useState(() => tournamentData ? new Chess(tournamentData.fen) : new Chess());
  const [fen, setFen] = useState(chess.fen());
  const [playerColor, setPlayerColor] = useState<"w" | "b">(
    tournamentData ? (tournamentData.black.id === authService.getCurrentUser()?.id ? "b" : "w") : "w"
  );
  const [whitePlayer, setWhitePlayer] = useState<any>(tournamentData?.white ?? null);
  const [blackPlayer, setBlackPlayer] = useState<any>(tournamentData?.black ?? null);
  const [whiteTime, setWhiteTime] = useState(tournamentData?.whiteTime ?? 180);
  const [blackTime, setBlackTime] = useState(tournamentData?.blackTime ?? 180);
  const [gameOver, setGameOver] = useState<any>(null);

  // UI State
  const [selectedSquare, setSelectedSquare] = useState<{r: number, c: number} | null>(null);
  const [realtimeEval, setRealtimeEval] = useState({ evaluation: 0, mate: null as number | null });
  const [moveError, setMoveError] = useState<string | null>(null);
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const [drawOffered, setDrawOffered] = useState<string | null>(null);

  useEffect(() => {
    if (!moveError) return;
    const timer = setTimeout(() => {
      setMoveError(null);
    }, 3500);
    return () => clearTimeout(timer);
  }, [moveError]);
  const [premoveService] = useState(() => new PremoveService());
  const [premoves, setPremoves] = useState<Premove[]>([]);

  const executePremove = (pm: Premove) => {
    if (!activeRoom || gameOver) return;
    try {
      const move = chess.move({ from: pm.source, to: pm.target, promotion: pm.promotion || 'q' });
      if (move) {
        setFen(chess.fen());
        socketService.makeMove(activeRoom, pm.source, pm.target, pm.promotion || 'q');
        playSound(getMoveSoundEvent(chess));
      }
    } catch {
      // Ignored
    }
  };

  // Calculate move number to know if we can abort (moves <= 2)
  const isAbortable = chess.history().length < 2;

  // Update timers locally
  useEffect(() => {
    if (!activeRoom || gameOver) return;
    
    const interval = setInterval(() => {
      if (chess.turn() === 'w') {
        setWhiteTime(t => {
          const nextTime = Math.max(0, t - 0.1);
          if (nextTime > 0 && nextTime <= 10 && !whiteLowTimePlayed.current) {
            whiteLowTimePlayed.current = true;
            playSound("lowTime");
          }
          return nextTime;
        });
      } else {
        setBlackTime(t => {
          const nextTime = Math.max(0, t - 0.1);
          if (nextTime > 0 && nextTime <= 10 && !blackLowTimePlayed.current) {
            blackLowTimePlayed.current = true;
            playSound("lowTime");
          }
          return nextTime;
        });
      }
    }, 100);

    return () => clearInterval(interval);
  }, [activeRoom, gameOver, chess, playSound]);

  // Update evaluation
  useEffect(() => {
    if (!activeRoom || gameOver) return;
    let cancelled = false;
    getEvaluation(fen, 10).then(res => {
      if (!cancelled) setRealtimeEval({ evaluation: res.evaluation || 0, mate: res.mate });
    });
    return () => { cancelled = true; };
  }, [fen, activeRoom, gameOver]);

  // Clear tournament data from location state after init
  useEffect(() => {
    if (tournamentData) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, []);

  // Socket connection and events
  useEffect(() => {
    const socket = socketService.connect();

    socket.on('game_started', (data) => {
      setIsSearching(false);
      setActiveRoom(data.roomId);
      setWhitePlayer(data.white);
      setBlackPlayer(data.black);
      
      // We check if we are black based on user ID or socket ID.
      // For now, if socket.id matches black.id or the user id matches
      const currentUser = authService.getCurrentUser();
      if (data.black.id.includes(socket.id) || (currentUser && data.black.id === currentUser.id)) {
        setPlayerColor("b");
      } else {
        setPlayerColor("w");
      }

      chess.load(data.fen);
      setFen(data.fen);
      setWhiteTime(data.whiteTime);
      setBlackTime(data.blackTime);
      setGameOver(null);
      setOpponentDisconnected(false);
      setDrawOffered(null);
      setIsTournament(data.isTournament || false);
      setTournamentId(data.tournamentId || null);

      whiteLowTimePlayed.current = false;
      blackLowTimePlayed.current = false;
      playSound("gameStart");
    });

    socket.on('game_reconnected', (data) => {
      setIsSearching(false);
      setActiveRoom(data.roomId);
      setWhitePlayer(data.white);
      setBlackPlayer(data.black);
      
      const currentUser = authService.getCurrentUser();
      if (data.black.id.includes(socket.id) || (currentUser && data.black.id === currentUser.id)) {
        setPlayerColor("b");
      } else {
        setPlayerColor("w");
      }

      chess.load(data.fen);
      setFen(data.fen);
      setWhiteTime(data.whiteTime);
      setBlackTime(data.blackTime);
      setGameOver(null);
      setOpponentDisconnected(false);
      setDrawOffered(null);
      setIsTournament(data.isTournament || false);
      setTournamentId(data.tournamentId || null);

      whiteLowTimePlayed.current = false;
      blackLowTimePlayed.current = false;
      playSound("gameStart");
    });

    socket.on('opponent_disconnected', () => {
      setOpponentDisconnected(true);
      playSound("notification");
    });

    socket.on('opponent_reconnected', () => {
      setOpponentDisconnected(false);
      playSound("notification");
    });

    socket.on('draw_offered', (data) => {
      setDrawOffered(data.offeredBy);
      playSound("notification");
    });

    socket.on('move_made', (data) => {
      chess.load(data.fen);
      setFen(data.fen);
      setWhiteTime(data.whiteTime);
      setBlackTime(data.blackTime);
      playSound(getMoveSoundEvent(chess));

      // We need to evaluate premoves here
      // But we can't reliably read the fresh `playerColor` if this effect doesn't capture it.
      // Actually we have access to chess.turn(). 
      // If it's our turn now, execute premove
      setPremoves((currentPremoves) => {
        if (currentPremoves.length > 0) {
          // Verify if first premove is valid
          const pm = currentPremoves[0];
          const tempChess = new Chess(data.fen);
          try {
            tempChess.move({ from: pm.source, to: pm.target, promotion: pm.promotion || 'q' });
            // It's valid, we should execute it. But we can't emit from inside a setState safely without side effects.
            // We'll queue a timeout
            setTimeout(() => executePremove(pm), 50);
            return currentPremoves.slice(1);
          } catch {
            // Invalidated
            premoveService.clearQueue();
            return [];
          }
        }
        return currentPremoves;
      });
    });

    socket.on('move_error', (data) => {
      console.warn('Move error:', data.error);
      premoveService.clearQueue();
      setPremoves([]);
      playSound("illegal");
    });

    socket.on('game_over', (data) => {
      setGameOver(data);
      premoveService.clearQueue();
      setPremoves([]);
      
      // Play staggered game-over sound effects
      playSound("gameEnd");
      setTimeout(() => {
        if (data.winner === null || data.winner === 'draw') {
          playSound("draw");
        } else {
          // Convert playerColor ("w" / "b") to "white" / "black" for match comparison
          const myWinnerColor = playerColor === "w" ? "white" : "black";
          if (data.winner === myWinnerColor) {
            playSound("win");
          } else {
            playSound("lose");
          }
        }
      }, 300);
    });

    return () => {
      socket.off('game_started');
      socket.off('game_reconnected');
      socket.off('opponent_disconnected');
      socket.off('opponent_reconnected');
      socket.off('draw_offered');
      socket.off('move_made');
      socket.off('move_error');
      socket.off('game_over');
      // Do not disconnect completely, just clean up listeners
    };
  }, [chess, playSound, activeRoom, location.state, navigate, playerColor]);

  const handleFindMatch = (minutes: number, increment: number, category: string) => {
    setIsSearching(true);
    socketService.findMatch({ minutes, increment, category });
  };

  const handleCancelSearch = () => {
    socketService.cancelMatch();
    setIsSearching(false);
  };

  // Convert "e2" to {r, c}
  const algebraicToSquare = (sq: string) => {
    const col = sq.charCodeAt(0) - 97;
    const row = parseInt(sq[1]) - 1;
    return { r: row, c: col };
  };

  // Convert {r, c} to "e2"
  const squareToAlgebraic = (r: number, c: number) => {
    return `${String.fromCharCode(97 + c)}${r + 1}`;
  };

  // Build 2D board for ChessBoard component
  const getBoardView = (): (FENChar | null)[][] => {
    const board = chess.board();
    const view: (FENChar | null)[][] = Array.from({ length: 8 }, () => Array(8).fill(null));
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[7 - r][c]; // chess.js board is top-down (0 is rank 8)
        if (piece) {
          view[r][c] = (piece.color === 'w' ? piece.type.toUpperCase() : piece.type) as FENChar;
        }
      }
    }
    return view;
  };

  const getCheckState = (): CheckState => {
    const isInCheck = chess.inCheck();
    if (!isInCheck) return { isInCheck: false };
    
    const turn = chess.turn();
    const kingChar = turn === 'w' ? 'K' : 'k';
    const boardView = getBoardView();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (boardView[r][c] === kingChar) {
          return { isInCheck: true, x: r, y: c };
        }
      }
    }
    return { isInCheck: true, x: 0, y: 0 };
  };

  const handleSquareClick = (r: number, c: number) => {
    if (!activeRoom || gameOver) return;

    const isPmoving = chess.turn() !== playerColor;

    if (!selectedSquare) {
      setSelectedSquare({ r, c });
    } else {
      const sourceAlg = squareToAlgebraic(selectedSquare.r, selectedSquare.c);
      const targetAlg = squareToAlgebraic(r, c);
      
      if (isPmoving) {
        premoveService.addPremove({ source: sourceAlg, target: targetAlg });
        setPremoves(premoveService.getQueue());
        playSound("premove");
      } else {
        try {
          const move = chess.move({ from: sourceAlg, to: targetAlg, promotion: 'q' });
          if (move) {
            setFen(chess.fen()); // Optimistic update
            socketService.makeMove(activeRoom, sourceAlg, targetAlg, 'q');
            playSound(getMoveSoundEvent(chess));
          }
        } catch {
          const reason = getIllegalMoveReasonChessJS(chess, sourceAlg, targetAlg);
          setMoveError(reason);
          playSound("illegal");
        }
      }
      setSelectedSquare(null);
    }
  };

  const handleResign = () => {
    if (activeRoom && !gameOver) {
      socketService.resign(activeRoom);
    }
  };

  const handleOfferDraw = () => {
    if (activeRoom && !gameOver) {
      socketService.offerDraw(activeRoom);
      // Optimistically assume we offered
      setDrawOffered(playerColor);
    }
  };

  const handleAbort = () => {
    if (activeRoom && !gameOver && isAbortable) {
      socketService.resign(activeRoom); // Using resign as abort if < 2 moves
    }
  };

  const flipMode = playerColor === "b";
  const myTime = flipMode ? blackTime : whiteTime;
  const oppTime = flipMode ? whiteTime : blackTime;
  const myName = flipMode ? blackPlayer?.username : whitePlayer?.username;
  const oppName = flipMode ? whitePlayer?.username : blackPlayer?.username;

  if (!activeRoom) {
    return (
      <div className="view-container flex-center" style={{ flexDirection: "column", gap: "2rem" }}>
        <button className="back-to-dashboard-btn" onClick={() => navigate("/")} style={{ position: "absolute", top: "1rem", left: "1rem" }}>
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </button>
        
        <h2 className="text-3xl font-bold gradient-text">Play Online</h2>
        
        {!isSearching ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <button className="glass-panel" style={{ padding: '24px', transition: 'all 0.2s' }} onClick={() => handleFindMatch(1, 0, 'bullet')}>
              <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>Bullet</h3>
              <p style={{ color: 'var(--text-muted)' }}>1 min</p>
            </button>
            <button className="glass-panel" style={{ padding: '24px', transition: 'all 0.2s' }} onClick={() => handleFindMatch(3, 2, 'blitz')}>
              <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>Blitz</h3>
              <p style={{ color: 'var(--text-muted)' }}>3 min + 2s</p>
            </button>
            <button className="glass-panel" style={{ padding: '24px', transition: 'all 0.2s' }} onClick={() => handleFindMatch(10, 0, 'rapid')}>
              <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>Rapid</h3>
              <p style={{ color: 'var(--text-muted)' }}>10 min</p>
            </button>
            <button className="glass-panel" style={{ padding: '24px', transition: 'all 0.2s' }} onClick={() => handleFindMatch(30, 0, 'classical')}>
              <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>Classical</h3>
              <p style={{ color: 'var(--text-muted)' }}>30 min</p>
            </button>
          </div>
        ) : (
          <div className="glass-panel flex-center" style={{ padding: '32px', flexDirection: 'column', gap: '16px' }}>
            <Loader2 size={48} style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite' }} />
            <h3 style={{ fontSize: '20px' }}>Finding opponent...</h3>
            <button className="btn-secondary" style={{ marginTop: '16px' }} onClick={handleCancelSearch}>Cancel</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="view-container">
      {moveError && (
        <div className="invalid-move-toast">
          <AlertTriangle size={16} />
          <span>{moveError}</span>
        </div>
      )}
      <div className="back-bar">
        <button className="back-to-dashboard-btn" onClick={() => {
          if (!gameOver && window.confirm("Are you sure you want to abandon the match?")) {
            handleResign();
            setActiveRoom(null);
          } else if (gameOver) {
            setActiveRoom(null);
          }
        }}>
          <ArrowLeft size={16} />
          <span>Leave Match</span>
        </button>
      </div>

      <main className="game-grid">
        <div className="board-col flex-center">
          <div className="board-game-container">
            {/* Opponent Info */}
            <div className="player-row top-row">
              <div className="player-info-container">
                <span className="player-title">{oppName || "Opponent"}</span>
                {opponentDisconnected && <span className="text-red-400 text-xs ml-2">(Disconnected - 60s to reconnect)</span>}
              </div>
              <ChessTimer timeLeftMs={oppTime * 1000} isActive={chess.turn() !== playerColor && !gameOver} playerName="Opp" isLowTime={oppTime < 15} />
            </div>

            {/* Board */}
            <div className="board-inner-stack">
              <EvaluationBar evaluation={realtimeEval.evaluation} mate={realtimeEval.mate} flipMode={flipMode} />
              <div style={{ position: "relative", flex: 1 }}>
                <ChessBoard
                  boardView={getBoardView()}
                  playerColor={playerColor === "w" ? Color.White : Color.Black}
                  selectedSquare={selectedSquare ? { x: selectedSquare.r, y: selectedSquare.c } : null}
                  pieceSafeSquares={[]}
                  lastMove={undefined} // We can derive this if we parse chess.history
                  checkState={getCheckState()}
                  flipMode={flipMode}
                  isPromotionActive={false}
                  promotionCoords={null}
                  onSquareClick={handleSquareClick}
                  onPromotePiece={() => {}}
                  onClosePromotion={() => {}}
                  hintSquares={null}
                  boardTheme={boardTheme}
                  pieceStyle={pieceStyle}
                  isReviewingWalkthrough={false}
                  premoves={premoves.map(pm => {
                    const fromSq = algebraicToSquare(pm.source);
                    const toSq = algebraicToSquare(pm.target);
                    return {
                      from: { x: fromSq.r, y: fromSq.c },
                      to: { x: toSq.r, y: toSq.c }
                    };
                  })}
                />
              </div>
            </div>

            {/* My Info */}
            <div className="player-row bottom-row">
              <div className="player-info-container">
                <span className="player-title text-indigo-400">{myName || "You"}</span>
              </div>
              <ChessTimer timeLeftMs={myTime * 1000} isActive={chess.turn() === playerColor && !gameOver} playerName="You" isLowTime={myTime < 15} />
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="sidebar-col">
          <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 'bold' }}>Match Controls</h3>
            
            {gameOver ? (
              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                <h4 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>Game Over</h4>
                <p style={{ color: 'var(--text-muted)' }}>
                  {gameOver.reason === "checkmate" ? `${gameOver.winner} wins by checkmate` :
                   gameOver.reason === "resignation" ? `${gameOver.winner} wins by resignation` :
                   gameOver.reason === "timeout" ? `${gameOver.winner} wins on time` :
                   gameOver.reason === "agreement" ? `Draw by agreement` :
                   gameOver.reason === "abandoned" ? `${gameOver.winner} wins by abandonment` :
                   "Draw"}
                </p>
                <PgnExport 
                  pgn={(() => {
                    chess.header(
                      'Event', isTournament ? `Tournament: ${tournamentId}` : 'Live Match',
                      'Site', 'KingsGauntlet',
                      'Date', new Date().toISOString().split('T')[0],
                      'Round', '1',
                      'White', whitePlayer?.username || 'White',
                      'Black', blackPlayer?.username || 'Black',
                      'Result', gameOver.winner === 'white' ? '1-0' : gameOver.winner === 'black' ? '0-1' : '1/2-1/2',
                      'TimeControl', '-'
                    );
                    return chess.pgn();
                  })()} 
                  filename={`kg_match_${new Date().toISOString().split('T')[0]}.pgn`} 
                />
                <button className="btn-accent" style={{ marginTop: '16px', width: '100%' }} onClick={() => {
                  setActiveRoom(null);
                  if (isTournament && tournamentId) {
                    navigate(`/tournaments/${tournamentId}`);
                  }
                }}>
                  {isTournament ? "Return to Tournament" : "New Game"}
                </button>
              </div>
            ) : (
              <>
                <button className="btn-secondary flex-center gap-2" onClick={() => {
                  if (window.confirm("Are you sure you want to resign?")) handleResign();
                }}>
                  <Flag size={16} />
                  <span>Resign</span>
                </button>

                <button className="btn-secondary flex-center gap-2" onClick={handleOfferDraw}>
                  <span>{drawOffered === (playerColor === 'w' ? 'b' : 'w') ? 'Accept Draw' : '½ Offer Draw'}</span>
                </button>

                {isAbortable && (
                  <button className="btn-secondary flex-center gap-2 text-red-400" onClick={handleAbort}>
                    <RotateCcw size={16} />
                    <span>Abort Game</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

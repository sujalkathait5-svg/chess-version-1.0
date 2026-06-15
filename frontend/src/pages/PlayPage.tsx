// frontend/src/pages/PlayPage.tsx
import { useMemo } from "react";
import { useGame } from "../hooks/useGame";
import { useTheme } from "../hooks/useTheme";
import { Color, classificationImagePaths, getPieceImgPath } from "../chess-logic/models";
import { ChessBoard } from "../components/ChessBoard";
import { GameSettings } from "../components/GameSettings";
import { MoveList } from "../components/MoveList";
import { ChessTimer } from "../components/ChessTimer";
import { EvaluationBar } from "../components/EvaluationBar";
import { BoardOverlayBadges } from "../components/BoardOverlayBadges";
import { getOpeningName } from "../services/openings";
import { calculateMaterial } from "../utils/chess-helpers";
import { Trophy, Copy, Download, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSound } from "../hooks/useSound";

export function PlayPage() {
  const navigate = useNavigate();
  const game = useGame();
  const { boardTheme, pieceStyle, showMoveHints } = useTheme();

  const {
    boardView, playerColor, selectedSquare, pieceSafeSquares, lastMove, checkState,
    flipMode, setFlipMode, isPromotionActive, promotionCoords,
    handleSquareClick, handlePromotePiece, handleClosePromotion,
    hintSquares, realtimeEval, gameOverMessage, gameEndState,
    gameMode, computerColor, computerLevel, activeTimeControl,
    whiteTime, blackTime, moveList, gameHistory, gameHistoryPointer,
    showPreviousPosition, handleUndo, handleRedo, boardInstance,
    handleResetGame, handleResign, handleOfferDraw, handleAbort,
    isHintLoading, reviewStats, reviewMoveIndex, isReviewingWalkthrough,
  } = game;

  const { soundEnabled, toggleSound } = useSound();
  const { autoFlip, toggleAutoFlip } = useTheme();

  // Flatten moves for opening detection
  const getFlatMoves = (moves: typeof moveList) => {
    const flat: string[] = [];
    moves.forEach(pair => { flat.push(pair[0]); if (pair[1]) flat.push(pair[1]); });
    return flat;
  };

  const currentOpening = getOpeningName(getFlatMoves(moveList).slice(0, gameHistoryPointer));

  // Review badge
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

  // Material
  const currentFen = isReviewingWalkthrough
    ? (gameHistory[reviewMoveIndex + 1]?.fen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")
    : (gameHistory[gameHistory.length - 1]?.fen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const materialState = calculateMaterial(currentFen);

  // PGN
  const generatePGNString = (finalResult: string = "*") => {
    let pgnText = "";
    pgnText += `[Event "Casual Match"]\n`;
    pgnText += `[Site "KingsGauntlet Chess Arena"]\n`;
    pgnText += `[Date "${new Date().toISOString().split("T")[0]}"]\n`;
    pgnText += `[White "${gameMode === "computer" && computerColor === Color.White ? "Stockfish CPU" : "Player White"}"]\n`;
    pgnText += `[Black "${gameMode === "computer" && computerColor === Color.Black ? "Stockfish CPU" : "Player Black"}"]\n`;
    pgnText += `[Result "${finalResult}"]\n\n`;
    moveList.forEach((pair, idx) => { pgnText += `${idx + 1}. ${pair[0]} ${pair[1] || ""} `; });
    return pgnText.trim();
  };

  const handleCopyPGN = () => {
    const pgn = generatePGNString(gameOverMessage || "*");
    navigator.clipboard.writeText(pgn).then(() => alert("PGN copied to clipboard!"));
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

  return (
    <div className="view-container">
      <div className="back-bar">
        <button className="back-to-dashboard-btn" onClick={() => navigate("/")}>
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </button>
      </div>
      <main className="game-grid">
        {/* Left Column: Chess Board */}
        <div className="board-col flex-center">
          <div className="board-game-container">
            {/* Opponent Info Row */}
            <div className="player-row top-row">
              <div className="player-info-container">
                <span className="player-title">
                  {gameMode === "computer"
                    ? `Stockfish Lvl ${computerLevel}`
                    : (flipMode ? "Player White" : "Player Black")}
                </span>
                <div className="captured-pieces">
                  {(flipMode ? materialState.capturedByWhite : materialState.capturedByBlack).map((p, i) => (
                    <img key={i} src={getPieceImgPath(p, pieceStyle)} className={`captured-piece-img ${p === p.toUpperCase() ? "white-piece" : "black-piece"}`} alt={p} />
                  ))}
                  {(flipMode ? materialState.whiteAdvantage : materialState.blackAdvantage) > 0 && (
                    <span className="material-advantage">+{flipMode ? materialState.whiteAdvantage : materialState.blackAdvantage}</span>
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

            {/* Board and Eval Bar */}
            <div className="board-inner-stack">
              <EvaluationBar evaluation={realtimeEval.evaluation} mate={realtimeEval.mate} flipMode={flipMode} />
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
                      {isReviewingWalkthrough && reviewBadge && (
                        <div
                          key={reviewBadge.key}
                          className="review-overlay-highlight"
                          style={{
                            bottom: `${flipMode ? (7 - reviewBadge.x) * 12.5 : reviewBadge.x * 12.5}%`,
                            left: `${flipMode ? (7 - reviewBadge.y) * 12.5 : reviewBadge.y * 12.5}%`,
                          }}
                        >
                          <img src={reviewBadge.imgSrc} alt={reviewBadge.classification} className="review-overlay-img" />
                        </div>
                      )}
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

            {/* Your Info Row */}
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
                    <span className="material-advantage">+{!flipMode ? materialState.whiteAdvantage : materialState.blackAdvantage}</span>
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

        {/* Right Column: Game Controls */}
        <div className="sidebar-col">
          <GameSettings
            gameMode={gameMode}
            computerColor={computerColor}
            computerLevel={computerLevel}
            activeColor={playerColor}
            soundEnabled={soundEnabled}
            onToggleSound={toggleSound}
            onFlipBoard={() => setFlipMode(!flipMode)}
            onResetGame={handleResetGame}
            onTriggerComputerMode={() => navigate("/play?mode=computer")}
            onTriggerFriendMode={() => {
              game.handlePlayFriend();
            }}
            gameOverMessage={gameOverMessage}
            onResign={handleResign}
            onOfferDraw={handleOfferDraw}
            onAbort={handleAbort}
            onExitMatch={() => navigate("/")}
            autoFlip={autoFlip}
            onToggleAutoFlip={toggleAutoFlip}
            onShowHint={game.handleShowHint}
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

          {gameOverMessage && (
            <button
              className="review-game-trigger-btn flex-center"
              onClick={() => navigate("/review")}
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
  );
}

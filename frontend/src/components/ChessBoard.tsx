import React, { useState } from "react";
import { Color, FENChar, getPieceImgPath } from "../chess-logic/models";
import type { Coords, CheckState, LastMove } from "../chess-logic/models";

interface ChessBoardProps {
  boardView: (FENChar | null)[][];
  playerColor: Color; // current active player turn color
  selectedSquare: { x: number; y: number } | null;
  pieceSafeSquares: Coords[];
  lastMove: LastMove | undefined;
  checkState: CheckState;
  flipMode: boolean;
  isPromotionActive: boolean;
  promotionCoords: Coords | null;
  onSquareClick: (x: number, y: number) => void;
  onPromotePiece: (piece: FENChar) => void;
  onClosePromotion: () => void;
  overlayChildren?: React.ReactNode;
  hintSquares?: { from: { x: number; y: number }; to: { x: number; y: number } } | null;
  reviewBestMove?: { from: { x: number; y: number }; to: { x: number; y: number } } | null;
  boardTheme?: string;
  pieceStyle?: string;
  isReviewingWalkthrough?: boolean;
  premoves?: { from: { x: number; y: number }; to: { x: number; y: number } }[];
}

const ChessBoardComponent: React.FC<ChessBoardProps> = ({
  boardView,
  playerColor,
  selectedSquare,
  pieceSafeSquares,
  lastMove,
  checkState,
  flipMode,
  isPromotionActive,
  promotionCoords,
  onSquareClick,
  onPromotePiece,
  onClosePromotion,
  overlayChildren,
  hintSquares,
  reviewBestMove,
  boardTheme = "wood",
  pieceStyle = "neo",
  premoves = [],
}) => {
  const rows = flipMode ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  const cols = flipMode ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];

  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];

  const [dragState, setDragState] = useState<{ originX: number; originY: number; piece: FENChar; width: number; height: number } | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number, y: number }>({ x: 0, y: 0 });

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>, x: number, y: number) => {
    if (e.button !== 0 && e.pointerType === 'mouse') {
      onSquareClick(x, y);
      return;
    }
    const piece = boardView[x][y];
    if (!piece) {
      onSquareClick(x, y);
      return;
    }
    
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragState({ originX: x, originY: y, piece, width: rect.width, height: rect.height });
    setDragPos({ x: e.clientX, y: e.clientY });
    onSquareClick(x, y);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragState) {
      setDragPos({ x: e.clientX, y: e.clientY });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragState) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      
      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      const squareEl = elements.find(el => el.classList.contains('square')) as HTMLElement;
      
      if (squareEl) {
        const dropX = parseInt(squareEl.getAttribute('data-x') || "-1", 10);
        const dropY = parseInt(squareEl.getAttribute('data-y') || "-1", 10);
        if (dropX !== -1 && dropY !== -1 && (dropX !== dragState.originX || dropY !== dragState.originY)) {
          onSquareClick(dropX, dropY);
        }
      }
      setDragState(null);
    }
  };

  const isSquareDark = (x: number, y: number): boolean => {
    return (x % 2 === 0 && y % 2 === 0) || (x % 2 === 1 && y % 2 === 1);
  };

  const isSelected = (x: number, y: number): boolean => {
    return !!selectedSquare && selectedSquare.x === x && selectedSquare.y === y;
  };

  const isSafe = (x: number, y: number): boolean => {
    return pieceSafeSquares.some((coords) => coords.x === x && coords.y === y);
  };

  const isLastMove = (x: number, y: number): boolean => {
    if (!lastMove) return false;
    return (
      (lastMove.prevX === x && lastMove.prevY === y) ||
      (lastMove.currX === x && lastMove.currY === y)
    );
  };

  const isKingChecked = (x: number, y: number): boolean => {
    return checkState.isInCheck && checkState.x === x && checkState.y === y;
  };

  const isHintSquare = (x: number, y: number): "from" | "to" | false => {
    if (!hintSquares) return false;
    if (hintSquares.from.x === x && hintSquares.from.y === y) return "from";
    if (hintSquares.to.x === x && hintSquares.to.y === y) return "to";
    return false;
  };

  const getSquareCenter = (x: number, y: number) => {
    const row = flipMode ? x : 7 - x;
    const col = flipMode ? 7 - y : y;
    return {
      cx: (col * 12.5) + 6.25,
      cy: (row * 12.5) + 6.25
    };
  };

  // Promotion choice pieces for active turn
  const getPromotionChoices = (): FENChar[] => {
    // Note: playerColor is active color (whose turn it is)
    // If promotion occurs, it's the active player choosing.
    return playerColor === Color.White
      ? [
          FENChar.WhiteQueen,
          FENChar.WhiteRook,
          FENChar.WhiteBishop,
          FENChar.WhiteKnight,
        ]
      : [
          FENChar.BlackQueen,
          FENChar.BlackRook,
          FENChar.BlackBishop,
          FENChar.BlackKnight,
        ];
  };

  return (
    <div className="chess-container flex-center">
      <div className="board-outer-container glass-panel">
        <div className={`chess-board-grid board-theme-${boardTheme}`}>
          {rows.map((x) =>
            cols.map((y) => {
              const piece = boardView[x][y];
              const dark = isSquareDark(x, y);
              const selected = isSelected(x, y);
              const safe = isSafe(x, y);
              const last = isLastMove(x, y);
              const checked = isKingChecked(x, y);
              const hintType = isHintSquare(x, y);
              const isPromotingHere =
                isPromotionActive &&
                promotionCoords &&
                promotionCoords.x === x &&
                promotionCoords.y === y;

              return (
                <div
                  key={`${x}-${y}`}
                  data-x={x}
                  data-y={y}
                  className={`square ${dark ? "dark" : "light"} ${
                    selected ? "selected" : ""
                  } ${last ? "last-move" : ""} ${checked ? "checked-king" : ""} ${hintType ? "hint-square" : ""} ${isPromotingHere ? "promoting-square" : ""}`}
                  onPointerDown={(e) => handlePointerDown(e, x, y)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                >
                  {/* Render Rank Label (Leftmost Column) */}
                  {((!flipMode && y === 0) || (flipMode && y === 7)) && (
                    <span className="coord-label rank-label">{x + 1}</span>
                  )}

                  {/* Render File Label (Bottom Row) */}
                  {((!flipMode && x === 0) || (flipMode && x === 7)) && (
                    <span className="coord-label file-label">{files[y]}</span>
                  )}

                  {/* Render Piece */}
                  {piece && (
                    <img
                      src={getPieceImgPath(piece, pieceStyle)}
                      alt={piece}
                      className="piece-img"
                      draggable="false"
                      onDragStart={(e) => e.preventDefault()}
                      width="100%"
                      height="100%"
                      style={{ 
                        display: 'block', 
                        imageRendering: '-webkit-optimize-contrast',
                        opacity: dragState && dragState.originX === x && dragState.originY === y ? 0.3 : 1
                      }}
                    />
                  )}

                  {/* Safe Move Highlights */}
                  {safe && (
                    <div className="safe-indicator-overlay">
                      <div className="safe-dot"></div>
                    </div>
                  )}

                  {/* Best Move Hint Highlight */}
                  {hintType && (
                    <div className={`hint-overlay hint-${hintType}`} />
                  )}

                  {/* Promotion Overlay Dialog */}
                  {isPromotingHere && (
                    <div className="promotion-overlay glass-panel">
                      <div className="promotion-title">Promote</div>
                      <div className="promotion-choices">
                        {getPromotionChoices().map((choice) => (
                          <button
                            key={choice}
                            className="promotion-choice-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              onPromotePiece(choice);
                            }}
                          >
                            <img src={getPieceImgPath(choice, pieceStyle)} alt={choice} width="60" height="60" style={{ display: 'block' }} />
                          </button>
                        ))}
                      </div>
                      <button
                        className="promotion-cancel-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onClosePromotion();
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Dragged Piece Overlay */}
        {dragState && (
          <img
            src={getPieceImgPath(dragState.piece, pieceStyle)}
            alt={dragState.piece}
            style={{
              position: 'fixed',
              left: dragPos.x,
              top: dragPos.y,
              transform: 'translate(-50%, -50%)',
              width: dragState.width * 0.82,
              height: dragState.height * 0.82,
              pointerEvents: 'none',
              zIndex: 9999,
              filter: 'drop-shadow(0 10px 15px rgba(0,0,0,0.5))'
            }}
          />
        )}

        {/* SVG Arrow Overlay for Review Best Move */}
        {reviewBestMove && (
          <svg className="board-arrows-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <marker
                id="arrowhead"
                markerWidth="3.5"
                markerHeight="3.5"
                refX="2.5"
                refY="1.75"
                orient="auto-start-reverse"
              >
                <polygon points="0 0, 3.5 1.75, 0 3.5" fill="var(--accent-primary)" opacity="0.8" />
              </marker>
            </defs>
            <line
              x1={`${getSquareCenter(reviewBestMove.from.x, reviewBestMove.from.y).cx}%`}
              y1={`${getSquareCenter(reviewBestMove.from.x, reviewBestMove.from.y).cy}%`}
              x2={`${getSquareCenter(reviewBestMove.to.x, reviewBestMove.to.y).cx}%`}
              y2={`${getSquareCenter(reviewBestMove.to.x, reviewBestMove.to.y).cy}%`}
              stroke="var(--accent-primary)"
              strokeWidth="1.8"
              opacity="0.8"
              markerEnd="url(#arrowhead)"
              className="best-move-arrow"
            />
          </svg>
        )}

        {/* Premove Arrows */}
        {premoves.length > 0 && (
          <svg className="board-arrows-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <marker
                id="premove-arrowhead"
                markerWidth="3.5"
                markerHeight="3.5"
                refX="2.5"
                refY="1.75"
                orient="auto-start-reverse"
              >
                <polygon points="0 0, 3.5 1.75, 0 3.5" fill="var(--accent-warning)" opacity="0.8" />
              </marker>
            </defs>
            {premoves.map((pm, idx) => (
              <line
                key={`pm-${idx}`}
                x1={`${getSquareCenter(pm.from.x, pm.from.y).cx}%`}
                y1={`${getSquareCenter(pm.from.x, pm.from.y).cy}%`}
                x2={`${getSquareCenter(pm.to.x, pm.to.y).cx}%`}
                y2={`${getSquareCenter(pm.to.x, pm.to.y).cy}%`}
                stroke="var(--accent-warning)"
                strokeWidth="1.8"
                opacity="0.8"
                markerEnd="url(#premove-arrowhead)"
                className="best-move-arrow"
              />
            ))}
          </svg>
        )}

        {/* Board overlay badges (Winner, Resign, Draw, Checkmate) */}
        {overlayChildren && (
          <div className="board-badge-overlay-layer">
            {overlayChildren}
          </div>
        )}
      </div>

      <style>{`
        .chess-container {
          width: 100%;
          max-width: 600px;
          margin: 0 auto;
          aspect-ratio: 1 / 1;
        }

        .board-outer-container {
          width: 100%;
          padding: 8px;
          position: relative;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
          overflow: visible;
        }

        /* Absolute layer that covers the board grid for overlay badges */
        .board-badge-overlay-layer {
          position: absolute;
          /* sits over the inner grid (inside the 8px padding) */
          top: 8px;
          left: 8px;
          right: 8px;
          bottom: 8px;
          pointer-events: none;
          z-index: 40;
        }

        .chess-board-grid {
          display: grid;
          grid-template-columns: repeat(8, 1fr);
          grid-template-rows: repeat(8, 1fr);
          width: 100%;
          aspect-ratio: 1 / 1;
          border-radius: 8px;
          overflow: visible;
          background: var(--bg-secondary);
        }

        .chess-board-grid.board-theme-wood {
          --square-light: #e8d5b7;
          --square-dark: #6b4c2a;
          --square-safe: rgba(0, 0, 0, 0.18);
          --square-selected: rgba(245, 158, 11, 0.45);
          --square-last-move: rgba(251, 191, 36, 0.4);
          --square-hint-from: rgba(56, 189, 248, 0.3);
          --square-hint-to: rgba(56, 189, 248, 0.45);
        }

        .chess-board-grid.board-theme-green {
          --square-light: #eeeed2;
          --square-dark: #769656;
          --square-safe: rgba(0, 0, 0, 0.18);
          --square-selected: rgba(247, 247, 105, 0.6);
          --square-last-move: rgba(247, 247, 105, 0.45);
          --square-hint-from: rgba(56, 189, 248, 0.3);
          --square-hint-to: rgba(56, 189, 248, 0.45);
        }

        .chess-board-grid.board-theme-blue {
          --square-light: #dee3e6;
          --square-dark: #8ca2ad;
          --square-safe: rgba(0, 0, 0, 0.18);
          --square-selected: rgba(56, 189, 248, 0.45);
          --square-last-move: rgba(247, 247, 105, 0.45);
          --square-hint-from: rgba(56, 189, 248, 0.3);
          --square-hint-to: rgba(56, 189, 248, 0.45);
        }

        .chess-board-grid.board-theme-dark {
          --square-light: #cfd8dc;
          --square-dark: #546e7a;
          --square-safe: rgba(0, 0, 0, 0.18);
          --square-selected: rgba(100, 116, 139, 0.45);
          --square-last-move: rgba(247, 247, 105, 0.45);
          --square-hint-from: rgba(56, 189, 248, 0.3);
          --square-hint-to: rgba(56, 189, 248, 0.45);
        }

        .chess-board-grid.board-theme-cyber {
          --square-light: #89a5df;
          --square-dark: #1e2235;
          --square-safe: rgba(255, 255, 255, 0.25);
          --square-selected: rgba(0, 82, 255, 0.5);
          --square-last-move: rgba(0, 255, 200, 0.3);
          --square-hint-from: rgba(236, 72, 153, 0.35);
          --square-hint-to: rgba(236, 72, 153, 0.5);
        }

        .chess-board-grid.board-theme-marble {
          --square-light: #f0d9b5;
          --square-dark: #b58863;
          --square-safe: rgba(0, 0, 0, 0.18);
          --square-selected: rgba(245, 158, 11, 0.45);
          --square-last-move: rgba(251, 191, 36, 0.4);
          --square-hint-from: rgba(56, 189, 248, 0.3);
          --square-hint-to: rgba(56, 189, 248, 0.45);
        }

        .square {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          user-select: none;
          cursor: pointer;
          transition: background-color var(--transition-fast);
        }

        .square.promoting-square {
          z-index: 50;
        }

        .square.light {
          background-color: var(--square-light);
          color: var(--square-dark);
        }

        .square.dark {
          background-color: var(--square-dark);
          color: var(--square-light);
        }

        /* Hover effect */
        .square:hover {
          filter: brightness(0.95);
        }

        /* Highlighting overlay states */
        .square.selected {
          background-color: var(--square-selected) !important;
        }

        .square.last-move {
          background-color: var(--square-last-move) !important;
        }

        .square.checked-king {
          background-color: var(--square-check) !important;
          animation: pulse-red 1.5s infinite alternate;
        }

        /* Pieces */
        .piece-img {
          width: 82%;
          height: 82%;
          object-fit: contain;
          z-index: 5;
          filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.25));
          transition: transform 0.2s ease;
        }

        .piece-img:hover {
          transform: scale(1.06);
        }

        /* Coordinates */
        .coord-label {
          position: absolute;
          font-size: 11px;
          font-weight: 700;
          opacity: 0.65;
          pointer-events: none;
        }

        .rank-label {
          top: 4px;
          left: 4px;
        }

        .file-label {
          bottom: 4px;
          right: 4px;
        }

        /* Legal move overlays */
        .safe-indicator-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          z-index: 10;
        }

        .safe-dot {
          width: 28%;
          height: 28%;
          border-radius: 50%;
          background: var(--square-safe);
        }

        /* ── Hint Square Highlights ── */
        .square.hint-square {
          position: relative;
        }

        .hint-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          z-index: 12;
        }

        .hint-overlay.hint-from {
          background: var(--square-hint-from);
          animation: hint-pulse 1.5s ease-in-out infinite;
        }

        .hint-overlay.hint-to {
          background: var(--square-hint-to);
          animation: hint-pulse 1.5s ease-in-out infinite 0.3s;
        }

        @keyframes hint-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }

        /* Promotion Dialog Overlay */
        .promotion-overlay {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 88%;
          padding: 8px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          z-index: 100;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.6);
          background: rgba(10, 15, 29, 0.95);
        }

        .promotion-title {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--accent-warning);
        }

        .promotion-choices {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 4px;
          width: 100%;
        }

        .promotion-choice-btn {
          aspect-ratio: 1 / 1;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.04);
          border-radius: 8px;
          border: 1px solid var(--glass-border);
          transition: all var(--transition-fast);
        }

        .promotion-choice-btn:hover {
          background: rgba(255, 255, 255, 0.15);
          border-color: var(--accent-warning);
          transform: scale(1.05);
        }

        .promotion-choice-btn img {
          width: 85%;
          height: 85%;
          object-fit: contain;
        }

        .promotion-cancel-btn {
          font-size: 10px;
          color: var(--text-muted);
          padding: 2px 8px;
          border-radius: 4px;
          background: rgba(255, 255, 255, 0.05);
          transition: background-color var(--transition-fast);
        }

        .promotion-cancel-btn:hover {
          color: var(--text-primary);
          background: rgba(255, 255, 255, 0.12);
        }

        /* Best Move Arrow SVG Overlay */
        .board-arrows-svg {
          position: absolute;
          top: 8px;
          left: 8px;
          right: 8px;
          bottom: 8px;
          width: calc(100% - 16px);
          height: calc(100% - 16px);
          pointer-events: none;
          z-index: 25;
        }

        .best-move-arrow {
          animation: arrow-fade-in 0.3s ease both;
        }

        @keyframes arrow-fade-in {
          from { opacity: 0; stroke-width: 0; }
          to { opacity: 0.8; stroke-width: 1.8; }
        }

        @keyframes pulse-red {
          from {
            box-shadow: inset 0 0 10px rgba(239, 68, 68, 0.3);
          }
          to {
            box-shadow: inset 0 0 25px rgba(239, 68, 68, 0.7);
          }
        }
      `}</style>
    </div>
  );
};

export const ChessBoard = React.memo(ChessBoardComponent, (prevProps, nextProps) => {
  return (
    prevProps.isReviewingWalkthrough === nextProps.isReviewingWalkthrough &&
    prevProps.boardView === nextProps.boardView &&
    prevProps.playerColor === nextProps.playerColor &&
    prevProps.selectedSquare?.x === nextProps.selectedSquare?.x &&
    prevProps.selectedSquare?.y === nextProps.selectedSquare?.y &&
    prevProps.pieceSafeSquares === nextProps.pieceSafeSquares &&
    prevProps.lastMove === nextProps.lastMove &&
    prevProps.checkState.isInCheck === nextProps.checkState.isInCheck &&
    (prevProps.checkState.isInCheck === false || (
      (prevProps.checkState as any).x === (nextProps.checkState as any).x &&
      (prevProps.checkState as any).y === (nextProps.checkState as any).y
    )) &&
    prevProps.flipMode === nextProps.flipMode &&
    prevProps.isPromotionActive === nextProps.isPromotionActive &&
    prevProps.promotionCoords?.x === nextProps.promotionCoords?.x &&
    prevProps.promotionCoords?.y === nextProps.promotionCoords?.y &&
    prevProps.hintSquares === nextProps.hintSquares &&
    prevProps.reviewBestMove === nextProps.reviewBestMove &&
    prevProps.boardTheme === nextProps.boardTheme &&
    prevProps.pieceStyle === nextProps.pieceStyle &&
    prevProps.overlayChildren === nextProps.overlayChildren &&
    prevProps.premoves === nextProps.premoves
  );
});

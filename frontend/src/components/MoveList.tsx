import React, { useEffect, useRef } from "react";
import type { MoveList as MoveListType, MoveAnalysis } from "../chess-logic/models";
import { classificationImagePaths } from "../chess-logic/models";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Undo2, Redo2 } from "lucide-react";

interface MoveListProps {
  moveList: MoveListType;
  gameHistoryPointer: number;
  gameHistoryLength: number;
  onShowPreviousPosition: (index: number) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  moveAnalyses?: MoveAnalysis[];
}

export const MoveList: React.FC<MoveListProps> = ({
  moveList,
  gameHistoryPointer,
  gameHistoryLength,
  onShowPreviousPosition,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  moveAnalyses,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom when new moves are added
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [moveList]);

  // Auto scroll to active move when navigating history or reviewing game
  useEffect(() => {
    if (containerRef.current) {
      if (gameHistoryPointer === 0) {
        containerRef.current.scrollTop = 0;
      } else {
        const activeEl = containerRef.current.querySelector(".move-btn.active");
        if (activeEl) {
          activeEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      }
    }
  }, [gameHistoryPointer]);

  return (
    <div className="move-list-panel glass-panel">
      <div className="panel-header">
        <h3>Move History</h3>
        <span className="move-count">{moveList.length * 2 - (moveList[moveList.length - 1]?.length === 1 ? 1 : 0)} ply</span>
      </div>

      <div className="history-navigation flex-center">
        <button
          className="nav-btn flex-center"
          disabled={gameHistoryPointer === 0}
          onClick={() => onShowPreviousPosition(0)}
          title="Go to Start"
        >
          <ChevronsLeft size={16} />
        </button>

        <button
          className="nav-btn flex-center"
          disabled={gameHistoryPointer === 0}
          onClick={() => onShowPreviousPosition(gameHistoryPointer - 1)}
          title="Previous Move"
        >
          <ChevronLeft size={16} />
        </button>

        <span className="step-indicator">
          {gameHistoryPointer} / {gameHistoryLength - 1}
        </span>

        <button
          className="nav-btn flex-center"
          disabled={gameHistoryPointer === gameHistoryLength - 1}
          onClick={() => onShowPreviousPosition(gameHistoryPointer + 1)}
          title="Next Move"
        >
          <ChevronRight size={16} />
        </button>

        <button
          className="nav-btn flex-center"
          disabled={gameHistoryPointer === gameHistoryLength - 1}
          onClick={() => onShowPreviousPosition(gameHistoryLength - 1)}
          title="Go to Live Position"
        >
          <ChevronsRight size={16} />
        </button>

        {(onUndo || onRedo) && (
          <div style={{ width: 1, height: 18, background: "rgba(255, 255, 255, 0.15)", margin: "0 6px" }} />
        )}

        {onUndo && (
          <button
            className="nav-btn flex-center"
            disabled={!canUndo}
            onClick={onUndo}
            title="Undo Move"
            style={{ color: canUndo ? "#f87171" : undefined }}
          >
            <Undo2 size={15} />
          </button>
        )}

        {onRedo && (
          <button
            className="nav-btn flex-center"
            disabled={!canRedo}
            onClick={onRedo}
            title="Redo Move"
            style={{ color: canRedo ? "#60a5fa" : undefined }}
          >
            <Redo2 size={15} />
          </button>
        )}
      </div>

      <div className="move-rows-container" ref={containerRef}>
        {moveList.length === 0 ? (
          <div className="empty-history flex-center">
            <span>No moves played yet</span>
          </div>
        ) : (
          <div className="move-rows-grid">
            {moveList.map((move, index) => {
              const whiteMoveIndex = index * 2 + 1;
              const blackMoveIndex = index * 2 + 2;

              return (
                <div key={index} className="move-row">
                  <span className="move-num">{index + 1}.</span>
                  
                  <button
                    className={`move-btn white-move ${
                      gameHistoryPointer === whiteMoveIndex ? "active" : ""
                    }`}
                    onClick={() => onShowPreviousPosition(whiteMoveIndex)}
                  >
                    {moveAnalyses && moveAnalyses[whiteMoveIndex - 1] && (
                      <img 
                        src={classificationImagePaths[moveAnalyses[whiteMoveIndex - 1].classification]} 
                        className="move-list-cat-icon" 
                        alt="" 
                      />
                    )}
                    <span>{move[0]}</span>
                  </button>

                  {move[1] && (
                    <button
                      className={`move-btn black-move ${
                        gameHistoryPointer === blackMoveIndex ? "active" : ""
                      }`}
                      onClick={() => onShowPreviousPosition(blackMoveIndex)}
                    >
                      {moveAnalyses && moveAnalyses[blackMoveIndex - 1] && (
                        <img 
                          src={classificationImagePaths[moveAnalyses[blackMoveIndex - 1].classification]} 
                          className="move-list-cat-icon" 
                          alt="" 
                        />
                      )}
                      <span>{move[1]}</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        .move-list-panel {
          display: flex;
          flex-direction: column;
          padding: 16px;
          min-height: 180px;
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          border-bottom: 1px solid var(--glass-border);
          padding-bottom: 8px;
        }

        .panel-header h3 {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .move-count {
          font-size: 12px;
          color: var(--text-muted);
          background: rgba(255, 255, 255, 0.05);
          padding: 2px 8px;
          border-radius: 20px;
        }

        .history-navigation {
          gap: 6px;
          margin-bottom: 12px;
          padding: 6px;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 8px;
          border: 1px solid var(--glass-border);
        }

        .nav-btn {
          width: 32px;
          height: 32px;
          border-radius: 6px;
          color: var(--text-secondary);
          background: transparent;
          transition: all var(--transition-fast);
        }

        .nav-btn:hover:not(:disabled) {
          color: var(--text-primary);
          background: rgba(255, 255, 255, 0.08);
        }

        .nav-btn:disabled {
          color: var(--text-muted);
          opacity: 0.4;
          cursor: not-allowed;
        }

        .step-indicator {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-secondary);
          min-width: 60px;
          text-align: center;
        }

        .move-rows-container {
          flex: 1;
          overflow-y: auto;
          max-height: 320px;
          padding-right: 4px;
        }

        .empty-history {
          height: 100px;
          color: var(--text-muted);
          font-size: 14px;
          font-style: italic;
        }

        .move-rows-grid {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .move-row {
          display: grid;
          grid-template-columns: 40px 1fr 1fr;
          align-items: center;
          padding: 6px 8px;
          border-radius: 6px;
          transition: background-color var(--transition-fast);
        }

        .move-row:hover {
          background: rgba(255, 255, 255, 0.02);
        }

        .move-num {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-muted);
        }

        .move-btn {
          padding: 4px 10px;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
          text-align: left;
          color: var(--text-primary);
          background: transparent;
          border: 1px solid transparent;
          transition: all var(--transition-fast);
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 4px;
        }

        .move-btn:hover {
          background: rgba(255, 255, 255, 0.06);
        }

        .move-btn.active {
          background: var(--accent-primary);
          color: white;
          box-shadow: 0 0 8px rgba(99, 102, 241, 0.4);
        }

        .move-list-cat-icon {
          width: 16px;
          height: 16px;
          object-fit: contain;
          flex-shrink: 0;
          margin-right: 4px;
        }

        .move-btn .move-list-cat-icon {
          filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
        }
      `}</style>
    </div>
  );
};

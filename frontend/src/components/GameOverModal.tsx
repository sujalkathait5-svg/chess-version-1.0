import React from "react";
import { Trophy, Calendar, Clock, RotateCcw, BarChart2, Download, Copy, LogOut, X, Sparkles, User, Cpu } from "lucide-react";

import type { GameEndState } from "../chess-logic/models";

interface GameOverModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameOverMessage: string;
  gameEndState: GameEndState | null;
  whiteName: string;
  blackName: string;
  gameMode: "friend" | "computer";
  timeControl: string;
  totalMoves: number;
  gameDuration: string; // "MM:SS" format
  whiteRatingBefore?: number;
  whiteRatingAfter?: number;
  blackRatingBefore?: number;
  blackRatingAfter?: number;
  onRematch: () => void;
  onRunReview: () => void;
  onCopyPGN: () => void;
  onDownloadPGN: () => void;
  onExitToDashboard: () => void;
}

const DRAW_REASON_LABELS: Record<string, string> = {
  "stalemate": "Stalemate — No legal moves",
  "draw-agreement": "Draw by Agreement",
  "repetition": "Threefold Repetition — Position repeated three times",
  "insufficient-material": "Insufficient Material",
  "fifty-move": "Fifty-Move Rule",
};

export const GameOverModal: React.FC<GameOverModalProps> = ({
  isOpen,
  onClose,
  gameOverMessage,
  gameEndState,
  whiteName,
  blackName,
  gameMode,
  timeControl,
  totalMoves,
  gameDuration,
  whiteRatingBefore,
  whiteRatingAfter,
  blackRatingBefore,
  blackRatingAfter,
  onRematch,
  onRunReview,
  onCopyPGN,
  onDownloadPGN,
  onExitToDashboard,
}) => {
  if (!isOpen) return null;

  // Determine outcome details
  const msgLower = gameOverMessage.toLowerCase();
  const isDraw = gameEndState 
    ? gameEndState.winner === null 
    : (msgLower.includes("draw") || msgLower.includes("stalemate") || msgLower.includes("agreement") || msgLower.includes("repetition"));
  
  const isWhiteWin = gameEndState 
    ? gameEndState.winner === "white" 
    : (msgLower.startsWith("white won") || msgLower.startsWith("white wins") || msgLower.includes("white wins"));
  
  const isBlackWin = gameEndState 
    ? gameEndState.winner === "black" 
    : (msgLower.startsWith("black won") || msgLower.startsWith("black wins") || msgLower.includes("black wins"));

  let title = "Game Over";
  let statusClass = "draw";
  if (isWhiteWin) {
    title = `${whiteName} Wins!`;
    statusClass = "white-win";
  } else if (isBlackWin) {
    title = `${blackName} Wins!`;
    statusClass = "black-win";
  } else if (isDraw) {
    title = "Match Drawn";
    if (gameEndState) {
      if (gameEndState.reason === "stalemate") {
        statusClass = "stalemate";
      } else if (gameEndState.reason === "repetition") {
        statusClass = "repetition";
      }
    }
  }

  // Resolve specific termination reason text
  const label = gameEndState
    ? (gameEndState.winner === null 
        ? (DRAW_REASON_LABELS[gameEndState.reason] ?? "Draw")
        : (gameEndState.reason === "checkmate" ? "Checkmate" : gameEndState.reason === "resignation" ? "Resignation" : gameEndState.reason === "timeout" ? "Timeout" : "Game Over"))
    : gameOverMessage;

  const whiteDelta = (whiteRatingAfter !== undefined && whiteRatingBefore !== undefined) ? whiteRatingAfter - whiteRatingBefore : null;
  const blackDelta = (blackRatingAfter !== undefined && blackRatingBefore !== undefined) ? blackRatingAfter - blackRatingBefore : null;

  return (
    <div className="gom-overlay flex-center">
      <div className="gom-container glass-panel animate-scale-up">
        {/* Close button */}
        <button className="gom-close-btn flex-center" onClick={onClose} title="Close overlay and view board">
          <X size={18} />
        </button>

        {/* Outcome Header */}
        <div className={`gom-header flex-center ${statusClass}`}>
          <div className="gom-header-ring">
            <Trophy size={36} className="gom-trophy-icon" />
          </div>
          <h2 className="gom-title">{title}</h2>
          <p className="gom-subtitle">{label}</p>
        </div>

        {/* Player Cards (Side-by-side) */}
        <div className="gom-players-grid">
          {/* White Player */}
          <div className="gom-player-card white-card">
            <div className="gom-avatar-wrap">
              <User size={24} className="gom-avatar-icon" />
              <span className="gom-color-badge white" />
            </div>
            <div className="gom-player-details">
              <span className="gom-player-name">{whiteName}</span>
              <div className="gom-rating-row">
                {whiteRatingAfter !== undefined ? (
                  <>
                    <span className="gom-rating-val">{whiteRatingAfter}</span>
                    {whiteDelta !== null && (
                      <span className={`gom-rating-change ${whiteDelta >= 0 ? "plus" : "minus"}`}>
                        {whiteDelta >= 0 ? `+${whiteDelta}` : whiteDelta}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="gom-rating-val text-muted animate-pulse" style={{ fontSize: "11px" }}>Calculating...</span>
                )}
              </div>
              <span className="gom-rating-label">Rating</span>
            </div>
          </div>

          {/* Black Player */}
          <div className="gom-player-card black-card">
            <div className="gom-avatar-wrap">
              {gameMode === "computer" ? (
                <Cpu size={24} className="gom-avatar-icon cpu" />
              ) : (
                <User size={24} className="gom-avatar-icon" />
              )}
              <span className="gom-color-badge black" />
            </div>
            <div className="gom-player-details">
              <span className="gom-player-name">{blackName}</span>
              <div className="gom-rating-row">
                {blackRatingAfter !== undefined ? (
                  <>
                    <span className="gom-rating-val">{blackRatingAfter}</span>
                    {blackDelta !== null && (
                      <span className={`gom-rating-change ${blackDelta >= 0 ? "plus" : "minus"}`}>
                        {blackDelta >= 0 ? `+${blackDelta}` : blackDelta}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="gom-rating-val text-muted animate-pulse" style={{ fontSize: "11px" }}>Calculating...</span>
                )}
              </div>
              <span className="gom-rating-label">Rating</span>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="gom-stats-section">
          <div className="gom-stat-box">
            <Clock size={14} className="gom-stat-icon" />
            <div className="gom-stat-info">
              <span className="gom-stat-label">Duration</span>
              <span className="gom-stat-value">{gameDuration || "0:00"}</span>
            </div>
          </div>

          <div className="gom-stat-box">
            <Calendar size={14} className="gom-stat-icon" />
            <div className="gom-stat-info">
              <span className="gom-stat-label">Moves</span>
              <span className="gom-stat-value">{totalMoves} moves</span>
            </div>
          </div>

          <div className="gom-stat-box">
            <Sparkles size={14} className="gom-stat-icon" />
            <div className="gom-stat-info">
              <span className="gom-stat-label">Time Control</span>
              <span className="gom-stat-value">{timeControl || "Casual"}</span>
            </div>
          </div>
        </div>

        {/* Exporter Section */}
        <div className="gom-export-section">
          <h4>Export Match PGN</h4>
          <div className="gom-export-btns">
            <button className="gom-export-btn" onClick={onCopyPGN}>
              <Copy size={13} />
              <span>Copy PGN</span>
            </button>
            <button className="gom-export-btn" onClick={onDownloadPGN}>
              <Download size={13} />
              <span>Download PGN</span>
            </button>
          </div>
        </div>

        {/* Primary CTAs */}
        <div className="gom-actions">
          <button className="gom-btn gom-btn-primary flex-center" onClick={onRunReview}>
            <BarChart2 size={16} />
            <span>Analyze with Stockfish</span>
            <div className="gom-btn-glow" />
          </button>

          <div className="gom-secondary-actions">
            <button className="gom-btn gom-btn-secondary flex-center" onClick={onRematch}>
              <RotateCcw size={15} />
              <span>Rematch</span>
            </button>
            <button className="gom-btn gom-btn-secondary flex-center" onClick={onExitToDashboard}>
              <LogOut size={15} />
              <span>Dashboard</span>
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .gom-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(3, 7, 18, 0.82);
          backdrop-filter: blur(6px);
          z-index: 1000;
          animation: gom-fadeIn 0.25s ease-out;
        }

        .gom-container {
          position: relative;
          width: 92%;
          max-width: 480px;
          padding: 28px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(13, 13, 33, 0.88);
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(99, 102, 241, 0.15);
        }

        .gom-close-btn {
          position: absolute;
          top: 14px;
          right: 14px;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--glass-border);
          color: var(--text-muted);
          transition: all 0.15s ease;
        }

        .gom-close-btn:hover {
          color: var(--text-primary);
          background: rgba(255, 255, 255, 0.12);
        }

        /* Outcome Header */
        .gom-header {
          flex-direction: column;
          text-align: center;
          padding-bottom: 4px;
        }

        .gom-header-ring {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 12px;
          background: rgba(255, 255, 255, 0.03);
          border: 2px dashed rgba(255, 255, 255, 0.1);
        }

        .white-win .gom-header-ring {
          background: rgba(16, 185, 129, 0.1);
          border-color: rgba(16, 185, 129, 0.35);
          box-shadow: 0 0 20px rgba(16, 185, 129, 0.15);
        }
        .white-win .gom-trophy-icon { color: #10b981; }
        .white-win .gom-title { color: #10b981; }

        .black-win .gom-header-ring {
          background: rgba(99, 102, 241, 0.1);
          border-color: rgba(99, 102, 241, 0.35);
          box-shadow: 0 0 20px rgba(99, 102, 241, 0.15);
        }
        .black-win .gom-trophy-icon { color: #818cf8; }
        .black-win .gom-title { color: #818cf8; }

        .draw .gom-header-ring {
          background: rgba(148, 163, 184, 0.1);
          border-color: rgba(148, 163, 184, 0.25);
        }
        .draw .gom-trophy-icon { color: var(--text-secondary); }
        .draw .gom-title { color: var(--text-primary); }

        .stalemate .gom-header-ring {
          background: rgba(245, 158, 11, 0.1);
          border-color: rgba(245, 158, 11, 0.35);
          box-shadow: 0 0 20px rgba(245, 158, 11, 0.15);
        }
        .stalemate .gom-trophy-icon { color: #f59e0b; }
        .stalemate .gom-title { color: #f59e0b; }

        .repetition .gom-header-ring {
          background: rgba(99, 102, 241, 0.1);
          border-color: rgba(99, 102, 241, 0.25);
        }
        .repetition .gom-trophy-icon { color: #818cf8; }
        .repetition .gom-title { color: var(--text-primary); }

        .gom-title {
          font-family: var(--font-display);
          font-size: 24px;
          font-weight: 400;
          letter-spacing: 0.5px;
        }

        .gom-subtitle {
          font-size: 13px;
          color: var(--text-muted);
          margin-top: 4px;
          font-family: var(--font-mono);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        /* Players Grid */
        .gom-players-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }

        .gom-player-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--glass-border);
        }

        .gom-avatar-wrap {
          position: relative;
          width: 44px;
          height: 44px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.04);
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(255, 255, 255, 0.08);
          flex-shrink: 0;
        }

        .gom-avatar-icon {
          color: var(--text-secondary);
        }
        .gom-avatar-icon.cpu {
          color: #818cf8;
        }

        .gom-color-badge {
          position: absolute;
          bottom: -3px;
          right: -3px;
          width: 13px;
          height: 13px;
          border-radius: 50%;
          border: 2.5px solid rgba(13, 13, 33, 0.95);
        }
        .gom-color-badge.white { background: #ffffff; }
        .gom-color-badge.black { background: #1e293b; }

        .gom-player-details {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .gom-player-name {
          font-size: 13px;
          font-weight: 700;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .gom-rating-row {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 2px;
        }

        .gom-rating-val {
          font-size: 15px;
          font-weight: 700;
          color: #fff;
          font-family: var(--font-mono);
        }

        .gom-rating-change {
          font-size: 10.5px;
          font-weight: 700;
          font-family: var(--font-mono);
          padding: 1px 4px;
          border-radius: 4px;
        }
        .gom-rating-change.plus {
          color: #10b981;
          background: rgba(16, 185, 129, 0.12);
        }
        .gom-rating-change.minus {
          color: #ef4444;
          background: rgba(239, 68, 68, 0.08);
        }

        .gom-rating-label {
          font-size: 9px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-top: 1px;
        }

        /* Stats Section */
        .gom-stats-section {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          background: rgba(0, 0, 0, 0.25);
          padding: 12px;
          border-radius: 12px;
          border: 1px solid var(--glass-border);
        }

        .gom-stat-box {
          display: flex;
          align-items: center;
          gap: 8px;
          justify-content: center;
        }

        .gom-stat-icon {
          color: var(--accent);
        }

        .gom-stat-info {
          display: flex;
          flex-direction: column;
        }

        .gom-stat-label {
          font-size: 9px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .gom-stat-value {
          font-size: 11.5px;
          font-weight: 600;
          color: var(--text-primary);
        }

        /* Export Section */
        .gom-export-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 10px 14px;
          background: rgba(255, 255, 255, 0.01);
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.03);
        }

        .gom-export-section h4 {
          font-size: 11px;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-family: var(--font-mono);
        }

        .gom-export-btns {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .gom-export-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px 4px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--glass-border);
          color: var(--text-secondary);
          font-size: 11.5px;
          font-weight: 600;
          transition: all 0.15s ease;
        }

        .gom-export-btn:hover {
          background: rgba(255, 255, 255, 0.07);
          border-color: rgba(255, 255, 255, 0.2);
          color: var(--text-primary);
        }

        /* CTAs */
        .gom-actions {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 4px;
        }

        .gom-btn {
          padding: 12px;
          border-radius: 10px;
          font-size: 13.5px;
          font-weight: 700;
          transition: all 0.2s ease;
        }

        .gom-btn-primary {
          position: relative;
          background: var(--gradient-r);
          color: #ffffff;
          gap: 8px;
          box-shadow: 0 4px 20px rgba(0, 82, 255, 0.35);
          overflow: hidden;
        }

        .gom-btn-primary:hover {
          box-shadow: 0 6px 26px rgba(0, 82, 255, 0.5);
          transform: translateY(-1px);
        }

        .gom-btn-glow {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at center, rgba(255, 255, 255, 0.15) 0%, transparent 60%);
          animation: gom-pulse-glow 3s infinite;
        }

        .gom-secondary-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .gom-btn-secondary {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--glass-border);
          color: var(--text-secondary);
          gap: 8px;
        }

        .gom-btn-secondary:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.25);
          color: var(--text-primary);
          transform: translateY(-1px);
        }

        @keyframes gom-fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes gom-pulse-glow {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.15); }
        }

        .animate-scale-up {
          animation: gom-scaleUp 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        @keyframes gom-scaleUp {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

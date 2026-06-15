import React from "react";
import type { GameEndState } from "../chess-logic/models";

export type OverlayBadgeType =
  | "winner"
  | "resign"
  | "draw"
  | "checkmate"
  | "draw-half";

interface BoardOverlayBadgesProps {
  boardView: any; // kept in props list so callers don't break, though we don't use it
  flipMode: boolean;
  gameEndState: GameEndState | null;
  isReviewMode?: boolean;
  currentReviewIndex?: number;
  totalMoves?: number;
}

const getSquareCoords = (square: string, flipped: boolean) => {
  const file = square.charCodeAt(0) - 97; // a=0 ... h=7
  const rank = parseInt(square[1]) - 1;   // 1=0 ... 8=7
  const col = flipped ? 7 - file : file;
  const row = flipped ? rank : 7 - rank;
  return { col, row }; // multiply by squareSize in render
};

function squareToPercentStr(
  square: string,
  flipMode: boolean
): { bottom: string; left: string } {
  const coords = getSquareCoords(square, flipMode);
  return {
    bottom: `${coords.row * 12.5}%`,
    left: `${coords.col * 12.5}%`,
  };
}

/* ── Inline SVG Icons (no emoji) ── */
const CrownIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 17 7 7l5 6 5-6 5 10z" />
    <path d="M2 17h20" />
  </svg>
);

const FlagIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
    <line x1="4" y1="22" x2="4" y2="15" />
  </svg>
);

const XIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const ClockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const HandshakeIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m11 17 2 2a1 1 0 0 0 1.4 0l4-4" />
    <path d="m13 14 5-5a1.5 1.5 0 1 1 2.2 2.2L16 15" />
    <path d="m17 12 1 1a1 1 0 0 0 1.4 0l2.5-2.5a1 1 0 0 0 0-1.4L20 7" />
    <path d="m12 11-5.5 5.5a1.5 1.5 0 1 1-2.2-2.2L10 9" />
    <path d="m12 4-8 8" />
    <path d="m16 4 1 1a1 1 0 0 1 0 1.4L15 8" />
    <path d="m18 8.5 1.5-1.5a1 1 0 0 1 1.4 0l.5.5" />
    <path d="m5 14-1-1a1 1 0 0 1 0-1.4l1-1" />
  </svg>
);

/**
 * Chess.com-style badges rendered as absolute overlays on the board.
 * Wrap inside the same relative container as the board.
 */
export const BoardOverlayBadges: React.FC<BoardOverlayBadgesProps> = ({
  flipMode,
  gameEndState,
  isReviewMode = false,
  currentReviewIndex = 0,
  totalMoves = 0,
}) => {
  if (isReviewMode) {
    if (currentReviewIndex < totalMoves - 1) return null;
  } else {
    if (currentReviewIndex < totalMoves) return null;
  }
  if (!gameEndState) return null;

  const badges: React.ReactNode[] = [];
  const { reason, winner, loserSquare, winnerSquare } = gameEndState;

  let isDraw = false;
  let isCheckmate = false;
  let isResign = false;
  let isTimeout = false;

  if (winner === null || reason === "stalemate" || reason === "repetition" || reason === "fifty-move" || reason === "insufficient-material" || reason === "draw-agreement") {
    isDraw = true;
  } else if (reason === "checkmate") {
    isCheckmate = true;
  } else if (reason === "resignation") {
    isResign = true;
  } else if (reason === "timeout") {
    isTimeout = true;
  }

  // ── DRAW: show Handshake badge centered on the board ──
  if (isDraw) {
    let drawLabelText = "Draw";
    if (reason === "stalemate") drawLabelText = "Stalemate";
    else if (reason === "repetition") drawLabelText = "Threefold Repetition";
    else if (reason === "insufficient-material") drawLabelText = "Insufficient Material";
    else if (reason === "fifty-move") drawLabelText = "50-Move Rule";
    else if (reason === "draw-agreement") drawLabelText = "Agreement";

    badges.push(
      <div key="draw-center" className="bob-center-overlay">
        <span className="bob-center-icon-text"><HandshakeIcon /></span>
        <span className="bob-center-label">{drawLabelText}</span>
      </div>
    );
  }

  // ── CHECKMATE: loser king gets red checkmate badge, winner king gets green winner badge ──
  if (isCheckmate) {
    if (loserSquare) {
      const pos = squareToPercentStr(loserSquare, flipMode);
      badges.push(
        <div key="cm-loser" className="bob-square-overlay bob-red" style={{ bottom: pos.bottom, left: pos.left }}>
          <span className="bob-icon-text"><XIcon /></span>
          <span className="bob-label checkmate">Checkmate</span>
        </div>
      );
    }
    if (winnerSquare) {
      const pos = squareToPercentStr(winnerSquare, flipMode);
      badges.push(
        <div key="cm-winner" className="bob-winner-badge" style={{ bottom: `calc(${pos.bottom} + 12.5%)`, left: pos.left }}>
          <span className="bob-crown-icon"><CrownIcon /></span>
          <span className="bob-winner-pill">Winner</span>
        </div>
      );
    }
  }

  // ── RESIGN: resigning player king gets red resign badge ──
  if (isResign) {
    if (loserSquare) {
      const pos = squareToPercentStr(loserSquare, flipMode);
      badges.push(
        <div key="resign-badge" className="bob-square-overlay bob-red" style={{ bottom: pos.bottom, left: pos.left }}>
          <span className="bob-icon-text"><FlagIcon /></span>
          <span className="bob-label resign">Resign</span>
        </div>
      );
    }
    if (winnerSquare) {
      const pos = squareToPercentStr(winnerSquare, flipMode);
      badges.push(
        <div key="winner-badge" className="bob-winner-badge" style={{ bottom: `calc(${pos.bottom} + 12.5%)`, left: pos.left }}>
          <span className="bob-crown-icon"><CrownIcon /></span>
          <span className="bob-winner-pill">Winner</span>
        </div>
      );
    }
  }

  // ── TIME / OTHER wins ──
  if (isTimeout) {
    if (loserSquare) {
      const pos = squareToPercentStr(loserSquare, flipMode);
      badges.push(
        <div key="lose-badge" className="bob-square-overlay bob-red" style={{ bottom: pos.bottom, left: pos.left }}>
          <span className="bob-icon-text"><ClockIcon /></span>
          <span className="bob-label resign">Time</span>
        </div>
      );
    }
    if (winnerSquare) {
      const pos = squareToPercentStr(winnerSquare, flipMode);
      badges.push(
        <div key="win-badge" className="bob-winner-badge" style={{ bottom: `calc(${pos.bottom} + 12.5%)`, left: pos.left }}>
          <span className="bob-crown-icon"><CrownIcon /></span>
          <span className="bob-winner-pill">Winner</span>
        </div>
      );
    }
  }

  return (
    <>
      {badges}
      <style>{`
        /* ── Board Overlay Badges — chess.com style ── */

        /* Winner pill badge (floats above king) */
        .bob-winner-badge {
          position: absolute;
          width: 12.5%;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          pointer-events: none;
          z-index: 20;
          animation: bob-badge-bounce 0.45s cubic-bezier(0.34,1.56,0.64,1) both;
        }

        .bob-crown-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          filter: drop-shadow(0 2px 6px rgba(251, 191, 36, 0.5));
          animation: bob-float 2s ease-in-out infinite;
        }

        .bob-winner-pill {
          background: #15803d;
          color: #fff;
          font-size: 0.55em;
          font-weight: 800;
          padding: 2px 7px;
          border-radius: 999px;
          white-space: nowrap;
          box-shadow: 0 2px 8px rgba(21,128,61,0.5);
          letter-spacing: 0.02em;
        }

        /* Square highlight overlay (checkmate / resign badge) */
        .bob-square-overlay {
          position: absolute;
          width: 12.5%;
          height: 12.5%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-end;
          padding-bottom: 4px;
          pointer-events: none;
          z-index: 20;
          border-radius: 4px;
          animation: bob-badge-bounce 0.45s cubic-bezier(0.34,1.56,0.64,1) both;
        }

        .bob-square-overlay.bob-red {
          background: rgba(220, 38, 38, 0.88) !important;
        }

        .bob-icon-text {
          display: flex;
          align-items: center;
          justify-content: center;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
        }

        .bob-half {
          font-size: 1.8em;
          font-weight: 900;
          color: #fff;
          line-height: 1;
          text-shadow: 0 2px 6px rgba(0,0,0,0.5);
        }

        /* Label pill that pops out above the square */
        .bob-label {
          position: absolute;
          top: -20px;
          left: 50%;
          transform: translateX(-50%);
          white-space: nowrap;
          font-size: 0.55em;
          font-weight: 800;
          padding: 2px 8px;
          border-radius: 999px;
          letter-spacing: 0.02em;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        }

        .bob-label.draw {
          background: #554133;
          color: white;
        }

        .bob-label.checkmate {
          background: #dc2626;
          color: #fff;
        }

        .bob-label.resign {
          background: #dc2626;
          color: #fff;
        }

        /* Centered draw handshake overlay */
        .bob-center-overlay {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: rgba(30, 41, 59, 0.95);
          border: 3px solid #fbbf24;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
          pointer-events: none;
          z-index: 25;
          animation: bob-badge-bounce 0.45s cubic-bezier(0.34,1.56,0.64,1) both;
        }

        .bob-center-icon-text {
          display: flex;
          align-items: center;
          justify-content: center;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
          animation: bob-float 2s ease-in-out infinite;
        }

        .bob-center-label {
          position: absolute;
          top: -24px;
          left: 50%;
          transform: translateX(-50%);
          white-space: nowrap;
          font-size: 0.6em;
          font-weight: 800;
          padding: 3px 10px;
          border-radius: 999px;
          letter-spacing: 0.02em;
          background: #fbbf24;
          color: #0d0d24;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        }

        @keyframes bob-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }

        @keyframes bob-badge-bounce {
          from { opacity: 0; transform: scale(0.5); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </>
  );
};

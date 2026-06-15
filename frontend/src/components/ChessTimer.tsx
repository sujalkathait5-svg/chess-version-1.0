import React from "react";
import { Clock } from "lucide-react";

interface ChessTimerProps {
  timeLeftMs: number;
  isActive: boolean;
  playerName: string;
  isLowTime: boolean; // true if time < 15 seconds
}

export const ChessTimer: React.FC<ChessTimerProps> = ({ timeLeftMs, isActive, playerName, isLowTime }) => {
  const formatTime = (ms: number): string => {
    if (ms <= 0) return "0:00.0";
    
    const totalSeconds = ms / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    
    // If under a minute, show tenths of a second
    if (minutes === 0) {
      const tenths = Math.floor((ms % 1000) / 100);
      return `${seconds}.${tenths}`;
    }
    
    const paddedSeconds = seconds < 10 ? `0${seconds}` : seconds;
    return `${minutes}:${paddedSeconds}`;
  };

  const timerText = formatTime(timeLeftMs);

  return (
    <div className={`chess-timer-card ${isActive ? "active" : ""} ${isLowTime ? "low-time" : ""}`}>
      <div className="timer-info">
        <Clock size={14} className="timer-icon" />
        <span className="player-name">{playerName}</span>
      </div>
      <div className="time-display">{timerText}</div>

      <style>{`
        .chess-timer-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 16px;
          border-radius: 8px;
          border: 1px solid var(--glass-border);
          background: rgba(20, 28, 48, 0.4);
          min-width: 140px;
          height: 48px;
          transition: all var(--transition-normal);
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
        }

        .chess-timer-card.active {
          border-color: var(--accent-primary);
          background: rgba(99, 102, 241, 0.15);
          box-shadow: 0 0 12px rgba(99, 102, 241, 0.3);
          transform: scale(1.02);
        }

        .chess-timer-card.low-time {
          border-color: var(--accent-error) !important;
          background: rgba(239, 68, 68, 0.15) !important;
          box-shadow: 0 0 12px rgba(239, 68, 68, 0.3) !important;
          animation: timer-pulse 1s infinite alternate;
        }

        .timer-info {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 2px;
        }

        .timer-icon {
          color: var(--text-muted);
          transition: color var(--transition-fast);
        }

        .active .timer-icon {
          color: var(--accent-primary);
        }

        .low-time .timer-icon {
          color: var(--accent-error);
        }

        .player-name {
          font-size: 11px;
          font-weight: 700;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .active .player-name {
          color: var(--text-primary);
        }

        .time-display {
          font-size: 22px;
          font-weight: 700;
          font-family: monospace;
          color: var(--text-secondary);
          letter-spacing: -0.5px;
        }

        .active .time-display {
          color: #ffffff;
        }

        .low-time .time-display {
          color: var(--accent-error);
        }

        @keyframes timer-pulse {
          from {
            opacity: 0.9;
          }
          to {
            opacity: 1;
            filter: brightness(1.1);
          }
        }
      `}</style>
    </div>
  );
};

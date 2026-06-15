import React, { useState } from "react";
import { Color } from "../chess-logic/models";
import { Volume2, VolumeX, RotateCw, RefreshCw, User, Cpu, AlertTriangle, Flag, Handshake, XCircle, LogOut, Lightbulb } from "lucide-react";
import { useSound } from "../hooks/useSound";

interface GameSettingsProps {
  gameMode: "friend" | "computer";
  computerColor: Color | null;
  computerLevel: number | null;
  activeColor: Color;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onFlipBoard: () => void;
  onResetGame: () => void;
  onTriggerComputerMode: () => void;
  onTriggerFriendMode: () => void;
  gameOverMessage?: string;
  onResign?: () => void;
  onOfferDraw?: () => void;
  onAbort?: () => void;
  onExitMatch?: () => void;
  autoFlip: boolean;
  onToggleAutoFlip: () => void;
  onShowHint?: () => void;
  isHintLoading?: boolean;
}

export const GameSettings: React.FC<GameSettingsProps> = ({
  gameMode,
  computerColor,
  computerLevel,
  activeColor,
  soundEnabled,
  onToggleSound,
  onFlipBoard,
  onResetGame,
  onTriggerComputerMode,
  onTriggerFriendMode,
  gameOverMessage,
  onResign,
  onOfferDraw,
  onAbort,
  onExitMatch,
  autoFlip,
  onToggleAutoFlip,
  onShowHint,
  isHintLoading,
}) => {
  const { volume, setVolume } = useSound();
  const [confirmResign, setConfirmResign] = useState(false);
  const [confirmDraw, setConfirmDraw] = useState(false);
  const [confirmAbort, setConfirmAbort] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);

  const isComputerTurn =
    gameMode === "computer" &&
    computerColor !== null &&
    ((activeColor === Color.White && computerColor === Color.White) ||
      (activeColor === Color.Black && computerColor === Color.Black));

  const handleResignClick = () => {
    if (confirmResign) {
      onResign?.();
      setConfirmResign(false);
    } else {
      setConfirmResign(true);
      setConfirmDraw(false);
      setConfirmAbort(false);
      setConfirmExit(false);
    }
  };

  const handleDrawClick = () => {
    if (confirmDraw) {
      onOfferDraw?.();
      setConfirmDraw(false);
    } else {
      setConfirmDraw(true);
      setConfirmResign(false);
      setConfirmAbort(false);
      setConfirmExit(false);
    }
  };

  const handleAbortClick = () => {
    if (confirmAbort) {
      onAbort?.();
      setConfirmAbort(false);
    } else {
      setConfirmAbort(true);
      setConfirmResign(false);
      setConfirmDraw(false);
      setConfirmExit(false);
    }
  };

  const handleExitClick = () => {
    if (confirmExit) {
      onExitMatch?.();
      setConfirmExit(false);
    } else {
      setConfirmExit(true);
      setConfirmResign(false);
      setConfirmDraw(false);
      setConfirmAbort(false);
    }
  };

  const cancelAll = () => {
    setConfirmResign(false);
    setConfirmDraw(false);
    setConfirmAbort(false);
    setConfirmExit(false);
  };

  return (
    <div className="game-settings-panel glass-panel">
      <div className="settings-header">
        <h3>Game Controls</h3>
      </div>

      {/* Mode Selectors */}
      <div className="mode-toggle">
        <button
          className={`mode-tab flex-center ${gameMode === "friend" ? "active" : ""}`}
          onClick={onTriggerFriendMode}
        >
          <User size={16} />
          <span>vs Friend</span>
        </button>
        <button
          className={`mode-tab flex-center ${gameMode === "computer" ? "active" : ""}`}
          onClick={onTriggerComputerMode}
        >
          <Cpu size={16} />
          <span>vs Stockfish</span>
        </button>
      </div>

      {/* Info Badge */}
      <div className="status-badge flex-center">
        {gameMode === "computer" ? (
          <div className="cpu-info flex-center">
            <Cpu size={14} className="icon-pulse" />
            <span>
              Stockfish Level {computerLevel} &mdash; {computerColor === Color.White ? "White" : "Black"}
            </span>
          </div>
        ) : (
          <div className="friend-info flex-center">
            <User size={14} />
            <span>2-Player Local Match</span>
          </div>
        )}
      </div>

      {/* Game Status */}
      <div className="game-status flex-center">
        {gameOverMessage ? (
          <div className="game-over-alert glass-panel flex-center">
            <AlertTriangle size={18} className="warn-icon" />
            <div className="game-over-details">
              <h4>Game Over</h4>
              <p>{gameOverMessage}</p>
            </div>
          </div>
        ) : (
          <div className="turn-indicator flex-center">
            <div className={`turn-dot ${activeColor === Color.White ? "white" : "black"}`}></div>
            <span>
              {isComputerTurn
                ? "Stockfish is thinking..."
                : `${activeColor === Color.White ? "White" : "Black"} to Move`}
            </span>
          </div>
        )}
      </div>

      {/* ── In-Game Actions: Resign / Draw / Abort ── */}
      {!gameOverMessage && (
        <div className="in-game-actions">
          <div className="iga-label">Actions</div>

          {/* Resign */}
          <div className="iga-row">
            <button
              className={`iga-btn resign-btn ${confirmResign ? "confirming" : ""}`}
              onClick={handleResignClick}
            >
              <Flag size={15} />
              <span>{confirmResign ? "Confirm Resign?" : "Resign"}</span>
            </button>
            {confirmResign && (
              <button className="iga-cancel-btn" onClick={cancelAll}>✕</button>
            )}
          </div>

          {/* Draw Offer */}
          <div className="iga-row">
            <button
              className={`iga-btn draw-btn ${confirmDraw ? "confirming" : ""}`}
              onClick={handleDrawClick}
            >
              <Handshake size={15} />
              <span>{confirmDraw ? "Confirm Draw?" : "Offer Draw"}</span>
            </button>
            {confirmDraw && (
              <button className="iga-cancel-btn" onClick={cancelAll}>✕</button>
            )}
          </div>

          {/* Abort (only sensible early in the game) */}
          <div className="iga-row">
            <button
              className={`iga-btn abort-btn ${confirmAbort ? "confirming" : ""}`}
              onClick={handleAbortClick}
            >
              <XCircle size={15} />
              <span>{confirmAbort ? "Confirm Abort?" : "Abort Game"}</span>
            </button>
            {confirmAbort && (
              <button className="iga-cancel-btn" onClick={cancelAll}>✕</button>
            )}
          </div>

          {/* Exit Match */}
          <div className="iga-row" style={{ marginTop: "4px" }}>
            <button
              className={`iga-btn exit-btn ${confirmExit ? "confirming" : ""}`}
              onClick={handleExitClick}
            >
              <LogOut size={15} />
              <span>{confirmExit ? "Confirm Exit?" : "Exit Match"}</span>
            </button>
            {confirmExit && (
              <button className="iga-cancel-btn" onClick={cancelAll}>✕</button>
            )}
          </div>
        </div>
      )}

      {/* Utility Buttons */}
      <div className="actions-grid">
        <button className="action-btn flex-center" onClick={onFlipBoard} title="Flip Board">
          <RotateCw size={18} />
          <span>Flip Board</span>
        </button>

        <div className="sound-control-container flex-col" style={{ width: "100%", display: "flex", flexDirection: "column", gap: "4px" }}>
          <button className="action-btn flex-center" onClick={onToggleSound} title="Toggle Sound">
            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            <span>{soundEnabled ? "Sound On" : "Muted"}</span>
          </button>
          {soundEnabled && (
            <div className="volume-slider-row flex-center" style={{ display: "flex", gap: "8px", alignItems: "center", width: "100%", padding: "4px 8px" }}>
              <VolumeX size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                style={{
                  flex: 1,
                  accentColor: "var(--accent)",
                  cursor: "pointer",
                  height: "4px",
                  borderRadius: "2px",
                  background: "rgba(255,255,255,0.1)",
                }}
              />
              <Volume2 size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              <span style={{ fontSize: "10px", color: "var(--text-muted)", minWidth: "24px", textAlign: "right", flexShrink: 0 }}>
                {Math.round(volume * 100)}%
              </span>
            </div>
          )}
        </div>

        <button className="action-btn restart flex-center" onClick={onResetGame} title="Restart Game">
          <RefreshCw size={18} />
          <span>New Game</span>
        </button>

        {gameMode === "friend" && (
          <button 
            className="action-btn flex-center" 
            onClick={onToggleAutoFlip}
            title="Auto-flip board after each move in 2-Player mode"
            style={{
              background: autoFlip ? "rgba(16, 185, 129, 0.08)" : undefined,
              borderColor: autoFlip ? "rgba(16, 185, 129, 0.35)" : undefined,
              color: autoFlip ? "#10b981" : undefined
            }}
          >
            <RotateCw size={18} />
            <span>Auto-Flip: {autoFlip ? "ON" : "OFF"}</span>
          </button>
        )}

        {gameMode === "computer" && !gameOverMessage && (
          <button 
            className="action-btn hint-btn flex-center" 
            onClick={onShowHint}
            disabled={isHintLoading}
            title="Show best move suggestion from the engine"
          >
            <Lightbulb size={18} />
            <span>{isHintLoading ? "Analyzing..." : "Show Hint"}</span>
          </button>
        )}

        {gameOverMessage && (
          <button className="action-btn exit-match-btn flex-center" onClick={onExitMatch} title="Exit to Dashboard">
            <LogOut size={18} />
            <span>Exit to Dashboard</span>
          </button>
        )}
      </div>



      <style>{`
        .game-settings-panel {
          display: flex;
          flex-direction: column;
          gap: 14px;
          padding: 16px;
        }

        .settings-header {
          border-bottom: 1px solid var(--glass-border);
          padding-bottom: 8px;
        }

        .settings-header h3 {
          font-size: 15px;
          font-weight: 700;
          color: var(--text-primary);
          font-family: var(--font-mono);
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .mode-toggle {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
          padding: 4px;
          background: rgba(0, 0, 0, 0.25);
          border-radius: 10px;
          border: 1px solid var(--glass-border);
        }

        .mode-tab {
          gap: 6px;
          padding: 8px;
          border-radius: 7px;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary);
          transition: all 0.15s ease;
        }

        .mode-tab:hover {
          color: var(--text-primary);
          background: rgba(255, 255, 255, 0.04);
        }

        .mode-tab.active {
          color: white;
          background: var(--gradient-r);
          box-shadow: 0 2px 10px var(--accent-glow);
        }

        .status-badge {
          padding: 7px 12px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--glass-border);
          font-size: 12px;
          color: var(--text-secondary);
        }

        .cpu-info, .friend-info {
          gap: 7px;
        }

        .icon-pulse {
          color: var(--accent);
          animation: pulse 2s infinite;
        }

        .game-status {
          padding: 4px;
          min-height: 46px;
        }

        .turn-indicator {
          gap: 10px;
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .turn-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          border: 1px solid var(--text-muted);
          flex-shrink: 0;
        }

        .turn-dot.white {
          background: white;
          box-shadow: 0 0 8px rgba(255,255,255,0.5);
        }

        .turn-dot.black {
          background: #1e293b;
          box-shadow: 0 0 8px rgba(0,0,0,0.8);
          border-color: rgba(255,255,255,0.2);
        }

        .game-over-alert {
          width: 100%;
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.25);
          border-radius: 10px;
          padding: 10px 14px;
          gap: 12px;
          justify-content: flex-start;
          animation: shake 0.5s ease-in-out;
        }

        .warn-icon {
          color: var(--accent-error);
          flex-shrink: 0;
        }

        .game-over-details h4 {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--accent-error);
          font-weight: 700;
          font-family: var(--font-mono);
        }

        .game-over-details p {
          font-size: 13px;
          color: var(--text-primary);
          font-weight: 500;
          margin-top: 2px;
        }

        /* ── IN-GAME ACTIONS ── */
        .in-game-actions {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 12px;
          border-radius: 12px;
          background: rgba(0,0,0,0.2);
          border: 1px solid var(--glass-border);
        }

        .iga-label {
          font-size: 10px;
          font-family: var(--font-mono);
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: var(--text-muted);
          margin-bottom: 2px;
        }

        .iga-row {
          display: flex;
          gap: 6px;
          align-items: center;
        }

        .iga-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 9px 12px;
          border-radius: 9px;
          font-size: 13px;
          font-weight: 600;
          transition: all 0.15s ease;
          border: 1.5px solid transparent;
        }

        /* Resign — red */
        .iga-btn.resign-btn {
          background: rgba(239,68,68,0.07);
          border-color: rgba(239,68,68,0.25);
          color: #f87171;
        }

        .iga-btn.resign-btn:hover,
        .iga-btn.resign-btn.confirming {
          background: rgba(239,68,68,0.18);
          border-color: rgba(239,68,68,0.55);
          color: #fca5a5;
          transform: translateY(-1px);
        }

        /* Draw — amber */
        .iga-btn.draw-btn {
          background: rgba(245,158,11,0.07);
          border-color: rgba(245,158,11,0.25);
          color: #fbbf24;
        }

        .iga-btn.draw-btn:hover,
        .iga-btn.draw-btn.confirming {
          background: rgba(245,158,11,0.18);
          border-color: rgba(245,158,11,0.55);
          color: #fde68a;
          transform: translateY(-1px);
        }

        /* Abort — slate */
        .iga-btn.abort-btn {
          background: rgba(148,163,184,0.06);
          border-color: rgba(148,163,184,0.2);
          color: var(--text-secondary);
        }

        .iga-btn.abort-btn:hover,
        .iga-btn.abort-btn.confirming {
          background: rgba(148,163,184,0.14);
          border-color: rgba(148,163,184,0.4);
          color: var(--text-primary);
          transform: translateY(-1px);
        }

        /* Exit — purple */
        .iga-btn.exit-btn {
          background: rgba(139, 92, 246, 0.06);
          border-color: rgba(139, 92, 246, 0.2);
          color: #a78bfa;
        }

        .iga-btn.exit-btn:hover,
        .iga-btn.exit-btn.confirming {
          background: rgba(139, 92, 246, 0.14);
          border-color: rgba(139, 92, 246, 0.4);
          color: #c4b5fd;
          transform: translateY(-1px);
        }

        .iga-cancel-btn {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          border: 1px solid var(--glass-border);
          background: rgba(255,255,255,0.05);
          color: var(--text-muted);
          font-size: 13px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all 0.15s ease;
        }

        .iga-cancel-btn:hover {
          background: rgba(255,255,255,0.12);
          color: var(--text-primary);
        }

        /* Utility Buttons */
        .actions-grid {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .action-btn {
          width: 100%;
          padding: 10px;
          border-radius: 9px;
          border: 1px solid var(--glass-border);
          background: rgba(255, 255, 255, 0.02);
          color: var(--text-secondary);
          gap: 8px;
          font-size: 13px;
          font-weight: 600;
          transition: all 0.15s ease;
        }

        .action-btn:hover {
          background: rgba(255, 255, 255, 0.07);
          border-color: rgba(255, 255, 255, 0.16);
          color: var(--text-primary);
        }

        .action-btn.restart {
          background: rgba(0, 82, 255, 0.06);
          border-color: rgba(0, 82, 255, 0.2);
          color: var(--accent);
        }

        .action-btn.restart:hover {
          background: rgba(0, 82, 255, 0.14);
          border-color: rgba(0, 82, 255, 0.4);
        }

        .action-btn.exit-match-btn {
          background: rgba(139, 92, 246, 0.06);
          border-color: rgba(139, 92, 246, 0.2);
          color: #a78bfa;
        }

        .action-btn.exit-match-btn:hover {
          background: rgba(139, 92, 246, 0.14);
          border-color: rgba(139, 92, 246, 0.4);
          color: #c4b5fd;
        }

        .action-btn.hint-btn {
          background: rgba(16, 185, 129, 0.06);
          border-color: rgba(16, 185, 129, 0.2);
          color: #34d399;
        }

        .action-btn.hint-btn:hover {
          background: rgba(16, 185, 129, 0.14);
          border-color: rgba(16, 185, 129, 0.4);
          color: #6ee7b7;
        }

        .action-btn.hint-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }



        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.95); }
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-4px); }
          40%, 80% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
};

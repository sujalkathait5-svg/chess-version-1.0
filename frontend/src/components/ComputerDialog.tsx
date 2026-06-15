import React, { useState } from "react";
import type { TimeControl } from "../chess-logic/models";
import { Color, timeControlsList, getPieceImgPath } from "../chess-logic/models";
import { X, Shuffle } from "lucide-react";

interface ComputerDialogProps {
  onClose: () => void;
  onPlay: (config: { color: Color; level: number; timeControl: TimeControl | null }) => void;
  initialTimeControlId?: string;
  pieceStyle?: string;
}

export const ComputerDialog: React.FC<ComputerDialogProps> = ({ onClose, onPlay, initialTimeControlId, pieceStyle = "neo" }) => {
  const [level, setLevel] = useState<number>(5); // Default Expert
  const [selectedTimeControlId, setSelectedTimeControlId] = useState<string>(initialTimeControlId || "untimed");
  const [selectedSide, setSelectedSide] = useState<"w" | "b" | "random">("w");

  const levels = [1, 2, 3, 4, 5, 6];

  const handlePlay = () => {
    let resolvedChoice: "w" | "b";
    if (selectedSide === "random") {
      resolvedChoice = Math.random() < 0.5 ? "w" : "b";
    } else {
      resolvedChoice = selectedSide;
    }
    
    let timeControl: TimeControl | null = null;
    if (selectedTimeControlId !== "untimed") {
      timeControl = timeControlsList.find(t => t.id === selectedTimeControlId) || null;
    }

    onPlay({
      color: resolvedChoice === "w" ? Color.Black : Color.White,
      level,
      timeControl,
    });
  };

  return (
    <div className="modal-overlay flex-center">
      <div className="modal-content glass-panel">
        <div className="modal-header">
          <h2>Play Against Computer</h2>
          <button className="close-btn flex-center" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <div className="setting-section">
            <h3>Stockfish Strength</h3>
            <div className="level-grid">
              {levels.map((lvl) => (
                <button
                  key={lvl}
                  className={`level-btn flex-center ${level === lvl ? "active" : ""}`}
                  onClick={() => setLevel(lvl)}
                >
                  <span className="level-num">{lvl}</span>
                  <span className="level-desc">
                    {lvl === 1 && "Beginner"}
                    {lvl === 2 && "Easy"}
                    {lvl === 3 && "Medium"}
                    {lvl === 4 && "Hard"}
                    {lvl === 5 && "Expert"}
                    {lvl === 6 && "Maximum"}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="setting-section">
            <h3>Time Control</h3>
            <div className="time-control-grid">
              <button 
                className={`time-btn flex-center ${selectedTimeControlId === "untimed" ? "active" : ""}`}
                onClick={() => setSelectedTimeControlId("untimed")}
              >
                Unlimited
              </button>
              {timeControlsList.filter(tc => !tc.id.includes('+')).map((tc) => (
                <button
                  key={tc.id}
                  className={`time-btn flex-center ${selectedTimeControlId === tc.id ? "active" : ""}`}
                  onClick={() => setSelectedTimeControlId(tc.id)}
                >
                  {tc.label}
                </button>
              ))}
            </div>
          </div>

          <div className="setting-section">
            <h3>Choose Your Side</h3>
            <div className="side-selector side-selector-3">
              <button className={`side-btn white ${selectedSide === "w" ? "active" : ""}`} onClick={() => setSelectedSide("w")}>
                <div className="side-preview">
                  <img src={getPieceImgPath("K", pieceStyle)} alt="White King" />
                </div>
                <span>Play as White</span>
              </button>

              <button className={`side-btn random ${selectedSide === "random" ? "active" : ""}`} onClick={() => setSelectedSide("random")}>
                <div className="side-preview side-preview-random">
                  <Shuffle size={36} />
                </div>
                <span>Random</span>
              </button>
              
              <button className={`side-btn black ${selectedSide === "b" ? "active" : ""}`} onClick={() => setSelectedSide("b")}>
                <div className="side-preview">
                  <img src={getPieceImgPath("k", pieceStyle)} alt="Black King" />
                </div>
                <span>Play as Black</span>
              </button>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handlePlay} style={{ minWidth: 120 }}>
            Start Game
          </button>
        </div>
      </div>

      <style>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(3, 7, 18, 0.75);
          z-index: 1000;
          animation: fadeIn 0.25s ease-out;
        }

        .modal-content {
          width: 90%;
          max-width: 500px;
          padding: 24px;
          animation: scaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          border-bottom: 1px solid var(--glass-border);
          padding-bottom: 12px;
        }

        .modal-header h2 {
          font-size: 22px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .close-btn {
          color: var(--text-secondary);
          padding: 6px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.05);
          transition: all var(--transition-fast);
        }

        .close-btn:hover {
          color: var(--text-primary);
          background: rgba(255, 255, 255, 0.15);
        }

        .modal-body {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .setting-section h3 {
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: var(--text-secondary);
          margin-bottom: 12px;
          font-weight: 600;
        }

        .level-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 6px;
        }

        .level-btn {
          flex-direction: column;
          padding: 10px 4px;
          border-radius: 12px;
          border: 1px solid var(--glass-border);
          background: rgba(255, 255, 255, 0.02);
          color: var(--text-secondary);
          transition: all var(--transition-normal);
        }

        .level-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.2);
          color: var(--text-primary);
        }

        .level-btn.active {
          background: rgba(99, 102, 241, 0.2);
          border-color: var(--accent-primary);
          color: var(--text-primary);
          box-shadow: 0 0 12px rgba(99, 102, 241, 0.3);
        }

        .level-num {
          font-size: 18px;
          font-weight: 700;
        }

        .level-desc {
          font-size: 10px;
          margin-top: 2px;
          opacity: 0.8;
        }

        .time-control-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
          gap: 12px;
        }

        .time-btn {
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid var(--glass-border);
          padding: 10px;
          border-radius: 8px;
          color: var(--text-secondary);
          font-weight: 500;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .time-btn:hover {
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-primary);
        }

        .time-btn.active {
          background: rgba(0, 82, 255, 0.15);
          border-color: rgba(0, 82, 255, 0.4);
          color: #60a5fa;
        }

        .side-selector {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .side-selector.side-selector-3 {
          grid-template-columns: 1fr 1fr 1fr;
          gap: 12px;
        }

        .side-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 20px 12px;
          border-radius: 16px;
          border: 1px solid var(--glass-border);
          background: rgba(255, 255, 255, 0.02);
          color: var(--text-primary);
          transition: all var(--transition-normal);
        }

        .side-btn:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.2);
          transform: translateY(-2px);
        }

        .side-preview {
          width: 70px;
          height: 70px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.04);
          transition: all var(--transition-normal);
        }

        .side-preview-random {
          background: linear-gradient(135deg, rgba(0,82,255,0.15), rgba(139,92,246,0.15));
          color: var(--accent);
        }

        .side-btn.random:hover, .side-btn.random.active .side-preview-random {
          background: linear-gradient(135deg, rgba(0,82,255,0.3), rgba(139,92,246,0.3));
          box-shadow: 0 0 18px rgba(0,82,255,0.2);
        }
        
        .side-btn.active {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.3);
        }

        .side-btn.white:hover, .side-btn.white.active .side-preview {
          background: rgba(255, 255, 255, 0.9);
          box-shadow: 0 0 15px rgba(255, 255, 255, 0.2);
        }

        .side-btn.black:hover, .side-btn.black.active .side-preview {
          background: rgba(15, 23, 42, 0.9);
          box-shadow: 0 0 15px rgba(0, 0, 0, 0.4);
        }

        .side-preview img {
          width: 55px;
          height: 55px;
        }

        .side-btn span {
          font-weight: 500;
          font-size: 14px;
        }

        .modal-footer {
          margin-top: 24px;
          display: flex;
          justify-content: flex-end;
          gap: 16px;
          border-top: 1px solid var(--glass-border);
          padding-top: 16px;
        }

        .btn {
          padding: 10px 20px;
          border-radius: 10px;
          font-weight: 500;
          font-size: 14px;
          transition: all var(--transition-fast);
        }

        .btn-secondary {
          background: rgba(255, 255, 255, 0.08);
          color: var(--text-primary);
          border: 1px solid var(--glass-border);
        }

        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.15);
        }

        .btn-primary {
          background: var(--gradient-r);
          color: #fff;
          border: none;
        }

        .btn-primary:hover {
          background: rgba(255, 255, 255, 0.15);
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes scaleUp {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

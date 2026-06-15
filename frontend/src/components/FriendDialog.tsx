import React, { useState } from "react";
import type { TimeControl } from "../chess-logic/models";
import { timeControlsList } from "../chess-logic/models";
import { X, Users } from "lucide-react";

interface FriendDialogProps {
  onClose: () => void;
  onPlay: (config: { timeControl: TimeControl | null }) => void;
  initialTimeControlId?: string;
}

export const FriendDialog: React.FC<FriendDialogProps> = ({ onClose, onPlay, initialTimeControlId }) => {
  const [selectedTimeControlId, setSelectedTimeControlId] = useState<string>(initialTimeControlId || "untimed");

  const handlePlay = () => {
    let timeControl: TimeControl | null = null;
    if (selectedTimeControlId !== "untimed") {
      timeControl = timeControlsList.find(t => t.id === selectedTimeControlId) || null;
    }

    onPlay({ timeControl });
  };

  return (
    <div className="modal-overlay flex-center">
      <div className="modal-content glass-panel">
        <div className="modal-header">
          <div className="flex items-center" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={22} className="text-accent" />
            <h2>Play with Friend</h2>
          </div>
          <button className="close-btn flex-center" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <div className="setting-section">
            <h3>Time Control</h3>
            <div className="time-control-grid">
              <button 
                className={`time-btn flex-center ${selectedTimeControlId === "untimed" ? "active" : ""}`}
                onClick={() => setSelectedTimeControlId("untimed")}
              >
                Unlimited
              </button>
              {timeControlsList.map((tc) => (
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
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(8px);
          z-index: 1000;
        }

        .modal-content {
          width: 90%;
          max-width: 500px;
          border-radius: 16px;
          overflow: hidden;
          animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .modal-header {
          padding: 20px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--glass-border);
        }

        .modal-header h2 {
          margin: 0;
          font-size: 18px;
          color: var(--text-primary);
        }

        .text-accent {
          color: #0052FF;
        }

        .close-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 4px;
          border-radius: 8px;
          transition: all 0.2s;
        }

        .close-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: var(--text-primary);
        }

        .modal-body {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .setting-section h3 {
          margin: 0 0 12px 0;
          font-size: 14px;
          color: var(--text-secondary);
          font-weight: 500;
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

        .modal-footer {
          padding: 16px 24px;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          background: rgba(0, 0, 0, 0.2);
          border-top: 1px solid var(--glass-border);
        }

        .btn {
          padding: 10px 20px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-secondary {
          background: transparent;
          border: 1px solid var(--glass-border);
          color: var(--text-primary);
        }

        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .btn-primary {
          background: var(--gradient-r);
          color: #fff;
          border: none;
        }

        .btn-primary:hover {
          background: rgba(255, 255, 255, 0.15);
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

import React from "react";
import { X, Palette, User } from "lucide-react";
import { getPieceImgPath } from "../chess-logic/models";

interface CustomizationDialogProps {
  onClose: () => void;
  boardTheme: string;
  onSelectBoardTheme: (theme: string) => void;
  pieceStyle: string;
  onSelectPieceStyle: (style: string) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  showMoveHints: boolean;
  onToggleMoveHints: () => void;
  gameMode: "friend" | "computer";
  onToggleStockfish: (enabled: boolean) => void;
  userName: string;
  onChangeUserName: (name: string) => void;
  userAvatar: string;
  onChangeUserAvatar: (avatarUrl: string) => void;
}

export const CustomizationDialog: React.FC<CustomizationDialogProps> = ({
  onClose,
  boardTheme,
  onSelectBoardTheme,
  pieceStyle,
  onSelectPieceStyle,
  soundEnabled,
  onToggleSound,
  showMoveHints,
  onToggleMoveHints,
  gameMode,
  onToggleStockfish,
  userName,
  onChangeUserName,
  userAvatar,
  onChangeUserAvatar,
}) => {
  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          onChangeUserAvatar(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };
  const themes = [
    { id: "wood", name: "Classic Wood", desc: "Traditional wooden walnut & maple theme", light: "#e8d5b7", dark: "#6b4c2a" },
    { id: "green", name: "Forest Green", desc: "Traditional club-style green & cream theme", light: "#eeeed2", dark: "#769656" },
    { id: "blue", name: "Ocean Blue", desc: "Modern ocean slate & light gray theme", light: "#dee3e6", dark: "#8ca2ad" },
    { id: "dark", name: "Charcoal Dark", desc: "Sleek slate gray & charcoal cyber theme", light: "#cfd8dc", dark: "#546e7a" },
    { id: "cyber", name: "Cyber Blue", desc: "Futuristic slate & electric blue theme", light: "#89a5df", dark: "#1e2235" },
  ];

  const styles = [
    { id: "neo", name: "Neo", desc: "Modern custom vector design" },
    { id: "classic", name: "Classic", desc: "Standard traditional outline shapes (cburnett)" },
    { id: "merida", name: "Merida", desc: "Elegant hand-drawn classic curves" },
    { id: "alpha", name: "Alpha", desc: "Classic arcade outlines with high contrast" },
    { id: "custom", name: "Cyber Glow", desc: "Vibrant custom neon-glow pieces" },
  ];

  return (
    <div className="modal-overlay flex-center">
      <div className="modal-content glass-panel customization-modal">
        <div className="modal-header">
          <div className="modal-title-wrapper flex-center">
            <Palette size={20} className="modal-title-icon" />
            <h2> Settings</h2>
          </div>
          <button className="close-btn flex-center" onClick={onClose} title="Close settings">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Player Profile Section */}
          <div className="setting-section">
            <div className="section-header-row" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <User size={16} style={{ color: "var(--accent)" }} />
              <h3 style={{ margin: 0 }}>Player Profile</h3>
            </div>
            <div className="profile-settings-card">
              <div className="profile-avatar-row">
                <div className="profile-avatar-preview-wrapper">
                  <img src={userAvatar} alt="Player Avatar" className="profile-avatar-preview" />
                </div>
                <div className="profile-avatar-actions">
                  <label htmlFor="avatar-file-upload" className="upload-avatar-btn">
                    Upload Photo
                  </label>
                  <input
                    id="avatar-file-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    style={{ display: "none" }}
                  />
                  <span className="upload-tip">Select real image file</span>
                </div>
              </div>
              <div className="profile-input-wrapper">
                <span className="profile-input-label">Player Name</span>
                <input
                  type="text"
                  className="profile-name-input"
                  value={userName}
                  onChange={(e) => onChangeUserName(e.target.value)}
                  maxLength={15}
                  placeholder="Enter your name"
                />
              </div>
            </div>
          </div>

          {/* Board Themes Section */}
          <div className="setting-section">
            <div className="section-header-row">
              <h3>Board Theme</h3>
              <span className="current-badge">{themes.find(t => t.id === boardTheme)?.name}</span>
            </div>
            <div className="theme-grid-list">
              {themes.map((t) => (
                <button
                  key={t.id}
                  className={`theme-card-btn ${boardTheme === t.id ? "active" : ""}`}
                  onClick={() => onSelectBoardTheme(t.id)}
                >
                  <div className="theme-board-preview">
                    <div className="preview-sq" style={{ backgroundColor: t.light }} />
                    <div className="preview-sq" style={{ backgroundColor: t.dark }} />
                    <div className="preview-sq" style={{ backgroundColor: t.dark }} />
                    <div className="preview-sq" style={{ backgroundColor: t.light }} />
                  </div>
                  <div className="theme-info">
                    <span className="theme-title">{t.name}</span>
                    <span className="theme-desc">{t.desc}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Piece Styles Section */}
          <div className="setting-section">
            <div className="section-header-row">
              <h3>Piece Style</h3>
              <span className="current-badge">{styles.find(s => s.id === pieceStyle)?.name}</span>
            </div>
            <div className="style-grid-list">
              {styles.map((s) => (
                <button
                  key={s.id}
                  className={`style-card-btn ${pieceStyle === s.id ? "active" : ""}`}
                  onClick={() => onSelectPieceStyle(s.id)}
                >
                    <div className="piece-previews-row">
                      <div className="piece-preview-box white-preview">
                        <img src={getPieceImgPath("N", s.id)} alt="White Knight" className="preview-piece-img" />
                      </div>
                      <div className="piece-preview-box black-preview">
                        <img src={getPieceImgPath("n", s.id)} alt="Black Knight" className="preview-piece-img" />
                      </div>
                      <div className="piece-preview-box white-preview">
                        <img src={getPieceImgPath("K", s.id)} alt="White King" className="preview-piece-img" />
                      </div>
                      <div className="piece-preview-box black-preview">
                        <img src={getPieceImgPath("q", s.id)} alt="Black Queen" className="preview-piece-img" />
                      </div>
                    </div>
                  <div className="style-info">
                    <span className="style-title">{s.name}</span>
                    <span className="style-desc">{s.desc}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Gameplay Settings Section */}
          <div className="setting-section">
            <div className="section-header-row">
              <h3>Gameplay & Rules</h3>
            </div>
            <div className="settings-controls-list">
              {/* Sound toggle */}
              <div className="setting-control-row">
                <div className="control-label-col">
                  <span className="control-title">Sound Effects</span>
                  <span className="control-desc">Play audio for chess moves, captures, check, and game over</span>
                </div>
                <button
                  className={`switch-toggle-btn ${soundEnabled ? "active" : ""}`}
                  onClick={onToggleSound}
                  type="button"
                  title="Toggle sound effects"
                >
                  <div className="switch-handle" />
                </button>
              </div>

              {/* Move Hints toggle */}
              <div className="setting-control-row">
                <div className="control-label-col">
                  <span className="control-title">Move Hints</span>
                  <span className="control-desc">Display visual safety circles/capture rings on selected pieces</span>
                </div>
                <button
                  className={`switch-toggle-btn ${showMoveHints ? "active" : ""}`}
                  onClick={onToggleMoveHints}
                  type="button"
                  title="Toggle legal move hints"
                >
                  <div className="switch-handle" />
                </button>
              </div>

              {/* Stockfish AI toggle */}
              <div className="setting-control-row">
                <div className="control-label-col">
                  <span className="control-title">Stockfish AI Opponent</span>
                  <span className="control-desc">Play versus Stockfish computer instead of local friend mode</span>
                </div>
                <button
                  className={`switch-toggle-btn ${gameMode === "computer" ? "active" : ""}`}
                  onClick={() => onToggleStockfish(gameMode !== "computer")}
                  type="button"
                  title="Toggle Stockfish AI"
                >
                  <div className="switch-handle" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-primary done-btn" onClick={onClose}>
            Done & Apply
          </button>
        </div>
      </div>

      <style>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(3, 7, 18, 0.75);
          backdrop-filter: blur(8px);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .customization-modal {
          width: 90%;
          max-width: 480px !important;
          max-height: 85vh;
          display: flex;
          flex-direction: column;
          border: 1px solid rgba(0, 82, 255, 0.25) !important;
          box-shadow: 0 25px 60px rgba(0, 82, 255, 0.2) !important;
          border-radius: 16px;
          overflow: hidden;
          animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .modal-body {
          padding: 20px 24px;
          overflow-y: auto;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .modal-title-wrapper {
          gap: 10px;
        }

        .modal-title-icon {
          color: var(--accent);
          filter: drop-shadow(0 0 8px var(--accent-glow));
        }

        .section-header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .section-header-row h3 {
          margin-bottom: 0 !important;
        }

        .current-badge {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--accent);
          background: rgba(0, 82, 255, 0.12);
          border: 1px solid rgba(0, 82, 255, 0.25);
          padding: 3px 8px;
          border-radius: 6px;
          font-family: var(--font-mono);
        }

        .theme-grid-list, .style-grid-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .theme-card-btn, .style-card-btn {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 12px 16px;
          border-radius: 14px;
          border: 1px solid var(--glass-border);
          background: rgba(255, 255, 255, 0.02);
          color: var(--text-primary);
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          text-align: left;
          width: 100%;
          cursor: pointer;
        }

        .theme-card-btn:hover, .style-card-btn:hover {
          background: rgba(255, 255, 255, 0.07);
          border-color: rgba(255, 255, 255, 0.18);
          transform: translateX(4px);
        }

        .theme-card-btn.active, .style-card-btn.active {
          background: rgba(0, 82, 255, 0.08);
          border-color: rgba(0, 82, 255, 0.4);
          box-shadow: inset 0 0 12px rgba(0, 82, 255, 0.08), 0 4px 12px rgba(0, 82, 255, 0.1);
        }

        .theme-board-preview {
          width: 44px;
          height: 44px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: 1fr 1fr;
          border-radius: 8px;
          overflow: hidden;
          flex-shrink: 0;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.25);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .preview-sq {
          width: 100%;
          height: 100%;
        }

        .theme-info, .style-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .theme-title, .style-title {
          font-size: 14px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .theme-desc, .style-desc {
          font-size: 11px;
          color: var(--text-muted);
          line-height: 1.4;
        }

        /* Style previews */
        .piece-previews-row {
          display: flex;
          gap: 4px;
          background: rgba(0, 0, 0, 0.25);
          padding: 4px;
          border-radius: 10px;
          border: 1px solid var(--glass-border);
          flex-shrink: 0;
        }

        .piece-preview-box {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2px;
        }

        .piece-preview-box.white-preview {
          background-color: #dee3e6;
        }

        .piece-preview-box.black-preview {
          background-color: #8ca2ad;
        }

        .preview-piece-img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.2));
        }

        .piece-full-preview {
          width: 124px;
          height: 36px;
          border-radius: 10px;
          overflow: hidden;
          border: 1px solid var(--glass-border);
          flex-shrink: 0;
          background: #7f899b;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.25);
        }

        .neo-full-preview-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .done-btn {
          min-width: 140px;
          font-weight: 600;
          box-shadow: 0 4px 14px var(--accent-glow);
        }

        .settings-controls-list {
          display: flex;
          flex-direction: column;
          gap: 14px;
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid var(--glass-border);
          border-radius: 14px;
          padding: 16px;
        }

        .setting-control-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
        }

        .control-label-col {
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex-grow: 1;
        }

        .control-title {
          font-size: 14px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .control-desc {
          font-size: 11px;
          color: var(--text-muted);
          line-height: 1.4;
        }

        /* Custom Switch Toggle */
        .switch-toggle-btn {
          position: relative;
          width: 44px;
          height: 24px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.15);
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          flex-shrink: 0;
          padding: 0;
        }

        .switch-toggle-btn.active {
          background: rgba(0, 82, 255, 0.6);
          border-color: rgba(0, 82, 255, 0.8);
          box-shadow: 0 0 10px rgba(0, 82, 255, 0.4);
        }

        .switch-handle {
          position: absolute;
          top: 2px;
          left: 2px;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #ffffff;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .switch-toggle-btn.active .switch-handle {
          transform: translateX(20px);
          background: #ffffff;
        }

        /* Stockfish Level Subrow */
        .setting-control-subrow {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding-top: 10px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          animation: slide-down 0.2s ease-out both;
        }

        .subrow-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .subrow-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .subrow-value-badge {
          font-size: 11px;
          font-weight: 700;
          color: var(--accent);
          background: rgba(0, 82, 255, 0.1);
          padding: 2px 6px;
          border-radius: 4px;
        }

        .level-buttons-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 6px;
        }

        .level-select-btn {
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          border: 1px solid var(--glass-border);
          background: rgba(255, 255, 255, 0.03);
          color: var(--text-primary);
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .level-select-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.2);
        }

        .level-select-btn.active {
          background: rgba(0, 82, 255, 0.2);
          border-color: rgba(0, 82, 255, 0.6);
          color: #ffffff;
          box-shadow: 0 0 8px rgba(0, 82, 255, 0.25);
        }

        @keyframes slide-down {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* Unified Profile Card inside Settings */
        .profile-settings-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--glass-border);
          border-radius: 14px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .profile-avatar-row {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .profile-avatar-preview-wrapper {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          overflow: hidden;
          border: 2px solid rgba(0, 82, 255, 0.4);
          box-shadow: 0 4px 10px rgba(0, 82, 255, 0.2);
          background: rgba(0, 0, 0, 0.2);
          flex-shrink: 0;
        }

        .profile-avatar-preview {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .profile-avatar-actions {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .upload-avatar-btn {
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          padding: 6px 14px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid var(--glass-border);
          color: var(--text-primary);
          transition: all 0.2s ease;
          display: inline-block;
          text-align: center;
        }

        .upload-avatar-btn:hover {
          background: rgba(255, 255, 255, 0.15);
          border-color: rgba(255, 255, 255, 0.25);
        }

        .upload-tip {
          font-size: 10px;
          color: var(--text-muted);
        }

        .profile-input-wrapper {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .profile-input-label {
          font-size: 12px;
          font-weight: 700;
          color: var(--text-secondary);
        }

        .profile-name-input {
          width: 100%;
          padding: 10px 12px;
          font-size: 13px;
          border-radius: 8px;
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid var(--glass-border);
          color: var(--text-primary);
          outline: none;
          transition: all 0.2s ease;
        }

        .profile-name-input:focus {
          border-color: rgba(0, 82, 255, 0.6);
          box-shadow: 0 0 8px rgba(0, 82, 255, 0.2);
        }
      `}</style>
    </div>
  );
};

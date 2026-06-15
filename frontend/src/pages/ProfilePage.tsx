import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Trophy, BarChart3, Puzzle, Calendar, Loader2, Volume2, VolumeX } from "lucide-react";
import { authService } from "../services/authService";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../hooks/useTheme";
import { useSound } from "../hooks/useSound";
import { getPieceImgPath } from "../chess-logic/models";

interface StatsData {
  rating: number;
  stats: { wins: number; losses: number; draws: number; total: number };
  recentGames: any[];
}

interface PuzzleStats {
  totalAttempted: number;
  totalSolved: number;
  successRate: number;
}

const BOARD_THEMES = [
  { id: "wood", name: "Classic Wood", light: "#e8d5b7", dark: "#6b4c2a" },
  { id: "green", name: "Forest Green", light: "#eeeed2", dark: "#769656" },
  { id: "blue", name: "Ocean Blue", light: "#dee3e6", dark: "#8ca2ad" },
  { id: "dark", name: "Charcoal", light: "#cfd8dc", dark: "#546e7a" },
  { id: "cyber", name: "Cyber Blue", light: "#89a5df", dark: "#1e2235" },
  { id: "marble", name: "Marble", light: "#f0d9b5", dark: "#b58863" },
];

const PIECE_STYLES = [
  { id: "neo", name: "Neo", desc: "Modern vector design" },
  { id: "classic", name: "Classic", desc: "Standard cburnett outlines" },
  { id: "merida", name: "Merida", desc: "Elegant hand-drawn curves" },
  { id: "alpha", name: "Alpha", desc: "High-contrast arcade style" },
  { id: "custom", name: "Cyber Glow", desc: "Vibrant neon-glow pieces" },
  { id: "caliente", name: "Caliente", desc: "Warm fiery style" },
];

export function ProfilePage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [puzzleStats, setPuzzleStats] = useState<PuzzleStats | null>(null);
  const [loading, setLoading] = useState(true);

  const { boardTheme, pieceStyle, setBoardTheme, setPieceStyle } = useTheme();
  const { soundEnabled, setSoundEnabled, volume, setVolume } = useSound();

  // Save to server when settings change (logged-in users only)
  useEffect(() => {
    if (!currentUser) return;
    authService.savePreferences({
      boardTheme,
      pieceStyle,
      soundEnabled,
      moveHints: true,
      autoFlip: false,
    }).catch(() => {});
  }, [currentUser, boardTheme, pieceStyle, soundEnabled]);

  useEffect(() => {
    if (!currentUser) return;

    let cancelled = false;
    const fetchStats = async () => {
      try {
        const [statsRes, puzzlesRes] = await Promise.all([
          fetch(`/api/stats/${currentUser.id}`),
          fetch(`/api/stats/${currentUser.id}/puzzles`)
        ]);

        if (!cancelled) {
          if (statsRes.ok) {
            setStats(await statsRes.json());
          }
          if (puzzlesRes.ok) {
            setPuzzleStats(await puzzlesRes.json());
          }
        }
      } catch {
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchStats();
    return () => { cancelled = true; };
  }, [currentUser]);

  if (!currentUser) {
    return (
      <div className="page-stub flex-center" style={{ height: "100vh", flexDirection: "column", gap: "16px" }}>
        <h2>Sign in required</h2>
        <p style={{ color: "var(--text-muted)" }}>You must be signed in to view your profile and statistics.</p>
        <button className="btn-primary" onClick={() => navigate("/")}>Go Home</button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page-stub flex-center" style={{ height: "100vh" }}>
        <Loader2 className="spinner" size={32} style={{ animation: "spin 1s linear infinite", color: "var(--accent)" }} />
      </div>
    );
  }

  const renderWlBar = () => {
    if (!stats || stats.stats.total === 0) return null;
    const { wins, losses, draws, total } = stats.stats;
    const wPct = (wins / total) * 100;
    const lPct = (losses / total) * 100;
    const dPct = (draws / total) * 100;

    return (
      <div style={{ marginTop: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "8px" }}>
          <span style={{ color: "#4ade80" }}>{wins} Wins</span>
          <span style={{ color: "#94a3b8" }}>{draws} Draws</span>
          <span style={{ color: "#ef4444" }}>{losses} Losses</span>
        </div>
        <div style={{ height: "8px", display: "flex", borderRadius: "4px", overflow: "hidden" }}>
          <div style={{ width: `${wPct}%`, background: "#4ade80" }} />
          <div style={{ width: `${dPct}%`, background: "#94a3b8" }} />
          <div style={{ width: `${lPct}%`, background: "#ef4444" }} />
        </div>
      </div>
    );
  };

  return (
    <div className="page-stub">
      <div className="back-bar" style={{ marginBottom: "20px" }}>
        <button className="back-to-dashboard-btn" onClick={() => navigate("/")}>
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </button>
      </div>

      <div style={{ maxWidth: "1000px", margin: "0 auto", width: "100%" }}>
        {/* Header section */}
        <div className="glass-panel" style={{ padding: "32px", borderRadius: "16px", display: "flex", alignItems: "center", gap: "24px", marginBottom: "32px" }}>
          <img
            src={currentUser.avatar_url || "default_avatar.svg"}
            alt="Avatar"
            style={{ width: "80px", height: "80px", borderRadius: "50%", background: "var(--bg-panel)", border: "2px solid var(--accent)" }}
          />
          <div>
            <h2 style={{ margin: 0, fontSize: "32px", display: "flex", alignItems: "center", gap: "12px" }}>
              {currentUser.username}
            </h2>
            <p style={{ margin: "4px 0 0", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "8px" }}>
              <Calendar size={14} /> Joined recently
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "24px", marginBottom: "32px" }}>

          {/* Matchmaking Stats */}
          <div className="glass-panel" style={{ padding: "24px", borderRadius: "12px" }}>
            <h3 style={{ margin: "0 0 16px 0", display: "flex", alignItems: "center", gap: "8px" }}>
              <BarChart3 size={20} className="text-blue-400" /> Matchmaking
            </h3>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ margin: 0, fontSize: "14px", color: "var(--text-muted)" }}>Global Elo Rating</p>
                <div style={{ fontSize: "36px", fontWeight: "bold", color: "white" }}>
                  {stats?.rating || 1500}
                </div>
              </div>
              <Trophy size={48} style={{ color: "var(--accent)", opacity: 0.2 }} />
            </div>

            {renderWlBar()}
          </div>

          {/* Puzzle Stats */}
          <div className="glass-panel" style={{ padding: "24px", borderRadius: "12px" }}>
            <h3 style={{ margin: "0 0 16px 0", display: "flex", alignItems: "center", gap: "8px" }}>
              <Puzzle size={20} className="text-purple-400" /> Tactics Training
            </h3>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ margin: 0, fontSize: "14px", color: "var(--text-muted)" }}>Success Rate</p>
                <div style={{ fontSize: "36px", fontWeight: "bold", color: "white" }}>
                  {puzzleStats?.successRate || 0}%
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ margin: 0, fontSize: "14px", color: "var(--text-muted)" }}>Attempted</p>
                <div style={{ fontSize: "20px", fontWeight: "bold" }}>{puzzleStats?.totalAttempted || 0}</div>
                <p style={{ margin: "8px 0 0", fontSize: "14px", color: "var(--text-muted)" }}>Solved</p>
                <div style={{ fontSize: "20px", fontWeight: "bold", color: "#4ade80" }}>{puzzleStats?.totalSolved || 0}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Settings Section */}
        <div className="glass-panel" style={{ padding: "24px", borderRadius: "12px", marginBottom: "32px" }}>
          <h3 style={{ margin: "0 0 20px 0", display: "flex", alignItems: "center", gap: "8px" }}>
            <Trophy size={20} className="text-yellow-400" /> Settings
          </h3>

          {/* Board Theme */}
          <div style={{ marginBottom: "24px" }}>
            <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", color: "var(--text-secondary)" }}>Board Theme</h4>
            <div className="profile-theme-grid">
              {BOARD_THEMES.map((t) => (
                <button
                  key={t.id}
                  className={`profile-theme-card ${boardTheme === t.id ? "active" : ""}`}
                  onClick={() => setBoardTheme(t.id)}
                >
                  <div className="profile-theme-preview">
                    <div style={{ background: t.light, flex: 1 }} />
                    <div style={{ background: t.dark, flex: 1 }} />
                    <div style={{ background: t.dark, flex: 1 }} />
                    <div style={{ background: t.light, flex: 1 }} />
                  </div>
                  <span className="profile-theme-name">{t.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Piece Style */}
          <div style={{ marginBottom: "24px" }}>
            <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", color: "var(--text-secondary)" }}>Piece Style</h4>
            <div className="profile-style-grid">
              {PIECE_STYLES.map((s) => (
                <button
                  key={s.id}
                  className={`profile-style-card ${pieceStyle === s.id ? "active" : ""}`}
                  onClick={() => setPieceStyle(s.id)}
                >
                  <div className="profile-style-previews">
                    <div className="profile-style-piece">
                      <img src={getPieceImgPath("N", s.id)} alt="Knight" />
                    </div>
                    <div className="profile-style-piece">
                      <img src={getPieceImgPath("K", s.id)} alt="King" />
                    </div>
                    <div className="profile-style-piece">
                      <img src={getPieceImgPath("q", s.id)} alt="Queen" />
                    </div>
                    <div className="profile-style-piece">
                      <img src={getPieceImgPath("p", s.id)} alt="Pawn" />
                    </div>
                  </div>
                  <span className="profile-style-name">{s.name}</span>
                  <span className="profile-style-desc">{s.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Sound */}
          <div>
            <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", color: "var(--text-secondary)" }}>Sound</h4>
            <div className="profile-sound-row" style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "flex-start" }}>
              <button
                className={`profile-sound-toggle ${soundEnabled ? "active" : ""}`}
                onClick={() => setSoundEnabled(!soundEnabled)}
              >
                {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                <span>{soundEnabled ? "Sound On" : "Sound Off"}</span>
              </button>
              {soundEnabled && (
                <div className="profile-volume-slider-row" style={{ display: "flex", gap: "8px", alignItems: "center", width: "100%", maxWidth: "250px", padding: "4px 8px" }}>
                  <VolumeX size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
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
                  <Volume2 size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", minWidth: "28px", textAlign: "right", flexShrink: 0 }}>
                    {Math.round(volume * 100)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Match History */}
        <div className="glass-panel" style={{ padding: "24px", borderRadius: "12px" }}>
          <h3 style={{ margin: "0 0 20px 0", display: "flex", alignItems: "center", gap: "8px" }}>
            <Calendar size={20} className="text-yellow-400" /> Recent Games
          </h3>

          {!stats?.recentGames || stats.recentGames.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
              No games played yet. Go play a match!
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", color: "var(--text-muted)", fontSize: "12px", textTransform: "uppercase" }}>
                    <th style={{ padding: "12px" }}>Date</th>
                    <th style={{ padding: "12px" }}>White</th>
                    <th style={{ padding: "12px" }}>Black</th>
                    <th style={{ padding: "12px" }}>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentGames.map((game) => {
                    const isWhite = game.white_id === currentUser.id;
                    const dateObj = new Date(game.created_at);

                    const rowColor = game.result === 'draw' ? "rgba(148, 163, 184, 0.1)" :
                      ((isWhite && game.result === 'white_win') || (!isWhite && game.result === 'black_win')) ? "rgba(74, 222, 128, 0.1)" :
                      "rgba(239, 68, 68, 0.1)";

                    return (
                      <tr key={game.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: rowColor }}>
                        <td style={{ padding: "12px", fontSize: "14px", color: "var(--text-secondary)" }}>
                          {dateObj.toLocaleDateString()} {dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </td>
                        <td style={{ padding: "12px", fontSize: "14px", fontWeight: isWhite ? 'bold' : 'normal', color: isWhite ? 'white' : 'var(--text-secondary)' }}>
                          {game.white_username}
                        </td>
                        <td style={{ padding: "12px", fontSize: "14px", fontWeight: !isWhite ? 'bold' : 'normal', color: !isWhite ? 'white' : 'var(--text-secondary)' }}>
                          {game.black_username}
                        </td>
                        <td style={{ padding: "12px", fontSize: "14px", textTransform: "capitalize", fontWeight: "bold" }}>
                          {game.result.replace('_', ' ')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .profile-theme-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          gap: 10px;
        }

        .profile-theme-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          padding: 10px 8px;
          border-radius: 12px;
          border: 2px solid var(--glass-border);
          background: rgba(255,255,255,0.02);
          color: var(--text-primary);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .profile-theme-card:hover {
          background: rgba(255,255,255,0.06);
          border-color: rgba(255,255,255,0.18);
          transform: translateY(-2px);
        }

        .profile-theme-card.active {
          border-color: var(--accent);
          background: rgba(0,82,255,0.08);
          box-shadow: 0 0 12px rgba(0,82,255,0.15);
        }

        .profile-theme-preview {
          width: 48px;
          height: 48px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: 1fr 1fr;
          border-radius: 8px;
          overflow: hidden;
          flex-shrink: 0;
          border: 1px solid rgba(255,255,255,0.1);
        }

        .profile-theme-name {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .profile-style-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 10px;
        }

        .profile-style-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 12px 8px;
          border-radius: 12px;
          border: 2px solid var(--glass-border);
          background: rgba(255,255,255,0.02);
          color: var(--text-primary);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .profile-style-card:hover {
          background: rgba(255,255,255,0.06);
          border-color: rgba(255,255,255,0.18);
          transform: translateY(-2px);
        }

        .profile-style-card.active {
          border-color: var(--accent);
          background: rgba(0,82,255,0.08);
          box-shadow: 0 0 12px rgba(0,82,255,0.15);
        }

        .profile-style-previews {
          display: flex;
          gap: 4px;
          background: rgba(0,0,0,0.2);
          padding: 6px;
          border-radius: 8px;
          border: 1px solid var(--glass-border);
          width: 100%;
          justify-content: center;
        }

        .profile-style-piece {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .profile-style-piece img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          filter: drop-shadow(0 2px 3px rgba(0,0,0,0.2));
        }

        .profile-style-name {
          font-size: 12px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .profile-style-desc {
          font-size: 10px;
          color: var(--text-muted);
          text-align: center;
          line-height: 1.3;
        }

        .profile-sound-row {
          display: flex;
          gap: 12px;
        }

        .profile-sound-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          border-radius: 10px;
          border: 2px solid var(--glass-border);
          background: rgba(255,255,255,0.02);
          color: var(--text-secondary);
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
          transition: all 0.2s ease;
        }

        .profile-sound-toggle:hover {
          background: rgba(255,255,255,0.06);
          border-color: rgba(255,255,255,0.18);
        }

        .profile-sound-toggle.active {
          border-color: var(--accent);
          background: rgba(0,82,255,0.08);
          color: var(--text-primary);
        }

        @media (max-width: 500px) {
          .profile-theme-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .profile-style-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </div>
  );
}

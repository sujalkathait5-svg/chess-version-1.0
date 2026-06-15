// frontend/src/components/LeaderboardTab.tsx
import { useEffect, useState } from "react";
import { Trophy, RefreshCw, Medal, Loader2, Sparkles } from "lucide-react";
import { authService } from "../services/authService";

interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  avatar_url: string;
  rating: number;
  peak_rating: number;
  total_games: number;
  win_rate: number;
}

interface LeaderboardTabProps {
  currentUserId?: string;
  prefetchedData?: LeaderboardEntry[];
}

export const LeaderboardTab: React.FC<LeaderboardTabProps> = ({ currentUserId, prefetchedData }) => {
  const shouldFetch = !prefetchedData || prefetchedData.length === 0;
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(prefetchedData || []);
  const [loading, setLoading] = useState(shouldFetch);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = async () => {
    setError(null);
    try {
      const data = await authService.getLeaderboard();
      setLeaderboard(data || []);
    } catch {
      setError("Failed to load rankings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!shouldFetch) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await authService.getLeaderboard();
        if (!cancelled) setLeaderboard(data || []);
      } catch {
        if (!cancelled) setError("Failed to load rankings");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="leaderboard-panel glass-panel">
      <div className="panel-header">
        <div className="header-title flex-center">
          <Trophy className="trophy-icon" size={18} />
          <h3>Arena Leaderboard</h3>
        </div>
        <button className="refresh-btn flex-center" onClick={fetchLeaderboard} disabled={loading} title="Refresh Rankings">
          {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
        </button>
      </div>

      <div className="panel-body">
        {loading ? (
          <div className="loader-container flex-center">
            <Loader2 size={24} className="animate-spin text-accent" />
            <span>Loading player standings...</span>
          </div>
        ) : error ? (
          <div className="error-container flex-center">
            <span>{error}</span>
            <button className="btn-retry" onClick={fetchLeaderboard}>Retry</button>
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="empty-container flex-center">
            <Sparkles size={28} className="empty-icon" />
            <p>No rated human games played yet.</p>
            <p className="empty-sub">Be the first to score ranking points!</p>
          </div>
        ) : (
          <div className="rankings-table-wrapper">
            <div className="table-header">
              <span className="col-rank">Rank</span>
              <span className="col-player">Player</span>
              <span className="col-rating">Rating</span>
              <span className="col-games">Games</span>
              <span className="col-winrate">Win Rate</span>
            </div>
            
            <div className="table-body">
              {leaderboard.map((entry) => {
                const isSelf = currentUserId === entry.user_id;
                const top3 = entry.rank <= 3;
                const medalColors = ["#ffd700", "#c0c0c0", "#cd7f32"]; // Gold, Silver, Bronze

                return (
                  <div key={entry.user_id} className={`ranking-row ${isSelf ? "self-row" : ""}`}>
                    <div className="col-rank rank-cell">
                      {top3 ? (
                        <Medal size={16} style={{ color: medalColors[entry.rank - 1] }} className="medal-icon" />
                      ) : (
                        <span className="rank-num">{entry.rank}</span>
                      )}
                    </div>

                    <div className="col-player player-cell">
                      <img 
                        src={entry.avatar_url || "default_avatar.svg"} 
                        alt={entry.username} 
                        className="player-avatar"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23475569'><circle cx='12' cy='12' r='12' fill='%231e293b'/></svg>";
                        }}
                      />
                      <span className="player-name">
                        {entry.username}
                        {isSelf && <span className="you-tag">You</span>}
                      </span>
                    </div>

                    <div className="col-rating rating-cell font-mono">
                      {entry.rating}
                    </div>

                    <div className="col-games games-cell font-mono">
                      {entry.total_games}
                    </div>

                    <div className="col-winrate winrate-cell font-mono">
                      {entry.win_rate}%
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .leaderboard-panel {
          border-radius: 12px;
          height: 100%;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: rgba(15, 23, 42, 0.45);
          border: 1px solid var(--glass-border);
        }

        .panel-header {
          padding: 14px 18px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--glass-border);
          background: rgba(0, 0, 0, 0.2);
        }

        .header-title h3 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .trophy-icon {
          color: #f59e0b;
          margin-right: 8px;
        }

        .refresh-btn {
          background: transparent;
          border: 1px solid var(--glass-border);
          color: var(--text-muted);
          width: 26px;
          height: 26px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .refresh-btn:hover {
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-primary);
        }

        .panel-body {
          flex: 1;
          overflow-y: auto;
          min-height: 250px;
        }

        .loader-container {
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          color: var(--text-secondary);
          font-size: 13px;
        }

        .error-container {
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          color: #ef4444;
          font-size: 13px;
        }

        .btn-retry {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--glass-border);
          color: var(--text-secondary);
          padding: 6px 12px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
        }

        .empty-container {
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          font-size: 12.5px;
          padding: 40px 20px;
        }

        .empty-icon {
          color: #a855f7;
          margin-bottom: 10px;
        }

        .empty-sub {
          font-size: 11px;
          color: var(--text-secondary);
          margin-top: 4px;
        }

        .rankings-table-wrapper {
          display: flex;
          flex-direction: column;
          width: 100%;
        }

        .table-header {
          display: grid;
          grid-template-columns: 60px 1fr 80px 80px 90px;
          padding: 10px 16px;
          border-bottom: 1px solid var(--glass-border);
          color: var(--text-muted);
          font-size: 11.5px;
          font-weight: 600;
          background: rgba(0, 0, 0, 0.1);
        }

        .ranking-row {
          display: grid;
          grid-template-columns: 60px 1fr 80px 80px 90px;
          padding: 11px 16px;
          align-items: center;
          border-bottom: 1px solid rgba(255, 255, 255, 0.03);
          font-size: 13px;
          color: var(--text-secondary);
          transition: background 0.15s ease;
        }

        .ranking-row:hover {
          background: rgba(255, 255, 255, 0.02);
        }

        .self-row {
          background: rgba(0, 82, 255, 0.06);
          color: var(--text-primary);
        }

        .self-row:hover {
          background: rgba(0, 82, 255, 0.09);
        }

        .rank-cell {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .medal-icon {
          filter: drop-shadow(0 0 3px rgba(0,0,0,0.5));
        }

        .rank-num {
          font-weight: 500;
        }

        .player-cell {
          display: flex;
          align-items: center;
          gap: 10px;
          overflow: hidden;
        }

        .player-avatar {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 1px solid var(--glass-border);
          object-fit: cover;
        }

        .player-name {
          font-weight: 500;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .you-tag {
          font-size: 9.5px;
          background: rgba(0, 82, 255, 0.15);
          color: #60a5fa;
          padding: 1px 5px;
          border-radius: 4px;
          border: 1px solid rgba(0, 82, 255, 0.3);
          font-weight: 600;
        }

        .rating-cell, .games-cell, .winrate-cell {
          font-weight: 500;
        }

        .rating-cell {
          color: var(--text-primary);
        }
      `}</style>
    </div>
  );
};

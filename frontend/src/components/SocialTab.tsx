// frontend/src/components/SocialTab.tsx
import React, { useState, useEffect } from "react";
import { Users, Search, UserPlus, Check, Clock, UserX, Loader2, Play } from "lucide-react";
import { authService } from "../services/authService";

interface Player {
  id: string;
  username: string;
  avatarUrl: string;
  rating: number;
  relationship_status?: "pending" | "accepted" | null;
  sender_id?: string | null;
}

interface FriendshipItem {
  friendship_id: string;
  id: string;
  username: string;
  avatarUrl: string;
  rating: number;
}

interface SocialTabProps {
  currentUserId: string;
  onChallengeFriend: (friendName: string) => void;
  prefetchedData?: { friends: FriendshipItem[]; incoming: FriendshipItem[]; outgoing: FriendshipItem[] };
  onDataRefresh?: () => void;
}

export const SocialTab: React.FC<SocialTabProps> = ({
  currentUserId,
  onChallengeFriend,
  prefetchedData,
  onDataRefresh,
}) => {
  const [friendsList, setFriendsList] = useState<FriendshipItem[]>(prefetchedData?.friends || []);
  const [incomingRequests, setIncomingRequests] = useState<FriendshipItem[]>(prefetchedData?.incoming || []);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Player[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(!prefetchedData);
  const [error, setError] = useState<string | null>(null);

  const fetchSocialData = async () => {
    setError(null);
    try {
      const data = await authService.getFriends();
      setFriendsList(data.friends);
      setIncomingRequests(data.incoming);
      onDataRefresh?.();
    } catch {
      setError("Failed to load friends list");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!prefetchedData) {
      let cancelled = false;
      (async () => {
        try {
          const data = await authService.getFriends();
          if (!cancelled) {
            setFriendsList(data.friends);
            setIncomingRequests(data.incoming);
            onDataRefresh?.();
          }
        } catch {
          if (!cancelled) setError("Failed to load friends list");
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => { cancelled = true; };
    }
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await authService.searchPlayers(searchQuery);
      setSearchResults(results || []);
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setSearching(false);
    }
  };

  const handleSendRequest = async (recipientId: string) => {
    try {
      await authService.sendFriendRequest(recipientId);
      // Re-trigger searches and social lists
      if (searchQuery) {
        const results = await authService.searchPlayers(searchQuery);
        setSearchResults(results || []);
      }
      fetchSocialData();
    } catch (err: any) {
      alert(err.message || "Failed to send request");
    }
  };

  const handleAcceptRequest = async (friendshipId: string) => {
    try {
      await authService.acceptFriendRequest(friendshipId);
      fetchSocialData();
    } catch {
      alert("Failed to accept request");
    }
  };

  const handleRejectRequest = async (friendshipId: string) => {
    try {
      await authService.rejectFriendRequest(friendshipId);
      fetchSocialData();
    } catch {
      alert("Failed to reject request");
    }
  };

  return (
    <div className="social-panel glass-panel">
      <div className="panel-header">
        <div className="header-title flex-center">
          <Users className="social-icon" size={18} />
          <h3>Social & Friends</h3>
        </div>
      </div>

      <div className="panel-body">
        {/* Search bar */}
        <form onSubmit={handleSearch} className="search-players-form">
          <div className="search-wrapper">
            <Search size={14} className="search-input-icon" />
            <input
              type="text"
              placeholder="Search players by username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button type="submit" className="search-submit-btn" disabled={searching}>
              {searching ? <Loader2 size={12} className="animate-spin" /> : "Search"}
            </button>
          </div>
        </form>

        {/* Search results list */}
        {searchResults.length > 0 && (
          <div className="search-results-section">
            <h4>Search Results ({searchResults.length})</h4>
            <div className="players-list">
              {searchResults.map((player) => {
                const status = player.relationship_status;
                const isSender = player.sender_id === currentUserId;

                return (
                  <div key={player.id} className="player-row">
                    <div className="player-meta flex-center">
                      <img src={player.avatarUrl || "default_avatar.svg"} alt={player.username} className="avatar-small" />
                      <div>
                        <span className="player-username">{player.username}</span>
                        <span className="player-rating font-mono">Rating: {player.rating}</span>
                      </div>
                    </div>

                    <div className="player-actions">
                      {status === "accepted" ? (
                        <span className="status-badge accepted"><Check size={12} /> Friends</span>
                      ) : status === "pending" ? (
                        isSender ? (
                          <span className="status-badge pending"><Clock size={12} /> Sent</span>
                        ) : (
                          <span className="status-badge incoming"><Clock size={12} /> Pending</span>
                        )
                      ) : (
                        <button className="add-friend-btn flex-center" onClick={() => handleSendRequest(player.id)}>
                          <UserPlus size={12} /> Add
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <button className="clear-search-btn" onClick={() => { setSearchQuery(""); setSearchResults([]); }}>Clear Results</button>
          </div>
        )}

        {/* Pending Requests list */}
        {incomingRequests.length > 0 && (
          <div className="requests-section">
            <h4>Friend Requests ({incomingRequests.length})</h4>
            <div className="players-list">
              {incomingRequests.map((req) => (
                <div key={req.id} className="player-row">
                  <div className="player-meta flex-center">
                    <img src={req.avatarUrl || "default_avatar.svg"} alt={req.username} className="avatar-small" />
                    <div>
                      <span className="player-username">{req.username}</span>
                      <span className="player-rating font-mono">Rating: {req.rating}</span>
                    </div>
                  </div>
                  <div className="action-buttons-group flex-center">
                    <button className="accept-req-btn flex-center" onClick={() => handleAcceptRequest(req.friendship_id)}>
                      <Check size={12} />
                    </button>
                    <button className="reject-req-btn flex-center" onClick={() => handleRejectRequest(req.friendship_id)}>
                      <UserX size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Friends List */}
        <div className="friends-section">
          <h4>My Friends ({friendsList.length})</h4>
          {loading ? (
            <div className="social-loading flex-center">
              <Loader2 size={16} className="animate-spin text-accent" />
              <span>Updating friends list...</span>
            </div>
          ) : error ? (
            <div className="social-error">{error}</div>
          ) : friendsList.length === 0 ? (
            <div className="social-empty">
              <p>Your friends list is currently empty.</p>
              <p className="empty-sub">Search for users above to send requests.</p>
            </div>
          ) : (
            <div className="players-list">
              {friendsList.map((friend) => (
                <div key={friend.id} className="player-row">
                  <div className="player-meta flex-center">
                    <img src={friend.avatarUrl || "default_avatar.svg"} alt={friend.username} className="avatar-small" />
                    <div>
                      <span className="player-username">{friend.username}</span>
                      <span className="player-rating font-mono">Rating: {friend.rating}</span>
                    </div>
                  </div>
                  <button className="challenge-btn flex-center" onClick={() => onChallengeFriend(friend.username)}>
                    <Play size={10} fill="currentColor" style={{ marginRight: 4 }} /> Challenge
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .social-panel {
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

        .panel-header h3 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .social-icon {
          color: #0052FF;
          margin-right: 8px;
        }

        .panel-body {
          flex: 1;
          padding: 16px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .search-players-form {
          margin-bottom: 4px;
        }

        .search-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .search-input-icon {
          position: absolute;
          left: 10px;
          color: var(--text-muted);
        }

        .search-wrapper input {
          width: 100%;
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid var(--glass-border);
          padding: 7px 80px 7px 30px;
          border-radius: 6px;
          color: var(--text-primary);
          font-size: 12.5px;
          outline: none;
          transition: border-color 0.2s;
        }

        .search-wrapper input:focus {
          border-color: #0052FF;
        }

        .search-submit-btn {
          position: absolute;
          right: 4px;
          background: #0052FF;
          color: white;
          border: none;
          padding: 4px 10px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
        }

        .search-submit-btn:disabled {
          opacity: 0.7;
        }

        .clear-search-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-size: 11px;
          cursor: pointer;
          margin-top: 8px;
          text-decoration: underline;
        }

        .search-results-section h4, .requests-section h4, .friends-section h4 {
          margin: 0 0 10px 0;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--text-muted);
          font-weight: 600;
        }

        .players-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .player-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.04);
          padding: 8px 12px;
          border-radius: 8px;
        }

        .player-meta {
          gap: 10px;
          justify-content: flex-start !important;
        }

        .avatar-small {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: 1px solid var(--glass-border);
          object-fit: cover;
        }

        .player-username {
          display: block;
          font-size: 12.5px;
          font-weight: 500;
          color: var(--text-primary);
        }

        .player-rating {
          font-size: 10px;
          color: var(--text-muted);
        }

        .status-badge {
          font-size: 10.5px;
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 500;
        }

        .status-badge.accepted {
          background: rgba(16, 185, 129, 0.15);
          color: #34d399;
        }

        .status-badge.pending {
          background: rgba(245, 158, 11, 0.15);
          color: #fbbf24;
        }

        .status-badge.incoming {
          background: rgba(0, 82, 255, 0.15);
          color: #60a5fa;
        }

        .add-friend-btn {
          background: rgba(0, 82, 255, 0.15);
          border: 1px solid rgba(0, 82, 255, 0.3);
          color: #60a5fa;
          padding: 4px 10px;
          border-radius: 4px;
          font-size: 11px;
          cursor: pointer;
          gap: 4px;
          font-weight: 600;
          transition: all 0.2s;
        }

        .add-friend-btn:hover {
          background: #0052FF;
          color: white;
        }

        .accept-req-btn {
          background: rgba(16, 185, 129, 0.2);
          border: 1px solid rgba(16, 185, 129, 0.4);
          color: #34d399;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          cursor: pointer;
        }

        .reject-req-btn {
          background: rgba(239, 68, 68, 0.2);
          border: 1px solid rgba(239, 68, 68, 0.4);
          color: #f87171;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          cursor: pointer;
        }

        .action-buttons-group {
          gap: 8px;
        }

        .challenge-btn {
          background: rgba(168, 85, 247, 0.15);
          border: 1px solid rgba(168, 85, 247, 0.3);
          color: #c084fc;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 10.5px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .challenge-btn:hover {
          background: #a855f7;
          color: white;
        }

        .social-loading, .social-empty {
          padding: 20px 10px;
          text-align: center;
          color: var(--text-muted);
          font-size: 12px;
        }

        .social-empty {
          background: rgba(0, 0, 0, 0.1);
          border-radius: 8px;
        }
      `}</style>
    </div>
  );
};

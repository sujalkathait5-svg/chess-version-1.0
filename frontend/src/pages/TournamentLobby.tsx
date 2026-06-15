// frontend/src/pages/TournamentLobby.tsx
import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Trophy, Users, Clock, Swords, Loader2, Pause, Play } from "lucide-react";
import { authService } from "../services/authService";
import { useAuth } from "../hooks/useAuth";
import { socketService } from "../services/socketService";

interface Participant {
  user_id: string;
  username: string;
  avatar_url: string;
  score: number;
  tiebreak: number;
}

interface TournamentData {
  id: string;
  name: string;
  description: string;
  type: string;
  status: string;
  time_control: any;
  start_time: string;
  hasPassword?: boolean;
  participants: Participant[];
}

export function TournamentLobby() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<TournamentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [joinError, setJoinError] = useState('');
  const { currentUser } = useAuth();

  const fetchInitRef = useRef(false);
  useEffect(() => {
    if (!fetchInitRef.current) {
      fetchInitRef.current = true;
      const doFetch = async () => {
        try {
          const res = await fetch(`/api/tournaments/${id}`);
          if (res.ok) {
            const d = await res.json();
            setData(d);
          }
        } catch {
          // Ignore fetch errors
        } finally {
          setLoading(false);
        }
      };
      doFetch();
    }

    // Setup socket listeners
    const socket = socketService.connect();
    if (id) {
      socket.emit('join_tournament_lobby', { tournamentId: id });
    }

    socket.on('leaderboard_updated', (payload: any) => {
      if (payload.tournamentId === id) {
        fetchData();
      }
    });

    socket.on('tournament_game_started', (payload: any) => {
      if (payload.tournamentId === id) {
        // Redir to online play
        navigate('/online', { state: { tournamentMatch: payload } });
      }
    });

    return () => {
      if (id) {
        socket.emit('leave_tournament_lobby', { tournamentId: id });
        socket.emit('leave_tournament_queue', { tournamentId: id });
      }
      socket.off('leaderboard_updated');
      socket.off('tournament_game_started');
    };
  }, [id, navigate]);

  useEffect(() => {
    // If active and not paused, join queue automatically
    if (data?.status === 'active' && !isPaused && currentUser) {
      const socket = socketService.connect();
      socket.emit('join_tournament_queue', { tournamentId: id });
    }
  }, [data?.status, isPaused, currentUser, id]);

  const togglePause = () => {
    const socket = socketService.connect();
    if (isPaused) {
      socket.emit('join_tournament_queue', { tournamentId: id });
      setIsPaused(false);
    } else {
      socket.emit('leave_tournament_queue', { tournamentId: id });
      setIsPaused(true);
    }
  };

  const handleJoin = async () => {
    if (!currentUser) return;
    try {
      setJoinError('');
      const token = localStorage.getItem('kg_auth_token');
      const res = await fetch(`/api/tournaments/${id}/join`, {
        method: "POST",
        headers: { 
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ password: passwordInput })
      });
      if (res.ok) {
        fetchData();
        const socket = socketService.connect();
        socket.emit('join_tournament_queue', { tournamentId: id });
      } else {
        const d = await res.json();
        setJoinError(d.error || "Failed to join");
      }
    } catch {
      setJoinError("An unexpected error occurred");
    }
  };

  const handleLeave = async () => {
    if (!currentUser) return;
    try {
      const token = localStorage.getItem('kg_auth_token');
      const res = await fetch(`/api/tournaments/${id}/leave`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        fetchData();
        const socket = socketService.connect();
        socket.emit('leave_tournament_queue', { tournamentId: id });
      }
    } catch {
      // Ignore
    }
  };

  const isJoined = data?.participants.some(p => p.user_id === currentUser?.id);

  if (loading) {
    return (
      <div className="page-stub flex-center" style={{ height: "100vh" }}>
        <Loader2 className="spinner" size={32} style={{ animation: "spin 1s linear infinite", color: "var(--accent)" }} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page-stub flex-center" style={{ height: "100vh", flexDirection: "column", gap: "16px" }}>
        <h2>Tournament Not Found</h2>
        <button className="btn-primary" onClick={() => navigate('/tournaments')}>Go Back</button>
      </div>
    );
  }

  return (
    <div className="page-stub">
      <div className="back-bar" style={{ marginBottom: "20px" }}>
        <button className="back-to-dashboard-btn" onClick={() => navigate("/tournaments")}>
          <ArrowLeft size={16} />
          <span>Back to Tournaments</span>
        </button>
      </div>

      <div style={{ maxWidth: "900px", margin: "0 auto", width: "100%", display: "flex", gap: "24px" }}>
        {/* Left Col: Info & Controls */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "20px" }}>
          <div className="glass-panel" style={{ padding: "24px", borderRadius: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              {data.type === 'arena' ? <Swords size={24} className="text-orange-400" /> : <Users size={24} className="text-blue-400" />}
              <h2 style={{ margin: 0, fontSize: "24px" }}>{data.name}</h2>
            </div>
            <p style={{ color: "var(--text-secondary)", marginBottom: "20px" }}>{data.description}</p>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "14px", color: "var(--text-muted)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Clock size={16} /> {data.time_control.minutes}+{data.time_control.increment} {data.time_control.name}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Trophy size={16} /> Status: <span style={{ color: data.status === 'active' ? '#4ade80' : 'inherit', fontWeight: 'bold', textTransform: 'capitalize' }}>{data.status}</span>
              </div>
            </div>
          </div>

          {/* Action Area */}
          <div className="glass-panel" style={{ padding: "24px", borderRadius: "12px", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", textAlign: "center" }}>
            {data.status === 'upcoming' && (
              <>
                <h3 style={{ margin: 0, color: "var(--text-secondary)" }}>Tournament Starts In</h3>
                <div style={{ fontSize: "24px", fontWeight: "bold", fontFamily: "var(--font-mono)", color: "var(--accent)" }}>
                  {new Date(data.start_time).toLocaleString()}
                </div>
                <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>Waiting for the tournament to begin...</p>
              </>
            )}

            {data.status === 'active' && currentUser && isJoined && (
              <>
                {!isPaused ? (
                  <>
                    <div style={{ position: "relative" }}>
                      <Loader2 size={48} style={{ color: "#f97316", animation: "spin 2s linear infinite" }} />
                      <Swords size={20} style={{ position: "absolute", top: "14px", left: "14px", color: "#f97316" }} />
                    </div>
                    <h3 style={{ margin: 0, color: "#f97316" }}>Waiting for Pairings...</h3>
                    <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>You will be automatically matched.</p>
                    <button 
                      onClick={togglePause}
                      className="btn-secondary" 
                      style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "8px" }}
                    >
                      <Pause size={16} /> Pause Matches
                    </button>
                  </>
                ) : (
                  <>
                    <Pause size={48} style={{ color: "var(--text-muted)" }} />
                    <h3 style={{ margin: 0, color: "var(--text-secondary)" }}>Matches Paused</h3>
                    <button 
                      onClick={togglePause}
                      className="btn-primary" 
                      style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "8px" }}
                    >
                      <Play size={16} /> Resume Matches
                    </button>
                  </>
                )}
              </>
            )}

            {currentUser && !isJoined && data.status !== 'completed' && (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%", maxWidth: "300px", marginTop: "16px" }}>
                {data.hasPassword && (
                  <input 
                    type="password" 
                    placeholder="Tournament Password" 
                    className="kg-input" 
                    value={passwordInput}
                    onChange={e => setPasswordInput(e.target.value)}
                  />
                )}
                {joinError && <div style={{ color: "#f87171", fontSize: "12px" }}>{joinError}</div>}
                <button className="kg-btn" onClick={handleJoin} style={{ padding: "12px" }}>
                  Join Tournament
                </button>
              </div>
            )}

            {currentUser && isJoined && data.status !== 'completed' && (
              <button 
                onClick={handleLeave}
                style={{
                  marginTop: "16px",
                  padding: "8px 16px",
                  background: "transparent",
                  color: "#f87171",
                  border: "1px solid #f87171",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "12px"
                }}
              >
                Withdraw from Tournament
              </button>
            )}

            {data.status === 'completed' && (
              <>
                <Trophy size={48} style={{ color: "#eab308" }} />
                <h3 style={{ margin: 0, color: "#eab308" }}>Tournament Completed</h3>
                {data.participants.length > 0 && (
                  <p style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
                    Winner: <strong style={{ color: "var(--text-primary)" }}>{data.participants[0].username}</strong>
                  </p>
                )}
              </>
            )}

            {!currentUser && (
              <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>Please log in to participate.</p>
            )}
          </div>
        </div>

        {/* Right Col: Leaderboard */}
        <div style={{ flex: 1, minWidth: "300px" }}>
          <div className="glass-panel" style={{ padding: "20px", borderRadius: "12px", height: "100%" }}>
            <h3 style={{ margin: "0 0 20px 0", display: "flex", alignItems: "center", gap: "8px" }}>
              <Trophy size={20} className="text-yellow-400" /> Leaderboard
            </h3>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {data.participants.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "20px" }}>No participants yet.</div>
              ) : (
                data.participants.map((p, idx) => (
                  <div key={p.user_id} style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    gap: "12px", 
                    padding: "12px", 
                    background: "rgba(255,255,255,0.03)", 
                    borderRadius: "8px",
                    border: p.user_id === currentUser?.id ? "1px solid var(--accent)" : "1px solid transparent"
                  }}>
                    <div style={{ 
                      width: "24px", 
                      fontSize: "14px", 
                      fontWeight: "bold", 
                      color: idx < 3 ? "#eab308" : "var(--text-muted)",
                      textAlign: "center"
                    }}>
                      {idx + 1}
                    </div>
                    <img src={p.avatar_url || "default_avatar.svg"} alt="" style={{ width: "24px", height: "24px", borderRadius: "50%" }} />
                    <div style={{ flex: 1, fontSize: "14px", fontWeight: 600 }}>{p.username}</div>
                    <div style={{ fontSize: "16px", fontWeight: "bold", color: "var(--accent)" }}>{p.score / 2}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

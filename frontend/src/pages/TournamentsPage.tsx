// frontend/src/pages/TournamentsPage.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Trophy, Swords, Users, Clock, Loader2, Plus } from "lucide-react";
import { authService } from "../services/authService";
import { CreateTournamentModal } from "../components/CreateTournamentModal";

interface Tournament {
  id: string;
  name: string;
  description: string;
  type: string;
  status: string;
  start_time: string;
  end_time: string | null;
  time_control: any;
  participant_count: string;
}

export function TournamentsPage() {
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    const fetchTournaments = async () => {
      try {
        const res = await fetch("/api/tournaments");
        const data = await res.json();
        setTournaments(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchTournaments();
  }, []);

  const handleJoin = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!authService.isAuthenticated()) {
      alert("Please log in to join tournaments.");
      return;
    }
    
    try {
      const token = localStorage.getItem('kg_auth_token');
      const res = await fetch(`/api/tournaments/${id}/join`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        navigate(`/tournaments/${id}`);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to join tournament");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const activeTournaments = tournaments.filter(t => t.status === 'active');
  const upcomingTournaments = tournaments.filter(t => t.status === 'upcoming');
  const completedTournaments = tournaments.filter(t => t.status === 'completed');

  const renderCard = (t: Tournament) => (
    <div 
      key={t.id} 
      className="tournament-card glass-panel" 
      onClick={() => navigate(`/tournaments/${t.id}`)}
      style={{
        padding: "20px",
        borderRadius: "12px",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        transition: "transform 0.2s, background 0.2s",
        border: "1px solid rgba(255,255,255,0.05)",
      }}
      onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
      onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h3 style={{ margin: "0 0 4px 0", fontSize: "18px", display: "flex", alignItems: "center", gap: "8px" }}>
            {t.type === 'arena' ? <Swords size={18} className="text-orange-400" /> : <Users size={18} className="text-blue-400" />}
            {t.name}
          </h3>
          <p style={{ margin: 0, fontSize: "12px", color: "var(--text-muted)" }}>{t.description}</p>
        </div>
        <div style={{
          padding: "4px 8px",
          borderRadius: "6px",
          fontSize: "11px",
          fontWeight: "bold",
          textTransform: "uppercase",
          background: t.status === 'active' ? "rgba(34, 197, 94, 0.2)" : "rgba(255, 255, 255, 0.1)",
          color: t.status === 'active' ? "#4ade80" : "var(--text-secondary)"
        }}>
          {t.status}
        </div>
      </div>

      <div style={{ display: "flex", gap: "16px", fontSize: "13px", color: "var(--text-secondary)", marginTop: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <Clock size={14} />
          {t.time_control.minutes}+{t.time_control.increment}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <Users size={14} />
          {t.participant_count} Players
        </div>
      </div>

      {t.status !== 'completed' && (
        <button 
          onClick={(e) => handleJoin(t.id, e)}
          style={{
            marginTop: "8px",
            padding: "8px",
            borderRadius: "6px",
            border: "none",
            background: "var(--accent-primary)",
            color: "white",
            fontWeight: 600,
            cursor: "pointer",
            transition: "opacity 0.2s"
          }}
          onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
          onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
        >
          {t.status === 'active' ? 'Join Now' : 'Register'}
        </button>
      )}
    </div>
  );

  return (
    <div className="page-stub">
      <div className="back-bar" style={{ marginBottom: "20px" }}>
        <button className="back-to-dashboard-btn" onClick={() => navigate("/")}>
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </button>
      </div>

      <div style={{ maxWidth: "800px", margin: "0 auto", width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "32px" }}>
          <div className="stub-icon-wrap" style={{ margin: 0, padding: "12px" }}>
            <Trophy size={28} />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: "28px" }}>Tournaments</h2>
            <p style={{ margin: "4px 0 0", color: "var(--text-muted)" }}>Compete against others in real-time arenas.</p>
          </div>
          {authService.isAuthenticated() && (
            <button 
              onClick={() => setShowCreateModal(true)}
              className="kg-btn" 
              style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 16px" }}
            >
              <Plus size={18} />
              Create Tournament
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
            <Loader2 className="spinner" size={32} style={{ color: "var(--text-muted)", animation: "spin 1s linear infinite" }} />
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
            {activeTournaments.length > 0 && (
              <section>
                <h3 style={{ marginBottom: "16px", color: "#4ade80", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#4ade80" }}></span>
                  Live Now
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
                  {activeTournaments.map(renderCard)}
                </div>
              </section>
            )}

            {upcomingTournaments.length > 0 && (
              <section>
                <h3 style={{ marginBottom: "16px" }}>Upcoming</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
                  {upcomingTournaments.map(renderCard)}
                </div>
              </section>
            )}

            {completedTournaments.length > 0 && (
              <section>
                <h3 style={{ marginBottom: "16px", color: "var(--text-muted)" }}>Completed</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px", opacity: 0.7 }}>
                  {completedTournaments.map(renderCard)}
                </div>
              </section>
            )}

            {tournaments.length === 0 && (
              <div className="glass-panel" style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                <Trophy size={32} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
                <p>No tournaments scheduled right now.</p>
              </div>
            )}
          </div>
        )}
      </div>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .tournament-card:hover {
          background: rgba(255,255,255,0.02) !important;
        }
      `}</style>
      
      {showCreateModal && (
        <CreateTournamentModal 
          onClose={() => setShowCreateModal(false)}
          onCreated={(id) => {
            setShowCreateModal(false);
            navigate(`/tournaments/${id}`);
          }}
        />
      )}
    </div>
  );
}

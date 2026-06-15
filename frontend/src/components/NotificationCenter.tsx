// frontend/src/components/NotificationCenter.tsx
import React, { useState, useEffect, useRef } from "react";
import { Bell, BellRing, Check, UserPlus, Swords, Trophy, Info } from "lucide-react";
import { socketService } from "../services/socketService";

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  link_url?: string;
  created_at: string;
}

export const NotificationCenter: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initial fetch
    fetch("/api/notifications", {
      headers: {
        "Authorization": `Bearer ${localStorage.getItem("kg_auth_token")}`
      }
    })
    .then(res => res.json())
    .then(data => {
      if (Array.isArray(data)) {
        setNotifications(data);
        setUnreadCount(data.filter(n => !n.is_read).length);
      }
    })
    .catch(console.error);

    // Listen for real-time notifications
    const socket = socketService.connect();
    socket.on('notification', (newNotif: Notification) => {
      setNotifications(prev => [newNotif, ...prev]);
      setUnreadCount(prev => prev + 1);
    });

    return () => {
      socket.off('notification');
    };
  }, []);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await fetch(`/api/notifications/${id}/read`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("kg_auth_token")}`
        }
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllAsRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/notifications/read-all`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("kg_auth_token")}`
        }
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case 'friend_request': return <UserPlus size={16} className="text-blue-400" />;
      case 'match_request': return <Swords size={16} className="text-orange-400" />;
      case 'tournament': return <Trophy size={16} className="text-yellow-400" />;
      default: return <Info size={16} className="text-slate-400" />;
    }
  };

  return (
    <div className="notification-center" ref={dropdownRef}>
      <button 
        className="notification-trigger" 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: "relative",
          background: "rgba(255, 255, 255, 0.05)",
          border: "1px solid var(--glass-border)",
          width: "38px",
          height: "38px",
          borderRadius: "10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          transition: "all 0.2s ease",
          color: "var(--text-primary)"
        }}
      >
        {unreadCount > 0 ? <BellRing size={18} /> : <Bell size={18} />}
        {unreadCount > 0 && (
          <span style={{
            position: "absolute",
            top: "-4px",
            right: "-4px",
            background: "var(--accent-error)",
            color: "#fff",
            fontSize: "10px",
            fontWeight: "bold",
            padding: "2px 5px",
            borderRadius: "10px",
            minWidth: "18px",
            textAlign: "center"
          }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown glass-panel" style={{
          position: "absolute",
          top: "50px",
          right: 0,
          width: "320px",
          maxHeight: "400px",
          display: "flex",
          flexDirection: "column",
          zIndex: 100,
          boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
          borderRadius: "12px",
          overflow: "hidden"
        }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 16px",
            borderBottom: "1px solid var(--glass-border)",
            background: "rgba(255,255,255,0.02)"
          }}>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 600 }}>Notifications</h3>
            {unreadCount > 0 && (
              <button 
                onClick={handleMarkAllAsRead}
                style={{ 
                  background: "transparent", 
                  border: "none", 
                  color: "var(--accent-primary)", 
                  fontSize: "12px", 
                  cursor: "pointer" 
                }}
              >
                Mark all as read
              </button>
            )}
          </div>

          <div style={{ overflowY: "auto", flex: 1 }}>
            {notifications.length === 0 ? (
              <div style={{ padding: "30px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
                <Bell size={24} style={{ opacity: 0.2, margin: "0 auto 8px" }} />
                <p>No notifications yet</p>
              </div>
            ) : (
              notifications.map(n => (
                <div 
                  key={n.id} 
                  style={{
                    display: "flex",
                    gap: "12px",
                    padding: "12px 16px",
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                    background: n.is_read ? "transparent" : "rgba(59, 130, 246, 0.05)",
                    cursor: n.link_url ? "pointer" : "default",
                    transition: "background 0.2s"
                  }}
                  onClick={() => {
                    if (!n.is_read) handleMarkAsRead(n.id);
                    if (n.link_url) window.location.href = n.link_url; // or use react-router navigate if passed as prop
                  }}
                >
                  <div style={{ marginTop: "2px" }}>
                    {getIconForType(n.type)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "13px", fontWeight: n.is_read ? 500 : 700, color: "var(--text-primary)", marginBottom: "2px" }}>
                      {n.title}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.4" }}>
                      {n.message}
                    </div>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "4px" }}>
                      {new Date(n.created_at).toLocaleString()}
                    </div>
                  </div>
                  {!n.is_read && (
                    <button 
                      onClick={(e) => handleMarkAsRead(n.id, e)}
                      style={{ 
                        background: "transparent", 
                        border: "none", 
                        color: "var(--text-muted)", 
                        cursor: "pointer",
                        padding: "4px"
                      }}
                      title="Mark as read"
                    >
                      <Check size={14} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

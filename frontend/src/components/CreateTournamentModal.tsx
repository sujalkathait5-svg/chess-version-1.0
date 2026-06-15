import React, { useState } from 'react';
import { X } from 'lucide-react';
import { timeControlsList } from '../chess-logic/models';

interface CreateTournamentModalProps {
  onClose: () => void;
  onCreated: (tournamentId: string) => void;
}

export const CreateTournamentModal: React.FC<CreateTournamentModalProps> = ({ onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [timeControlId, setTimeControlId] = useState(timeControlsList[0].id);
  const [duration, setDuration] = useState(60);
  const [isPublic, setIsPublic] = useState(true);
  const [password, setPassword] = useState('');
  const [maxPlayers, setMaxPlayers] = useState<number | ''>('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    const tc = timeControlsList.find(t => t.id === timeControlId);
    if (!tc) return;

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('kg_auth_token');
      const res = await fetch('/api/tournaments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          description,
          timeControl: tc,
          duration,
          isPublic,
          password: isPublic ? null : password,
          maxPlayers: maxPlayers === '' ? null : Number(maxPlayers)
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        onCreated(data.tournament.id);
      } else {
        setError(data.error || 'Failed to create tournament');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="modal-content glass-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', width: '90%' }}>
        <button className="modal-close" onClick={onClose}><X size={20} /></button>
        <h2 style={{ margin: '0 0 24px', fontSize: '24px' }}>Create Tournament</h2>

        {error && <div className="error-message" style={{ marginBottom: '16px', color: '#f87171', background: 'rgba(248, 113, 113, 0.1)', padding: '12px', borderRadius: '8px' }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Tournament Name</label>
            <input 
              type="text" 
              className="kg-input" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder="e.g. Weekly Bullet Arena" 
              style={{ width: '100%' }}
              required 
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Description</label>
            <textarea 
              className="kg-input" 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
              placeholder="Optional description..."
              style={{ width: '100%', minHeight: '80px', resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Time Control</label>
              <select className="kg-input" value={timeControlId} onChange={e => setTimeControlId(e.target.value)} style={{ width: '100%' }}>
                {timeControlsList.map(tc => (
                  <option key={tc.id} value={tc.id}>{tc.label}</option>
                ))}
              </select>
            </div>
            
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Duration (minutes)</label>
              <select className="kg-input" value={duration} onChange={e => setDuration(Number(e.target.value))} style={{ width: '100%' }}>
                <option value={30}>30 mins</option>
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hours</option>
                <option value={120}>2 hours</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Max Players</label>
              <input 
                type="number" 
                className="kg-input" 
                value={maxPlayers} 
                onChange={e => setMaxPlayers(e.target.value === '' ? '' : Number(e.target.value))} 
                placeholder="Unlimited" 
                min="2"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
            <input 
              type="checkbox" 
              id="isPublic" 
              checked={isPublic} 
              onChange={e => setIsPublic(e.target.checked)} 
              style={{ accentColor: 'var(--accent-primary)', width: '16px', height: '16px' }}
            />
            <label htmlFor="isPublic" style={{ color: 'var(--text-secondary)' }}>Public Tournament (listed in lobby)</label>
          </div>

          {!isPublic && (
            <div>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Password</label>
              <input 
                type="text" 
                className="kg-input" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                placeholder="Required for private tournaments" 
                style={{ width: '100%' }}
              />
            </div>
          )}

          <button 
            type="submit" 
            className="kg-btn" 
            style={{ marginTop: '16px', padding: '12px', fontSize: '16px' }}
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create Tournament'}
          </button>
        </form>
      </div>

      <style>{`
        .modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.7);
          backdrop-filter: blur(4px);
        }
        .modal-content {
          padding: 32px;
          position: relative;
          box-shadow: 0 20px 40px rgba(0,0,0,0.4);
        }
        .modal-close {
          position: absolute;
          top: 16px; right: 16px;
          color: var(--text-muted);
          transition: color 0.2s;
        }
        .modal-close:hover {
          color: var(--text-primary);
        }
      `}</style>
    </div>
  );
};

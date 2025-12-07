import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

interface PlayerInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenStats: () => void;
  onOpenHistory: () => void;
  onOpenEmotes: () => void;
}

export default function PlayerInfoModal({ isOpen, onClose, onOpenStats, onOpenHistory, onOpenEmotes }: PlayerInfoModalProps) {
  const { user, refreshUser } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);

  // Load current display name when modal opens
  useEffect(() => {
    if (isOpen && user?.display_name) {
      setDisplayName(user.display_name);
      setNameSaved(false);
    }
  }, [isOpen, user?.display_name]);

  const handleSaveDisplayName = async () => {
    if (!displayName.trim() || displayName === user?.display_name) return;
    
    setIsSavingName(true);
    try {
      const { api } = await import('../config');
      await api.patch('/api/player/profile', { display_name: displayName.trim() });
      
      setNameSaved(true);
      if (refreshUser) {
        await refreshUser();
      }
      setTimeout(() => setNameSaved(false), 2000);
    } catch (error) {
      console.error('Failed to update display name:', error);
    } finally {
      setIsSavingName(false);
    }
  };

  const handleStatsClick = () => {
    onClose();
    onOpenStats();
  };

  const handleHistoryClick = () => {
    onClose();
    onOpenHistory();
  };

  const handleEmotesClick = () => {
    onClose();
    onOpenEmotes();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-void/90 backdrop-blur-sm" />
      
      {/* Modal */}
      <div 
        className="relative bg-surface border border-grid-line rounded-xl w-full max-w-sm overflow-hidden animate-scale-in"
        style={{ boxShadow: '0 0 30px rgba(0,255,255,0.2)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-grid-line">
          <h2 className="font-heading font-bold text-lg text-primary">Player Info</h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-player transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Display Name Editor */}
          <div>
            <label className="block text-sm text-muted font-body mb-2">Display Name</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value.slice(0, 20))}
                maxLength={20}
                className="flex-1 px-3 py-3 bg-elevated border border-grid-line rounded-lg text-primary font-body focus:outline-none focus:border-player focus:shadow-glow-player-subtle transition-all"
                placeholder="Enter name..."
              />
              <button
                onClick={handleSaveDisplayName}
                disabled={isSavingName || !displayName.trim() || displayName === user?.display_name}
                className="px-4 py-3 rounded-lg font-body font-bold text-sm transition-all disabled:opacity-40"
                style={{
                  background: nameSaved ? 'rgba(0,255,136,0.2)' : 'rgb(15, 10, 25)',
                  border: nameSaved ? '2px solid #00FF88' : '2px solid rgba(0,255,255,0.5)',
                  color: nameSaved ? '#00FF88' : '#00FFFF',
                }}
              >
                {isSavingName ? '...' : nameSaved ? '✓' : 'Save'}
              </button>
            </div>
            <p className="text-xs text-muted font-body mt-1">Max 20 characters</p>
          </div>

          {/* Action Buttons Grid */}
          <div className="grid grid-cols-3 gap-3 pt-2">
            {/* Stats */}
            <button
              onClick={handleStatsClick}
              className="flex flex-col items-center gap-2 py-4 rounded-lg transition-all hover:scale-105 active:scale-95"
              style={{
                background: 'rgba(139,0,255,0.1)',
                border: '2px solid rgba(139,0,255,0.3)',
                boxShadow: '0 0 10px rgba(139,0,255,0.1)',
              }}
            >
              <svg className="w-6 h-6 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="text-xs font-body font-semibold text-secondary">Stats</span>
            </button>

            {/* History */}
            <button
              onClick={handleHistoryClick}
              className="flex flex-col items-center gap-2 py-4 rounded-lg transition-all hover:scale-105 active:scale-95"
              style={{
                background: 'rgba(139,0,255,0.1)',
                border: '2px solid rgba(139,0,255,0.3)',
                boxShadow: '0 0 10px rgba(139,0,255,0.1)',
              }}
            >
              <svg className="w-6 h-6 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs font-body font-semibold text-secondary">History</span>
            </button>

            {/* Emotes */}
            <button
              onClick={handleEmotesClick}
              className="flex flex-col items-center gap-2 py-4 rounded-lg transition-all hover:scale-105 active:scale-95"
              style={{
                background: 'rgba(139,0,255,0.1)',
                border: '2px solid rgba(139,0,255,0.3)',
                boxShadow: '0 0 10px rgba(139,0,255,0.1)',
              }}
            >
              <span className="text-2xl">😂</span>
              <span className="text-xs font-body font-semibold text-secondary">Emotes</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

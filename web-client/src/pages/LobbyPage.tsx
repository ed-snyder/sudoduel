import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { matchmakingAPI } from '../services/api';
import MatchHistoryModal from '../components/MatchHistoryModal';
import StatsModal from '../components/StatsModal';
import SettingsModal from '../components/SettingsModal';
import AvatarPickerModal from '../components/AvatarPickerModal';
import SudoDuelLogo from '../components/SudoDuelLogo';

interface LobbyPageProps {
  onMatchFound: (matchId: number) => void;
}

type Difficulty = 'easy' | 'medium' | 'hard' | 'ultra';

export default function LobbyPage({ onMatchFound }: LobbyPageProps) {
  const { user, logout } = useAuth();
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [showMatchHistory, setShowMatchHistory] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('easy');
  const [avatar, setAvatar] = useState(() => {
    return localStorage.getItem('userAvatar') || '😎';
  });
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptsRef = useRef(0);

  const isPremium = false;

  const difficulties: { key: Difficulty; label: string; available: boolean }[] = [
    { key: 'easy', label: 'Easy', available: true },
    { key: 'medium', label: 'Medium', available: false },
    { key: 'hard', label: 'Hard', available: false },
    { key: 'ultra', label: 'Ultra', available: false },
  ];

  const handleAvatarSave = (newAvatar: string) => {
    setAvatar(newAvatar);
    localStorage.setItem('userAvatar', newAvatar);
  };

  const stopPolling = () => {
    if (pollingRef.current) {
      clearTimeout(pollingRef.current);
      pollingRef.current = null;
    }
    attemptsRef.current = 0;
  };

  const handleFindMatch = async () => {
    setError('');
    setSearching(true);
    attemptsRef.current = 0;

    try {
      const response = await matchmakingAPI.join() as { status: string; match_id?: number };
      
      if (response.status === 'matched') {
        stopPolling();
        onMatchFound(response.match_id!);
      } else {
        pollForMatch();
      }
    } catch (err: any) {
      setError(err.message);
      setSearching(false);
    }
  };

  const pollForMatch = () => {
    pollingRef.current = setTimeout(async () => {
      attemptsRef.current++;
      
      if (attemptsRef.current >= 30) {
        try {
          await matchmakingAPI.leave();
        } catch (e) {}
        setSearching(false);
        setError('No opponent found. Try again!');
        stopPolling();
        return;
      }

      try {
        const response = await matchmakingAPI.status() as { status: string; match_id?: number };
        
        if (response.status === 'matched') {
          stopPolling();
          onMatchFound(response.match_id!);
        } else if (response.status === 'queued') {
          pollForMatch();
        } else {
          setSearching(false);
          stopPolling();
        }
      } catch (err) {
        setSearching(false);
        stopPolling();
      }
    }, 1000);
  };

  const handleCancel = async () => {
    stopPolling();
    try {
      await matchmakingAPI.leave();
    } catch (err) {}
    setSearching(false);
  };

  return (
    <div className="min-h-screen bg-void flex flex-col">
      {/* Header with Logo */}
      <div className="px-4 pt-32 pb-4 flex flex-col items-center safe-top">
        <SudoDuelLogo size="lg" />
      </div>
      
      {/* Player Card */}
      <div className="px-4 py-6">
        <div className="bg-surface rounded-xl p-4 border border-grid-line">
          <div className="flex items-center gap-4">
            {/* Avatar - Tappable */}
            <button
              onClick={() => setShowAvatarPicker(true)}
              className="relative group"
            >
              <div 
                className="w-14 h-14 rounded-full flex items-center justify-center border-2 border-player text-2xl font-heading font-bold transition-all group-hover:shadow-glow-player"
                style={{ 
                  background: 'linear-gradient(135deg, rgba(0,255,255,0.2) 0%, rgba(139,0,255,0.2) 100%)',
                  boxShadow: 'inset 0 0 15px rgba(0,255,255,0.3)'
                }}
              >
                {avatar}
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-player rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <svg className="w-3 h-3 text-void" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </div>
            </button>
            
            {/* Info */}
            <div className="flex-1">
              <div className="font-black text-primary font-display text-lg">{user?.display_name || 'Player'}</div>
              <div className="text-sm text-secondary font-display">
                Rating: <span className="font-display text-player">{Math.round(user?.rating || 1500)}</span>
              </div>
            </div>
            
            {/* Settings Button */}
            <button 
              onClick={() => setShowSettings(true)}
              className="text-muted hover:text-player transition-colors p-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Difficulty Selection */}
      <div className="px-4 py-3">
        <div className="flex gap-2">
          {difficulties.map((diff) => (
            <button
              key={diff.key}
              onClick={() => diff.available && setSelectedDifficulty(diff.key)}
              disabled={!diff.available}
              className={`flex-1 py-3 px-2 rounded-lg font-display font-black text-sm uppercase tracking-wider transition-all relative ${
                selectedDifficulty === diff.key
                  ? 'bg-player/20 text-player border-2 border-player shadow-glow-player-subtle'
                  : diff.available
                  ? 'bg-surface text-secondary border border-grid-line hover:border-player/50'
                  : 'bg-surface/50 text-muted border border-grid-line/50 cursor-not-allowed'
              }`}
            >
              {diff.label}
              {!diff.available && (
                <span className="absolute -top-2 -right-2 text-xs px-1.5 py-0.5 bg-elevated border border-grid-line text-muted rounded font-mono">
                  Soon
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Stats for Selected Difficulty */}
      <div className="px-4 py-6">
        <div className="bg-surface rounded-xl p-4 border border-grid-line space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-muted font-display text-sm">Rating</span>
            <span className="text-primary font-display font-black">{Math.round(user?.rating || 1500)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted font-display text-sm">League</span>
            <span className="text-secondary font-display text-sm italic">Coming soon to SudoDuel+</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted font-display text-sm">Global Rank</span>
            <span className="text-secondary font-display text-sm italic">Coming Soon</span>
          </div>
        </div>
      </div>

      {/* Main Action Area */}
      <div className="flex-1 flex flex-col items-center justify-start px-4 pt-12 pb-4">
        {error && (
          <div 
            className="w-full max-w-sm mb-4 px-4 py-3 bg-error/10 border border-error/50 rounded-lg"
            style={{ boxShadow: '0 0 15px rgba(255,51,102,0.2)' }}
          >
            <p className="text-error text-sm font-display">{error}</p>
          </div>
        )}

        {searching ? (
          <div className="w-full max-w-sm text-center">
            <div className="relative w-20 h-20 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full border-4 border-surface" />
              <div 
                className="absolute inset-0 rounded-full border-4 border-transparent border-t-player animate-spin"
                style={{ 
                  boxShadow: '0 0 20px rgba(0,255,255,0.5)',
                  filter: 'drop-shadow(0 0 10px rgba(0,255,255,0.8))'
                }}
              />
            </div>
            
            <h2 className="text-xl font-display font-black text-primary mb-2 tracking-wide">SEARCHING...</h2>
            <p className="text-secondary font-display mb-1">Looking for an opponent</p>
            <p className="text-player text-lg font-display mb-6">
              0:{String(30 - attemptsRef.current).padStart(2, '0')}
            </p>
            
            <button
              onClick={handleCancel}
              className="w-full py-3 bg-surface border border-grid-line text-secondary font-display font-black rounded-lg hover:border-error/50 hover:text-error transition-all"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="w-full max-w-sm space-y-4">
            <div className="flex gap-3">
              <button
                onClick={() => {/* TODO: Premium flow */}}
                className="flex-1 py-3 bg-gradient-to-r from-gold/20 to-gold/10 border border-gold/50 text-gold font-display font-black rounded-lg hover:from-gold/30 hover:to-gold/20 hover:shadow-glow-gold transition-all flex items-center justify-center"
              >
                Upgrade to SudoDuel+
              </button>
              <button
                onClick={() => alert('Coming Soon to SudoDuel+')}
                className="flex-1 py-3 bg-surface border border-grid-line text-secondary font-display font-black rounded-lg hover:border-player/50 hover:text-player transition-all flex items-center justify-center"
              >
                Daily Challenge
              </button>
            </div>

            <button
              onClick={handleFindMatch}
              className="w-full py-4 bg-transparent border-2 border-player text-player text-lg font-display font-black uppercase tracking-widest rounded-xl hover:bg-player/20 hover:shadow-glow-player-intense active:scale-[0.98] transition-all animate-glow-pulse"
            >
              Find Match
            </button>
          </div>
        )}
      </div>

      {/* Bottom Buttons */}
      <div className="px-4 pb-6 pt-8 flex gap-3 safe-bottom">
        <button
          onClick={() => setShowMatchHistory(true)}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-surface border border-grid-line text-secondary font-display font-black rounded-lg hover:border-opponent/50 hover:text-opponent transition-all relative"
          style={{
            boxShadow: '0 0 15px rgba(255, 0, 255, 0.3), 0 0 30px rgba(255, 0, 255, 0.15)',
          }}
        >
          <svg 
            className="w-5 h-5" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
            style={{
              filter: 'drop-shadow(0 0 4px rgba(255, 0, 255, 0.8))',
            }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span
            style={{
              textShadow: '0 0 8px rgba(255, 0, 255, 0.6)',
            }}
          >
            History
          </span>
        </button>
        <button
          onClick={() => setShowStats(true)}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-surface border border-grid-line text-secondary font-display font-black rounded-lg hover:border-opponent/50 hover:text-opponent transition-all relative"
          style={{
            boxShadow: '0 0 15px rgba(255, 0, 255, 0.3), 0 0 30px rgba(255, 0, 255, 0.15)',
          }}
        >
          <svg 
            className="w-5 h-5" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
            style={{
              filter: 'drop-shadow(0 0 4px rgba(255, 0, 255, 0.8))',
            }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span
            style={{
              textShadow: '0 0 8px rgba(255, 0, 255, 0.6)',
            }}
          >
            Stats
          </span>
        </button>
      </div>

      {/* Modals */}
      <AvatarPickerModal
        isOpen={showAvatarPicker}
        onClose={() => setShowAvatarPicker(false)}
        currentAvatar={avatar}
        onSave={handleAvatarSave}
        isPremium={isPremium}
      />
      <MatchHistoryModal
        isOpen={showMatchHistory}
        onClose={() => setShowMatchHistory(false)}
        playerName={user?.display_name || 'Player'}
        currentRating={user?.rating || 1500}
      />
      <StatsModal
        isOpen={showStats}
        onClose={() => setShowStats(false)}
      />
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onLogout={logout}
      />
    </div>
  );
}

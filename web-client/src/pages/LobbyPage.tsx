import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { matchmakingAPI } from '../services/api';
import MatchHistoryModal from '../components/MatchHistoryModal';
import StatsModal from '../components/StatsModal';
import SettingsModal from '../components/SettingsModal';
import PlayerInfoModal from '../components/PlayerInfoModal';
import EmoteCustomizerModal from '../components/EmoteCustomizerModal';
import FriendsListModal from '../components/FriendsListModal';
import SudoDuelLogo from '../components/SudoDuelLogo';
import BackgroundEffects from '../components/BackgroundEffects';

interface LobbyPageProps {
  onMatchFound: (matchId: number) => void;
}

type Difficulty = 'easy' | 'medium' | 'hard' | 'ultra';

export default function LobbyPage({ onMatchFound }: LobbyPageProps) {
  const { user, logout, refreshUser } = useAuth();
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [showMatchHistory, setShowMatchHistory] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPlayerInfo, setShowPlayerInfo] = useState(false);
  const [showEmoteCustomizer, setShowEmoteCustomizer] = useState(false);
  const [showFriendsList, setShowFriendsList] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('easy');
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptsRef = useRef(0);

  const isPremium = false;

  const difficulties: { key: Difficulty; label: string; available: boolean }[] = [
    { key: 'easy', label: 'Easy', available: true },
    { key: 'medium', label: 'Medium', available: false },
    { key: 'hard', label: 'Hard', available: false },
    { key: 'ultra', label: 'Ultra', available: false },
  ];


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
    <div className="min-h-screen bg-void flex flex-col relative z-20">
      <BackgroundEffects />
      
      {/* Header with Logo */}
      <div className="px-4 pt-32 pb-4 flex flex-col items-center safe-top relative z-20">
        <SudoDuelLogo size="xl" />
      </div>
      
      {/* Top Bar - Only Friends */}
      <div className="flex items-center justify-between px-4 py-3 relative z-20">
        {/* Friends Button */}
        <button
          onClick={() => setShowFriendsList(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all hover:bg-player/10"
          style={{
            background: 'rgba(30,15,45,0.5)',
            border: '1px solid rgba(139,0,255,0.3)',
          }}
        >
          <svg className="w-5 h-5 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span className="text-sm font-body text-secondary">Friends</span>
        </button>

        {/* Settings Button */}
        <button 
          onClick={() => setShowSettings(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all hover:bg-player/10"
          style={{
            background: 'rgba(30,15,45,0.5)',
            border: '1px solid rgba(139,0,255,0.3)',
          }}
        >
          <svg className="w-5 h-5 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-sm font-body text-secondary">Settings</span>
        </button>
      </div>

      {/* Player Name Button - Clickable */}
      <div className="px-4 py-2 relative z-20">
        <button
          onClick={() => setShowPlayerInfo(true)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all hover:bg-player/10 group"
          style={{
            background: 'rgba(0,255,255,0.05)',
            border: '2px solid rgba(0,255,255,0.3)',
            boxShadow: '0 0 15px rgba(0,255,255,0.1)',
          }}
        >
          <div className="text-left">
            <div 
              className="font-heading font-bold text-xl text-player group-hover:text-white transition-colors"
              style={{ textShadow: '0 0 10px rgba(0,255,255,0.3)' }}
            >
              {user?.display_name || 'Player'}
            </div>
            <div className="text-xs text-muted font-body">Tap to view profile</div>
          </div>
          <svg className="w-5 h-5 text-muted group-hover:text-player transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Difficulty Selection */}
      <div className="px-4 py-3 relative z-20">
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
      <div className="px-4 py-3 relative z-20">
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
      <div className="flex-1 flex flex-col items-center justify-start px-4 pt-4 pb-4 relative z-20">
        {error && (
          <div 
            className="w-full max-w-sm mb-4 px-4 py-3 bg-void bg-error/10 border border-error/50 rounded-lg"
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
          <>
            <div className="w-full max-w-sm mb-6">
              <div className="flex gap-3">
                <button
                  onClick={() => {/* TODO: Premium flow */}}
                  className="flex-1 py-3 bg-void bg-gradient-to-r from-gold/20 to-gold/10 border border-gold/50 text-gold font-display font-black rounded-lg hover:from-gold/30 hover:to-gold/20 hover:shadow-glow-gold transition-all flex items-center justify-center"
                >
                  Upgrade to SudoDuel+
                </button>
                <button
                  onClick={() => alert('Coming Soon')}
                  className="flex-1 py-3 bg-surface border-2 border-player/50 text-player font-display font-black rounded-lg hover:border-player hover:shadow-glow-player-subtle active:scale-[0.98] transition-all flex items-center justify-center"
                >
                  Practice Mode
                </button>
              </div>
            </div>

            <button
              onClick={handleFindMatch}
              className="w-full max-w-sm py-4 bg-void border-2 border-player text-player text-lg font-display font-black uppercase tracking-widest rounded-xl hover:bg-player/20 hover:shadow-glow-player-intense active:scale-[0.98] transition-all animate-glow-pulse"
            >
              Find Match
            </button>
          </>
        )}
      </div>
      
      {/* Modals */}
      <PlayerInfoModal
        isOpen={showPlayerInfo}
        onClose={() => setShowPlayerInfo(false)}
        onOpenStats={() => setShowStats(true)}
        onOpenHistory={() => setShowMatchHistory(true)}
        onOpenEmotes={() => setShowEmoteCustomizer(true)}
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
      />
      {/* Emote Customizer Modal */}
      <EmoteCustomizerModal
        isOpen={showEmoteCustomizer}
        onClose={() => setShowEmoteCustomizer(false)}
        isPremium={isPremium}
      />
      {/* Friends List Modal */}
      <FriendsListModal
        isOpen={showFriendsList}
        onClose={() => setShowFriendsList(false)}
      />
    </div>
  );
}

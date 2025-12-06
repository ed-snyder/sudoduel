import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { matchmakingAPI } from '../services/api';
import MatchHistoryModal from '../components/MatchHistoryModal';
import StatsModal from '../components/StatsModal';
import SettingsModal from '../components/SettingsModal';
import SudoDuelLogo from '../components/SudoDuelLogo';

interface LobbyPageProps {
  onMatchFound: (matchId: number) => void;
}

export default function LobbyPage({ onMatchFound }: LobbyPageProps) {
  const { user, logout } = useAuth();
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [showMatchHistory, setShowMatchHistory] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  // Use browser timer type instead of NodeJS.Timeout to avoid Node typings in the client bundle
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptsRef = useRef(0);

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
        // Start polling
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
        // 30 seconds timeout
        try {
          await matchmakingAPI.leave();
        } catch (e) {}
        setSearching(false);
        setError('No opponent found. Try again!');
        stopPolling();
        return;
      }

      try {
        // Use status check instead of join() to avoid spamming the backend
        const response = await matchmakingAPI.status() as { status: string; match_id?: number };
        
        if (response.status === 'matched') {
          stopPolling();
          onMatchFound(response.match_id!);
        } else if (response.status === 'queued') {
          // Still in queue, continue polling
          pollForMatch();
        } else {
          // Not queued anymore (maybe left queue?), stop polling
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
    } catch (err) {
      // Ignore
    }
    setSearching(false);
  };

  return (
    <div className="min-h-screen bg-void flex flex-col">
      {/* Header */}
      <div className="px-4 pt-8 pb-6 flex flex-col items-center relative z-10 safe-top">
        <SudoDuelLogo size="lg" />
      </div>
      
      {/* Main Content - Centered */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 -mt-16">
        {/* Player Card */}
        <div className="w-full max-w-sm mb-6">
          <div className="bg-surface rounded-lg p-4 flex items-center gap-4 border border-grid-line">
            <div className="w-12 h-12 bg-player/20 rounded-full flex items-center justify-center border border-player/50">
              <span className="text-player text-xl font-bold font-heading">
                {user?.display_name?.[0]?.toUpperCase() || 'P'}
              </span>
            </div>
            <div className="flex-1">
              <div className="font-body font-semibold text-primary">{user?.display_name || 'Player'}</div>
              <div className="text-sm text-muted font-body">
                Rating: <span className="font-mono text-player">{Math.round(user?.rating || 1500)}</span>
              </div>
            </div>
            <button 
              onClick={() => setShowSettings(true)}
              className="text-muted hover:text-player transition-colors p-1"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>

        {/* History and Stats Buttons */}
        <div className="w-full max-w-sm mb-8 flex gap-3">
          <button
            onClick={() => setShowMatchHistory(true)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-surface border border-grid-line text-secondary font-body font-medium rounded-lg hover:border-player/50 hover:text-player transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            History
          </button>
          <button
            onClick={() => setShowStats(true)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-surface border border-grid-line text-secondary font-body font-medium rounded-lg hover:border-player/50 hover:text-player transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Stats
          </button>
        </div>

        {/* Main Action */}
        <div className="w-full max-w-sm">
          {error && (
            <div className="mb-4 px-4 py-3 bg-error/10 border border-error/50 rounded-lg">
              <p className="text-error text-sm font-body">{error}</p>
            </div>
          )}

          {searching ? (
            <div className="text-center">
              {/* Spinner */}
              <div className="w-16 h-16 border-4 border-surface border-t-player rounded-full animate-spin mx-auto mb-6"
                style={{ boxShadow: '0 0 15px rgba(0,255,255,0.3)' }} />
              
              <h2 className="text-xl font-heading font-semibold text-primary mb-2">Searching...</h2>
              <p className="text-secondary font-body mb-1">Looking for an opponent</p>
              <p className="text-muted text-sm font-mono mb-6">
                {attemptsRef.current}:{String(30 - attemptsRef.current).padStart(2, '0')}
              </p>
              
              <button
                onClick={handleCancel}
                className="w-full py-3 bg-surface border border-grid-line text-secondary font-body font-semibold rounded-lg hover:border-player/50 hover:text-player transition-all"
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={handleFindMatch}
                className="w-full py-4 bg-transparent border-2 border-player text-player font-body font-bold uppercase tracking-widest rounded-lg hover:bg-player/20 hover:shadow-glow-player transition-all"
              >
                Find Match
              </button>
              <p className="mt-3 text-muted text-sm font-body text-center">Ranked • 210 seconds</p>
            </>
          )}
        </div>
      </div>

      {/* Modals */}
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

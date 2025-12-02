import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { matchmakingAPI } from '../services/api';

interface LobbyPageProps {
  onMatchFound: (matchId: number) => void;
}

export default function LobbyPage({ onMatchFound }: LobbyPageProps) {
  const { user, logout } = useAuth();
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
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
      const response = await matchmakingAPI.join();
      
      if (response.status === 'matched') {
        stopPolling();
        onMatchFound(response.match_id);
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
        const response = await matchmakingAPI.status();
        
        if (response.status === 'matched') {
          stopPolling();
          onMatchFound(response.match_id);
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
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="px-4 py-6 border-b border-gray-200 flex flex-col items-center">
        <img 
          src="/sudoduel-logo.png" 
          alt="Sudoduel" 
          className="h-20 object-contain"
        />
      </div>
      
      {/* Player Card */}
      <div className="px-4 py-4">
        <div className="bg-gray-50 rounded-lg p-4 flex items-center gap-4 border border-gray-200">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
            <span className="text-blue-500 text-xl font-bold">
              {user?.display_name?.[0]?.toUpperCase() || 'P'}
            </span>
          </div>
          <div className="flex-1">
            <div className="font-semibold text-gray-800">{user?.display_name || 'Player'}</div>
            <div className="text-sm text-gray-500">
              Rating: <span className="font-mono">{Math.round(user?.rating || 1500)}</span>
            </div>
          </div>
          <button 
            onClick={logout}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main Action */}
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        {error && (
          <div className="w-full max-w-sm mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {searching ? (
          <div className="w-full max-w-sm text-center">
            {/* Spinner */}
            <div className="w-16 h-16 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-6" />
            
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Searching...</h2>
            <p className="text-gray-500 mb-1">Looking for an opponent</p>
            <p className="text-gray-400 text-sm font-mono mb-6">
              {attemptsRef.current}:{String(30 - attemptsRef.current).padStart(2, '0')}
            </p>
            
            <button
              onClick={handleCancel}
              className="w-full py-3 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={handleFindMatch}
              className="w-full max-w-sm py-4 bg-blue-500 text-white text-lg font-semibold rounded-lg hover:bg-blue-600 active:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20"
            >
              Find Match
            </button>
            <p className="mt-3 text-gray-400 text-sm">Ranked • 90 seconds</p>
          </>
        )}
      </div>
      
      {/* Stats Section */}
      <div className="px-4 py-6 border-t border-gray-200">
        <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Your Stats</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-800">0</div>
            <div className="text-xs text-gray-500">Played</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-500">0</div>
            <div className="text-xs text-gray-500">Wins</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-800">-</div>
            <div className="text-xs text-gray-500">Win Rate</div>
          </div>
        </div>
      </div>
    </div>
  );
}

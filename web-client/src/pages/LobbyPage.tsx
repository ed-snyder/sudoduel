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
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
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
        const response = await matchmakingAPI.join();
        
        if (response.status === 'matched') {
          stopPolling();
          onMatchFound(response.match_id);
        } else {
          // Continue polling
          pollForMatch();
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
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg p-8 w-full max-w-md text-center">
        <h1 className="text-3xl font-bold text-white mb-2">🎮 Sudoduel</h1>
        
        <div className="bg-gray-700 rounded-lg p-4 mb-6">
          <p className="text-gray-300">Welcome back,</p>
          <p className="text-xl font-bold text-white">{user?.display_name}</p>
          <p className="text-2xl font-bold text-blue-400 mt-2">
            ⭐ {Math.round(user?.rating || 1500)}
          </p>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-300 px-4 py-2 rounded mb-4">
            {error}
          </div>
        )}

        {searching ? (
          <div>
            <div className="animate-pulse text-white text-xl mb-4">
              🔍 Searching for opponent...
            </div>
            <p className="text-gray-400 text-sm mb-4">
              Attempt {attemptsRef.current}/30
            </p>
            <button
              onClick={handleCancel}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-8 rounded-lg transition"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={handleFindMatch}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold text-xl py-4 rounded-lg transition mb-4"
          >
            ⚔️ Find Match
          </button>
        )}

        <button
          onClick={logout}
          className="text-gray-400 hover:text-white transition mt-4"
        >
          Logout
        </button>
      </div>
    </div>
  );
}

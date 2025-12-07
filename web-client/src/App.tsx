import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import LobbyPage from './pages/LobbyPage';
import GamePage from './pages/GamePage';

function AppContent() {
  const { user, loading } = useAuth();
  const [matchId, setMatchId] = useState<number | null>(null);

    return (
    <div className="min-h-screen bg-void">
      {loading ? (
        <div className="min-h-screen bg-void flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
      ) : !user ? (
        <LoginPage />
      ) : matchId ? (
      <GamePage
        matchId={matchId}
        onGameEnd={() => setMatchId(null)}
        onRematch={(newMatchId) => setMatchId(newMatchId)}
      />
      ) : (
        <LobbyPage onMatchFound={setMatchId} />
      )}
    </div>
    );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

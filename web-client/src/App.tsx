import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import LobbyPage from './pages/LobbyPage';
import GamePage from './pages/GamePage';

function AppContent() {
  const { user, loading } = useAuth();
  const [matchId, setMatchId] = useState<number | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  if (matchId) {
    return (
      <GamePage
        matchId={matchId}
        onGameEnd={() => setMatchId(null)}
        onRematch={(newMatchId) => setMatchId(newMatchId)}
      />
    );
  }

  return <LobbyPage onMatchFound={setMatchId} />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

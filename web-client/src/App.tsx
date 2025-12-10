import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SubscriptionProvider } from './context/SubscriptionContext';
import LoginPage from './pages/LoginPage';
import LobbyPage from './pages/LobbyPage';
import GamePage from './pages/GamePage';
import SoloModePage from './pages/SoloModePage';
import TutorialFlow from './components/TutorialFlow';
import UpgradeModal from './components/UpgradeModal';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { adService } from './services/adService';

function AppContent() {
  const { user, loading, justSignedUp, clearJustSignedUp } = useAuth();
  const [matchId, setMatchId] = useState<number | null>(null);
  const [soloMode, setSoloMode] = useState(false);

  // Initialize ads early for faster loading
  useEffect(() => {
    adService.initialize();
  }, []);

  // Pre-warm haptics engine on app start (earliest possible)
  useEffect(() => {
    const warmUpHaptics = async () => {
      try {
        console.log('[PERF] Pre-warming haptics engine...');
        await Haptics.impact({ style: ImpactStyle.Light });
        console.log('[PERF] Haptics engine ready');
      } catch (e) {
        // Ignore - haptics may not be available (web, etc.)
        console.log('[PERF] Haptics not available:', e);
      }
    };
    warmUpHaptics();
  }, []);

  // Warm up renderer immediately on app load (earlier initialization)
  useEffect(() => {
    const warmUp = () => {
      try {
        // Ensure document.body exists before accessing it
        if (!document.body) {
          // Wait for DOM to be ready
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', warmUp, { once: true });
            return;
          }
          // If still not ready, try again on next frame
          requestAnimationFrame(warmUp);
          return;
        }

        const div = document.createElement('div');
        div.style.cssText = 'position:fixed;left:-9999px;visibility:hidden;';
        div.innerHTML = `
          <span style="font-family:Industry,Orbitron,sans-serif;font-size:1.5rem;font-weight:bold;color:#00FFFF;text-shadow:0 0 12px rgba(0,255,255,0.7);">123456789</span>
          <span style="font-family:Industry,Orbitron,sans-serif;font-size:1.5rem;font-weight:bold;color:rgba(255,255,255,0.95);">123456789</span>
        `;
        document.body.appendChild(div);
        void div.offsetHeight; // Force layout
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            try {
              if (div.parentNode) {
                document.body.removeChild(div);
              }
            } catch {
              // Ignore cleanup errors
            }
          });
        });
      } catch {
        // Silently fail - warm-up is non-critical
        // Warm-up failed, but that's okay
      }
    };
    warmUp();
  }, []);

  // Handle tutorial completion
  const handleTutorialComplete = async () => {
    clearJustSignedUp();
    // Also mark in localStorage as backup
    localStorage.setItem('sudoduel_tutorial_completed', 'true');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  // Not logged in - show login page
  if (!user) {
    return <LoginPage />;
  }

  // JUST signed up - show tutorial BEFORE lobby
  if (justSignedUp) {
    return (
      <TutorialFlow 
        onComplete={handleTutorialComplete}
        onSkip={handleTutorialComplete}
        gameMode="duel"
      />
    );
  }

  // Solo mode - show solo game
  if (soloMode) {
    return <SoloModePage onExit={() => setSoloMode(false)} />;
  }

  // In a match - show game
  if (matchId) {
    return (
      <GamePage
        matchId={matchId}
        onGameEnd={() => setMatchId(null)}
        onRematch={(newMatchId) => setMatchId(newMatchId)}
        onFindNewMatch={(newMatchId) => setMatchId(newMatchId)}
      />
    );
  }

  // Default - show lobby
  return <LobbyPage onMatchFound={setMatchId} onStartSoloMode={() => setSoloMode(true)} />;
}

export default function App() {
  return (
    <AuthProvider>
      <SubscriptionProvider>
        <AppContent />
        <UpgradeModal />
      </SubscriptionProvider>
    </AuthProvider>
  );
}

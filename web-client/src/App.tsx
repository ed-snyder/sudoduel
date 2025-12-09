import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import LobbyPage from './pages/LobbyPage';
import GamePage from './pages/GamePage';
import TutorialFlow, { hasTutorialCompleted } from './components/TutorialFlow';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

function AppContent() {
  const { user, loading, refreshUser } = useAuth();
  const [matchId, setMatchId] = useState<number | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);

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
            } catch (e) {
              // Ignore cleanup errors
            }
          });
        });
      } catch (e) {
        // Silently fail - warm-up is non-critical
        console.warn('[PERF] Warm-up failed:', e);
      }
    };
    warmUp();
  }, []);

  // Track if this is a fresh signup (tutorial should only show after signup, not login)
  const [isFreshSignup, setIsFreshSignup] = useState(false);

  // Check if tutorial should be shown (only for new signups, never on login)
  useEffect(() => {
    if (user && isFreshSignup && !hasTutorialCompleted(user)) {
      // Check localStorage as backup
      if (localStorage.getItem('sudoduel_tutorial_completed') !== 'true') {
        setShowTutorial(true);
        setIsFreshSignup(false); // Reset flag
      }
    } else if (user && !isFreshSignup) {
      // User logged in or already processed, don't show tutorial
      setShowTutorial(false);
    }
  }, [user, isFreshSignup]);

  // Listen for signup completion (we'll need to pass this from LoginPage)
  // For now, check localStorage for a signup flag
  useEffect(() => {
    const justSignedUp = sessionStorage.getItem('sudoduel_just_signed_up') === 'true';
    if (justSignedUp) {
      setIsFreshSignup(true);
      sessionStorage.removeItem('sudoduel_just_signed_up');
    }
  }, []);

  const handleTutorialComplete = async () => {
    setShowTutorial(false);
    // Refresh user to get updated tutorial_completed status
    await refreshUser();
  };

  const handleTutorialSkip = async () => {
    setShowTutorial(false);
    // Refresh user to get updated tutorial_completed status
    await refreshUser();
  };

  // Show tutorial overlay if needed (blocks everything else)
  if (showTutorial) {
    return (
      <TutorialFlow
        onComplete={handleTutorialComplete}
        onSkip={handleTutorialSkip}
        gameMode="duel"
      />
    );
  }

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
        onFindNewMatch={(newMatchId) => setMatchId(newMatchId)}
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

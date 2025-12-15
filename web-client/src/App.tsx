import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SubscriptionProvider } from './context/SubscriptionContext';
import { MusicProvider } from './context/MusicContext';
import LoginPage from './pages/LoginPage';
import LobbyPage from './pages/LobbyPage';
import GamePage from './pages/GamePage';
import DailyRunPage from './pages/DailyRunPage';
import TutorialFlow from './components/TutorialFlow';
import UpgradeModal from './components/UpgradeModal';
import DisplayNameSetup from './components/DisplayNameSetup';
// GuestBanner removed - inline guest indicator now in LobbyPage
import SecureAccountModal from './components/SecureAccountModal';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { adService } from './services/adService';
import { playerAPI } from './services/api';

function AppContent() {
  const { 
    user, 
    loading, 
    justSignedUp, 
    clearJustSignedUp, 
    refreshUser,
    needsDisplayName,
    clearNeedsDisplayName,
  } = useAuth();
  const [matchId, setMatchId] = useState<number | null>(null);
  const [dailyRun, setDailyRun] = useState(false);
  const [showSecureModal, setShowSecureModal] = useState(false);

  // Initialize ads - deferred to not block initial render
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      adService.initialize();
    }, 2000);
    return () => clearTimeout(timeoutId);
  }, []);

  // Pre-warm haptics engine - deferred
  useEffect(() => {
    const warmUpHaptics = async () => {
      try {
        await Haptics.impact({ style: ImpactStyle.Light });
      } catch (e) {
        // Ignore - haptics may not be available (web, etc.)
      }
    };
    
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => warmUpHaptics(), { timeout: 2000 });
    } else {
      setTimeout(warmUpHaptics, 1000);
    }
  }, []);

  // Warm up renderer - deferred
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
      }
    };
    
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => warmUp(), { timeout: 3000 });
    } else {
      setTimeout(warmUp, 1500);
    }
  }, []);

  // Handle skill level selection - called immediately when user picks
  const handleSkillSelect = async (level: 'beginner' | 'experienced') => {
    const rating = level === 'beginner' ? 500 : 1500;
    console.log(`[Tutorial] User selected: ${level}, setting rating to: ${rating}`);
    try {
      const result = await playerAPI.setInitialRating(rating);
      console.log(`[Tutorial] API response:`, result);
    } catch (error: any) {
      console.error(`[Tutorial] Failed to set ${level} rating:`, error?.message || error);
      // Continue anyway
    }
  };

  // Handle tutorial completion
  const handleTutorialComplete = async () => {
    // Refresh user data to get updated rating
    try {
      await refreshUser();
      console.log('[Tutorial] User data refreshed');
    } catch (error) {
      console.error('[Tutorial] Failed to refresh user:', error);
    }
    
    clearJustSignedUp();
    // Also mark in localStorage as backup
    localStorage.setItem('sudoduel_tutorial_completed', 'true');
  };
  
  // Handle tutorial skip (no skill selection made)
  const handleTutorialSkip = async () => {
    // Refresh user data
    try {
      await refreshUser();
    } catch (error) {
      console.error('[Tutorial] Failed to refresh user on skip:', error);
    }
    
    clearJustSignedUp();
    localStorage.setItem('sudoduel_tutorial_completed', 'true');
  };

  // Handle display name setup completion
  const handleDisplayNameComplete = () => {
    clearNeedsDisplayName();
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

  // New user needs to pick a display name first
  if (needsDisplayName) {
    return (
      <DisplayNameSetup 
        onComplete={handleDisplayNameComplete}
        suggestedName={user.display_name}
      />
    );
  }

  // JUST signed up - show tutorial BEFORE lobby
  if (justSignedUp && !user.tutorial_completed) {
    return (
      <TutorialFlow 
        onComplete={handleTutorialComplete}
        onSkip={handleTutorialSkip}
        onSkillSelect={handleSkillSelect}
        gameMode="duel"
      />
    );
  }

  // Daily Run - show daily run game
  if (dailyRun) {
    return <DailyRunPage onExit={() => setDailyRun(false)} />;
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
  return (
    <>
      <LobbyPage 
        onMatchFound={setMatchId} 
        onStartSoloMode={() => setDailyRun(true)}
        onSecureAccount={() => setShowSecureModal(true)}
      />
      <SecureAccountModal 
        isOpen={showSecureModal}
        onClose={() => setShowSecureModal(false)}
      />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SubscriptionProvider>
        <MusicProvider>
          <AppContent />
          <UpgradeModal />
        </MusicProvider>
      </SubscriptionProvider>
    </AuthProvider>
  );
}

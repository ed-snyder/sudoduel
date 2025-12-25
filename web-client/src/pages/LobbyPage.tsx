import { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';
import { matchmakingAPI, friendsAPI, playerAPI, type UserRank } from '../services/api';
import type { MatchRequest } from '../services/api';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Browser } from '@capacitor/browser';
import SudoDuelLogo from '../components/SudoDuelLogo';
import BackgroundEffects from '../components/BackgroundEffects';
import { useSoundEffects } from '../hooks/useSoundEffects';
import { useMusic } from '../context/MusicContext';

// Lazy load modals for code splitting
const MatchHistoryModal = lazy(() => import('../components/MatchHistoryModal'));
const StatsModal = lazy(() => import('../components/StatsModal'));
const SettingsModal = lazy(() => import('../components/SettingsModal'));
const PlayerInfoModal = lazy(() => import('../components/PlayerInfoModal'));
const EmoteCustomizerModal = lazy(() => import('../components/EmoteCustomizerModal'));
const FriendsListModal = lazy(() => import('../components/FriendsListModal'));
const LeaderboardScreen = lazy(() => import('../components/LeaderboardScreen'));

interface LobbyPageProps {
  onMatchFound: (matchId: number) => void;
  onStartSoloMode?: () => void;
  onSecureAccount?: () => void;
  onReplayTutorial?: () => void;
}

type Difficulty = 'easy' | 'medium' | 'hard' | 'ultra';

// Simple loading component for modals
function ModalLoader() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/80">
      <div className="w-8 h-8 border-2 border-player border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function LobbyPage({ onMatchFound, onStartSoloMode, onSecureAccount, onReplayTutorial }: LobbyPageProps) {
  const { user, token, isGuest } = useAuth();
  const { isPremium, openUpgradeModal } = useSubscription();
  const { playJoinQueue, playSearching, stopSearching, playMatchFound } = useSoundEffects(0.8);
  const { stopMusic } = useMusic();
  
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [showMatchHistory, setShowMatchHistory] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPlayerInfo, setShowPlayerInfo] = useState(false);
  const [showEmoteCustomizer, setShowEmoteCustomizer] = useState(false);
  const [showFriendsList, setShowFriendsList] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('easy');
  const [incomingMatchRequest, setIncomingMatchRequest] = useState<MatchRequest | null>(null);
  const [matchRequestActionLoading, setMatchRequestActionLoading] = useState(false);
  const [pendingFriendRequestCount, setPendingFriendRequestCount] = useState(0);
  const [rankData, setRankData] = useState<UserRank | null>(null);
  const [rankLoading, setRankLoading] = useState(true);
  const [nextChallengeCountdown, setNextChallengeCountdown] = useState('');
  const [showCopiedToast, setShowCopiedToast] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptsRef = useRef(0);

  const difficulties: { key: Difficulty; label: string; available: boolean }[] = [
    { key: 'easy', label: 'Easy', available: true },
    { key: 'medium', label: 'Medium', available: false },
    { key: 'hard', label: 'Hard', available: false },
    { key: 'ultra', label: 'Ultra', available: false },
  ];

  // Countdown timer to midnight UTC for Daily Challenge
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const tomorrow = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1,
        0, 0, 0, 0
      ));
      const diff = tomorrow.getTime() - now.getTime();
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      setNextChallengeCountdown(
        `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`
      );
    };
    
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);


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
    playJoinQueue();

    try {
      const response = await matchmakingAPI.join() as { status: string; match_id?: number };
      
      if (response.status === 'matched') {
        stopMusic();        // Stop lobby music first
        playMatchFound();
        stopPolling();
        onMatchFound(response.match_id!);
      } else {
        playSearching();
        pollForMatch();
      }
    } catch (err: any) {
      stopSearching();
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
        stopSearching();
        setSearching(false);
        setError('No opponent found. Try again!');
        stopPolling();
        return;
      }

      try {
        const response = await matchmakingAPI.status() as { status: string; match_id?: number };
        
        if (response.status === 'matched') {
          stopMusic();        // Stop lobby music first
          playMatchFound();
          stopPolling();
          onMatchFound(response.match_id!);
        } else if (response.status === 'queued') {
          pollForMatch();
        } else {
          stopSearching();
          setSearching(false);
          stopPolling();
        }
      } catch (err) {
        stopSearching();
        setSearching(false);
        stopPolling();
      }
    }, 1000);
  };

  const handleCancel = async () => {
    stopSearching();
    stopPolling();
    try {
      await matchmakingAPI.leave();
    } catch (err) {}
    setSearching(false);
  };

  // Poll for incoming friend match requests and pending friend requests
  useEffect(() => {
    const checkForMatchRequests = async () => {
      try {
        const response = await friendsAPI.getPendingMatchRequests();
        if (response.requests && response.requests.length > 0) {
          setIncomingMatchRequest(response.requests[0]);
        } else {
          setIncomingMatchRequest(null);
        }
      } catch (err) {
        console.error('Failed to check match requests:', err);
      }
    };

    const checkForFriendRequests = async () => {
      try {
        const response = await friendsAPI.getPendingRequestsReceived();
        setPendingFriendRequestCount(response.requests?.length || 0);
      } catch (err) {
        console.error('Failed to check friend requests:', err);
      }
    };

    // Defer initial check to not block first paint
    const initialDelay = setTimeout(() => {
      checkForMatchRequests();
      checkForFriendRequests();
    }, 1500);

    const interval = setInterval(() => {
      checkForMatchRequests();
      checkForFriendRequests();
    }, 5000);

    return () => {
      clearTimeout(initialDelay);
      clearInterval(interval);
    };
  }, []);

  // Fetch global rank - refresh when user data changes (e.g., after a game)
  useEffect(() => {
    if (!token) return;
    
    // Defer rank loading to let UI render first
    const timeoutId = setTimeout(async () => {
      setRankLoading(true);
      try {
        const data = await playerAPI.getRank();
        setRankData(data);
      } catch (error) {
        console.error('Failed to load rank:', error);
      } finally {
        setRankLoading(false);
      }
    }, 800);

    return () => clearTimeout(timeoutId);
  }, [token, user?.rating]); // Refresh when rating changes

  const handleAcceptMatchRequest = async () => {
    if (!incomingMatchRequest || matchRequestActionLoading) return;

    setMatchRequestActionLoading(true);
    try {
      const response = await friendsAPI.acceptMatchRequest(incomingMatchRequest.id);
      if (response.matchId) {
        onMatchFound(response.matchId);
        setIncomingMatchRequest(null);
      }
    } catch (err: any) {
      console.error('Failed to accept match request:', err);
      setIncomingMatchRequest(null);
    } finally {
      setMatchRequestActionLoading(false);
    }
  };

  const handleRejectMatchRequest = async () => {
    if (!incomingMatchRequest || matchRequestActionLoading) return;

    setMatchRequestActionLoading(true);
    try {
      await friendsAPI.rejectMatchRequest(incomingMatchRequest.id);
      setIncomingMatchRequest(null);
    } catch (err: any) {
      console.error('Failed to reject match request:', err);
      setIncomingMatchRequest(null);
    } finally {
      setMatchRequestActionLoading(false);
    }
  };

  const vibrate = async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch (e) {
      // Haptics not available
    }
  };

  return (
    <div className="h-screen bg-void flex flex-col relative z-20 overflow-hidden">
      <BackgroundEffects />
      
      {/* Header with Logo */}
      <div className="px-4 pt-14 pb-2 flex flex-col items-center safe-top relative z-20">
        <SudoDuelLogo size="xl" />
      </div>
      
      {/* Top Bar - Friends, Emotes, Settings */}
      <div className="flex items-center justify-between px-4 py-3 relative z-20">
        {/* Friends Button */}
        <button
          onClick={() => setShowFriendsList(true)}
          className="relative flex items-center gap-2 px-3 py-2 rounded-lg transition-all hover:bg-player/10"
          style={{
            background: 'rgba(30,15,45,0.5)',
            border: '1px solid rgba(139,0,255,0.3)',
          }}
        >
          <svg className="w-5 h-5 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span className="text-sm font-body text-secondary">Friends</span>
          {pendingFriendRequestCount > 0 && (
            <span 
              className="absolute -top-1 -right-1 min-w-5 h-5 flex items-center justify-center px-1.5 text-xs font-bold text-white rounded-full"
              style={{ background: '#FF3B30' }}
            >
              {pendingFriendRequestCount > 9 ? '9+' : pendingFriendRequestCount}
            </span>
          )}
        </button>

        {/* Emotes Button - Magenta border with shimmer */}
        <button
          onClick={() => setShowEmoteCustomizer(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all hover:scale-105 active:scale-95 shimmer-button magenta-glow-pulse"
          style={{
            background: 'rgba(255, 0, 255, 0.08)',
            border: '2px solid rgba(255, 0, 255, 0.6)',
          }}
        >
          <span className="text-sm font-body font-semibold" style={{ color: '#FF00FF' }}>Emotes</span>
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
          <div className="text-left flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div 
                className="font-heading font-bold text-xl text-player group-hover:text-white transition-colors truncate"
                style={{ textShadow: '0 0 10px rgba(0,255,255,0.3)' }}
              >
                {user?.display_name || 'Player'}
              </div>
              {isGuest && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSecureAccount?.();
                  }}
                  className="flex items-center gap-1 px-2 py-0.5 text-xs text-amber-400/80 hover:text-amber-300 border border-amber-500/30 hover:border-amber-400/50 rounded-full transition-all hover:bg-amber-500/10"
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    <path d="M12 8v4"/>
                    <path d="M12 16h.01"/>
                  </svg>
                  <span className="font-body">Guest</span>
                </button>
              )}
            </div>
            <div className="text-xs text-muted font-body">Tap to view profile, match history, and statistics</div>
          </div>
          <svg className="w-5 h-5 text-muted group-hover:text-player transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Difficulty Selection */}
      <div className="px-4 py-2 relative z-20">
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
        </button>
          ))}
        </div>
      </div>

      {/* Stats for Selected Difficulty */}
      <div className="px-4 py-2 relative z-20">
        <div className="bg-surface rounded-xl p-3 border border-grid-line space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-muted font-display text-sm">Rating</span>
            <span className="text-primary font-display font-black">{Math.round(user?.rating || 1500)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted font-display text-sm">League</span>
            <span className="text-muted font-display text-sm">—</span>
          </div>
          <button
            onClick={() => {
              if (isPremium) {
                setShowLeaderboard(true);
              } else {
                openUpgradeModal();
              }
            }}
            className="flex justify-between items-center w-full hover:bg-player/5 -mx-2 px-2 py-1 rounded transition-colors"
          >
            <span className="text-muted font-display text-sm">Global Rank</span>
            <div className="flex items-center gap-2">
              {isPremium ? (
                // Premium: Show actual rank
                rankLoading ? (
                  <span className="text-primary font-display font-black">...</span>
                ) : rankData && rankData.rank != null ? (
                  <div className="text-right">
                    <span className="text-primary font-display font-black">
                      #{rankData.rank.toLocaleString()}
                    </span>
                    <span className="text-muted font-mono text-xs ml-1">
                      of {rankData.total_players.toLocaleString()}
                    </span>
                  </div>
                ) : (
                  <span className="text-muted font-display text-sm">--</span>
                )
              ) : (
                // Free: Show upgrade prompt
                <span className="text-secondary font-display text-sm italic">
                  Upgrade to see rank
                </span>
              )}
              <svg 
                className="w-4 h-4 text-player animate-chevron-pulse" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        </div>
      </div>

      {/* Main Action Area */}
      <div className={`flex-1 flex flex-col items-center px-4 py-2 relative z-20 ${isPremium ? 'justify-center' : 'justify-start pt-6'}`}>
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
            <div className="relative w-16 h-16 mx-auto mb-4">
              <div className="absolute inset-0 rounded-full border-4 border-surface" />
              <div 
                className="absolute inset-0 rounded-full border-4 border-transparent border-t-player animate-spin"
                style={{ 
                  boxShadow: '0 0 20px rgba(0,255,255,0.5)',
                  filter: 'drop-shadow(0 0 10px rgba(0,255,255,0.8))'
                }}
              />
            </div>
            
            <h2 className="text-xl font-display font-black text-primary mb-1 tracking-wide">SEARCHING...</h2>
            <p className="text-secondary font-display mb-4">Looking for an opponent</p>
            
            <button
              onClick={handleCancel}
              className="w-full py-3 bg-surface border border-grid-line text-secondary font-display font-black rounded-lg hover:border-error/50 hover:text-error transition-all"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <div className="w-full max-w-sm mb-5">
              {/* Next Challenge Countdown */}
              <div className="text-center mb-4">
                <span className="text-muted text-sm font-body">Next Challenge: </span>
                <span className="text-player font-mono text-sm">{nextChallengeCountdown}</span>
              </div>
              
              {isPremium ? (
                /* Premium users: Daily Challenge centered, no upgrade button */
                <button
                  onClick={() => onStartSoloMode?.()}
                  className="w-full py-3 px-4 rounded-xl font-body font-semibold text-base transition-all active:scale-[0.98]"
                  style={{
                    background: 'rgba(10, 5, 20, 0.95)',
                    border: '2px solid rgba(0, 255, 255, 0.5)',
                    color: '#00FFFF',
                  }}
                >
                  Daily Challenge
                </button>
              ) : (
                /* Free users: Upgrade + Daily Challenge side by side */
                <div className="flex gap-3">
                  <button
                    onClick={openUpgradeModal}
                    className="flex-1 py-3 px-4 rounded-xl font-body font-semibold text-base transition-all active:scale-[0.98] upgrade-button-bob upgrade-button-sheen"
                    style={{
                      background: 'rgba(10, 5, 20, 0.95)',
                      border: '2px solid rgba(255, 215, 0, 0.6)',
                      color: '#FFD700',
                      boxShadow: '0 0 15px rgba(255, 215, 0, 0.2)',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    Upgrade to Sudoduel+
                  </button>
                  <button
                    onClick={() => onStartSoloMode?.()}
                    className="flex-1 py-3 px-4 rounded-xl font-body font-semibold text-base transition-all active:scale-[0.98]"
                    style={{
                      background: 'rgba(10, 5, 20, 0.95)',
                      border: '2px solid rgba(0, 255, 255, 0.5)',
                      color: '#00FFFF',
                    }}
                  >
                    Daily Challenge
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={handleFindMatch}
              className="w-full max-w-sm py-4 bg-void border-2 border-player text-player text-lg font-display font-black uppercase tracking-widest rounded-xl hover:bg-player/20 hover:shadow-glow-player-intense active:scale-[0.98] transition-all animate-glow-pulse mb-2"
            >
              Find Match
            </button>

            {/* Discord & Invite Buttons - Side by side */}
            <div className="flex gap-2 w-full max-w-sm mt-5">
              {/* Discord Button */}
              <button
                onClick={() => Browser.open({ url: 'https://discord.gg/24u2NKcQ' })}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all hover:scale-105 active:scale-95 shimmer-button magenta-glow-pulse"
                style={{
                  background: 'rgba(255, 0, 255, 0.08)',
                  border: '2px solid rgba(255, 0, 255, 0.6)',
                }}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#FF00FF">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.947 2.418-2.157 2.418z"/>
                </svg>
                <span className="text-xs font-body font-semibold" style={{ color: '#FF00FF' }}>Discord</span>
              </button>

              {/* Invite a Friend Button */}
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText('Play me in Sudoduel! https://apps.apple.com/us/app/sudoduel-sudoku-multiplayer/id6756116702');
                  vibrate();
                  setShowCopiedToast(true);
                  setTimeout(() => setShowCopiedToast(false), 2000);
                }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all hover:scale-105 active:scale-95 shimmer-button magenta-glow-pulse"
                style={{
                  background: 'rgba(255, 0, 255, 0.08)',
                  border: '2px solid rgba(255, 0, 255, 0.6)',
                }}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="#FF00FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                  <polyline points="16 6 12 2 8 6"/>
                  <line x1="12" y1="2" x2="12" y2="15"/>
                </svg>
                <span className="text-xs font-body font-semibold" style={{ color: '#FF00FF' }}>Invite a Friend!</span>
              </button>
            </div>
          </>
        )}
      </div>
      
      {/* Copied to Clipboard Toast */}
      {showCopiedToast && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 animate-scale-in">
          <div 
            className="px-6 py-4 rounded-xl text-center"
            style={{
              background: 'rgba(20, 10, 30, 0.95)',
              border: '2px solid rgba(255, 0, 255, 0.6)',
              boxShadow: '0 0 30px rgba(255, 0, 255, 0.4)',
            }}
          >
            <div className="text-2xl mb-2">📋</div>
            <p className="font-body font-semibold" style={{ color: '#FF00FF' }}>
              Copied link to clipboard!
            </p>
          </div>
        </div>
      )}

      {/* Modals - Only render when open, wrapped with Suspense */}
      {showPlayerInfo && (
        <Suspense fallback={<ModalLoader />}>
          <PlayerInfoModal
            isOpen={showPlayerInfo}
            onClose={() => setShowPlayerInfo(false)}
            onOpenStats={() => setShowStats(true)}
            onOpenHistory={() => setShowMatchHistory(true)}
          />
        </Suspense>
      )}
      {showMatchHistory && (
        <Suspense fallback={<ModalLoader />}>
          <MatchHistoryModal
            isOpen={showMatchHistory}
            onClose={() => setShowMatchHistory(false)}
            playerName={user?.display_name || 'Player'}
            currentRating={user?.rating || 1500}
          />
        </Suspense>
      )}
      {showStats && (
        <Suspense fallback={<ModalLoader />}>
          <StatsModal
            isOpen={showStats}
            onClose={() => setShowStats(false)}
          />
        </Suspense>
      )}
      {showSettings && (
        <Suspense fallback={<ModalLoader />}>
          <SettingsModal
            isOpen={showSettings}
            onClose={() => setShowSettings(false)}
            onReplayTutorial={onReplayTutorial}
          />
        </Suspense>
      )}
      {showEmoteCustomizer && (
        <Suspense fallback={<ModalLoader />}>
          <EmoteCustomizerModal
            isOpen={showEmoteCustomizer}
            onClose={() => setShowEmoteCustomizer(false)}
            isPremium={isPremium}
          />
        </Suspense>
      )}
      {showFriendsList && (
        <Suspense fallback={<ModalLoader />}>
          <FriendsListModal
            isOpen={showFriendsList}
            onClose={() => {
              setShowFriendsList(false);
              // Refresh pending friend request count after modal closes
              friendsAPI.getPendingRequestsReceived()
                .then(response => setPendingFriendRequestCount(response.requests?.length || 0))
                .catch(() => {});
            }}
            onMatchFound={onMatchFound}
          />
        </Suspense>
      )}
      {showLeaderboard && (
        <Suspense fallback={<ModalLoader />}>
          <LeaderboardScreen 
            isOpen={showLeaderboard} 
            onClose={() => setShowLeaderboard(false)} 
          />
        </Suspense>
      )}

      {/* Incoming Match Request Modal */}
      {incomingMatchRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-void/95" />
          
          <div 
            className="relative bg-surface border-2 border-player rounded-xl w-full max-w-sm overflow-hidden animate-scale-in"
            style={{ boxShadow: '0 0 30px rgba(0,255,255,0.4)' }}
          >
            <div className="p-6 text-center">
              {/* Pulsing icon */}
              <div 
                className="mx-auto w-20 h-20 rounded-full flex items-center justify-center text-3xl mb-4"
                style={{
                  background: 'linear-gradient(135deg, rgba(0,255,255,0.3) 0%, rgba(139,0,255,0.3) 100%)',
                  border: '3px solid rgba(0,255,255,0.5)',
                  boxShadow: '0 0 20px rgba(0,255,255,0.3)',
                  animation: 'pulse 1.5s ease-in-out infinite',
                }}
              >
                ⚔️
              </div>
              
              <h3 
                className="font-heading font-bold text-xl text-player mb-2"
                style={{ textShadow: '0 0 10px rgba(0,255,255,0.4)' }}
              >
                {incomingMatchRequest.from_display_name} wants to duel!
              </h3>
              <p className="text-secondary font-body text-sm mb-1">
                Rating: <span className="text-player font-mono">{Math.round(incomingMatchRequest.from_rating)}</span>
              </p>
              <p className="text-muted font-body text-xs mb-6">
                Friendly match • No rating change
              </p>

              <div className="flex gap-3">
                <button
                  onClick={handleRejectMatchRequest}
                  disabled={matchRequestActionLoading}
                  className="flex-1 py-3 font-body font-bold uppercase tracking-widest rounded-lg transition-all active:scale-95"
                  style={{
                    background: 'rgb(20, 12, 30)',
                    border: '2px solid rgba(139,0,255,0.5)',
                    color: 'rgba(255,255,255,0.7)',
                  }}
                >
                  I'll Pass
                </button>
                <button
                  onClick={() => {
                    vibrate();
                    handleAcceptMatchRequest();
                  }}
                  disabled={matchRequestActionLoading}
                  className="flex-1 py-3 font-body font-bold uppercase tracking-widest rounded-lg transition-all active:scale-95"
                  style={{
                    background: 'rgb(15, 10, 25)',
                    border: '2px solid #00FFFF',
                    color: '#00FFFF',
                    boxShadow: '0 0 15px rgba(0,255,255,0.3)',
                  }}
                >
                  {matchRequestActionLoading ? '...' : 'Accept'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

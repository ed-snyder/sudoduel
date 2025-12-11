import { useState, useEffect, useRef, useCallback } from 'react';
import { useHaptics } from '../hooks/useHaptics';
import { useAds } from '../hooks/useAds';
import { useSoundEffects } from '../hooks/useSoundEffects';
import { useMusic } from '../context/MusicContext';
import { matchmakingAPI, friendsAPI, playerAPI } from '../services/api';
import type { HeadToHeadStats } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';
import ReportModal from './ReportModal';
import { reportUser, blockUser } from '../services/socialService';

interface PlayerResult {
  playerId: number;
  displayName?: string;
  score: number;
  cellsCompleted: number;
  mistakes: number;
  timeRemaining: number;
  rating_before: number;
  rating_after: number;
  rating_change: number;
}

interface ResultScreenProps {
  didWin: boolean;
  isDraw: boolean;
  reason: 'PUZZLE_SOLVED' | 'TIMEOUT_SCORE' | 'DRAW' | 'FORFEIT';
  myResult: PlayerResult;
  opponentResult: PlayerResult;
  isRanked?: boolean;
  isBotMatch?: boolean;
  onRematch: () => void;
  onBackToLobby: () => void;
  onFindNewMatch: (matchId: number) => void;
  rematchState: 'idle' | 'requested' | 'waiting';
  rematchCountdown?: number;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  rotation: number;
  velocityX: number;
  velocityY: number;
  type: 'diamond' | 'square' | 'triangle' | 'line';
  color: string;
  delay: number;
}

// Audio context for pitch-shifting sounds
let audioContext: AudioContext | null = null;

const playRatingTick = (isGain: boolean, progress: number) => {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    // Base frequency shifts based on win/loss and progress
    const baseFreq = isGain ? 400 : 300;
    const freqShift = isGain ? progress * 200 : -progress * 100;
    oscillator.frequency.value = baseFreq + freqShift;
    oscillator.type = 'sine';
    
    gainNode.gain.value = 0.08;
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.1);
  } catch (e) {
    // Audio not available
  }
};

const playFinalSound = (isGain: boolean) => {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.frequency.value = isGain ? 800 : 200;
    oscillator.type = isGain ? 'sine' : 'triangle';
    
    gainNode.gain.value = 0.12;
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (e) {
    // Audio not available
  }
};

export default function ResultScreen({
  didWin,
  isDraw,
  reason: _reason,
  myResult,
  opponentResult,
  isRanked = true,
  isBotMatch = false,
  onRematch,
  onBackToLobby,
  onFindNewMatch,
  rematchState,
  rematchCountdown = 0,
}: ResultScreenProps) {
  const { user, token } = useAuth();
  const { isPremium, openUpgradeModal } = useSubscription();
  const { vibrate, victory: hapticVictory, bigWin: hapticBigWin } = useHaptics();
  const { recordGamePlayed, isInGracePeriod } = useAds();
  const { playJoinQueue, playSearching, stopSearching, playMatchFound, playVictory, playDefeat } = useSoundEffects();
  const { playMenuMusic, stopMusic } = useMusic();

  // Restart menu music when results screen appears
  useEffect(() => {
    playMenuMusic();
  }, [playMenuMusic]);

  // Play victory/defeat sound on mount
  const hasPlayedResultSound = useRef(false);
  useEffect(() => {
    if (hasPlayedResultSound.current) return;
    hasPlayedResultSound.current = true;
    
    if (isDraw) {
      // No sound for draw
    } else if (didWin) {
      playVictory();
    } else {
      playDefeat();
    }
  }, [isDraw, didWin, playVictory, playDefeat]);

  // Determine result type for ad logic
  const resultType: 'win' | 'loss' | 'draw' = isDraw ? 'draw' : didWin ? 'win' : 'loss';

  // Show upgrade CTA to free users after grace period on loss/draw
  const showUpgradeCTA = !isPremium && !isInGracePeriod && resultType !== 'win';
  
  const [displayedRating, setDisplayedRating] = useState(myResult.rating_before);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [showFlash, setShowFlash] = useState(true);
  const [showTitle, setShowTitle] = useState(false);
  const [screenShake, setScreenShake] = useState<'none' | 'normal' | 'big'>('none');
  const [ratingLanded, setRatingLanded] = useState(false);
  const [gridHue, setGridHue] = useState(0);
  const [breathePhase, setBreathePhase] = useState(0);
  const [showOpponentModal, setShowOpponentModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const [blockStatus, setBlockStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isFindingMatch, setIsFindingMatch] = useState(false);
  const [searchTime, setSearchTime] = useState(0);
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const attemptsRef = useRef(0);
  const hasTriggeredEffects = useRef(false);
  const ratingAnimationRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ratingAnimationStartedRef = useRef(false);
  const ratingAnimationStepsRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Friend functionality state
  const [h2hStats, setH2hStats] = useState<HeadToHeadStats | null>(null);
  const [h2hLoading, setH2hLoading] = useState(false);
  const [isFriend, setIsFriend] = useState(false);
  const [friendRequestSent, setFriendRequestSent] = useState(false);
  const [friendActionLoading, setFriendActionLoading] = useState(false);
  const [friendError, setFriendError] = useState('');
  
  // Opponent profile state (for rank display)
  const [opponentProfile, setOpponentProfile] = useState<{
    rank: number | null;
    is_premium: boolean;
  } | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // For unranked matches, rating_change is always 0
  const ratingChange = isRanked ? (myResult.rating_change || 0) : 0;
  const opponentName = opponentResult.displayName || 'Opponent';
  const myName = myResult.displayName || user?.display_name || 'Player';
  const isBigWin = didWin && isRanked && ratingChange >= 25;

  // Record game completion for grace period tracking
  useEffect(() => {
    recordGamePlayed(didWin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  // Load head-to-head stats and friend status when modal opens
  useEffect(() => {
    if (showOpponentModal && opponentResult.playerId) {
      loadOpponentData();
      loadOpponentProfile();
    }
  }, [showOpponentModal, opponentResult.playerId]);

  const loadOpponentData = async () => {
    if (!opponentResult.playerId) {
      return;
    }
    
    setH2hLoading(true);
    setFriendError('');
    
    try {
      // Load head-to-head stats
      const h2hResponse = await friendsAPI.getHeadToHeadStats(opponentResult.playerId);
      setH2hStats(h2hResponse.stats);
      
      // Check friend status
      const friendsResponse = await friendsAPI.getFriends();
      const isFriendAlready = friendsResponse.friends.some(f => f.friend_id === opponentResult.playerId);
      setIsFriend(isFriendAlready);
      
      // Check for pending request
      if (!isFriendAlready) {
        const sentRequests = await friendsAPI.getPendingRequestsSent();
        const hasPending = sentRequests.requests.some(r => r.to_player_id === opponentResult.playerId);
        setFriendRequestSent(hasPending);
      }
    } catch (err: any) {
      console.error('[ResultScreen] Failed to load opponent data:', err);
      setH2hStats(null);
    } finally {
      setH2hLoading(false);
    }
  };

  const loadOpponentProfile = async () => {
    if (!opponentResult.playerId) {
      return;
    }
    
    setProfileLoading(true);
    try {
      const profile = await playerAPI.getPlayerProfile(opponentResult.playerId);
      setOpponentProfile({
        rank: profile.rank,
        is_premium: profile.is_premium,
      });
    } catch (error) {
      console.error('[ResultScreen] Failed to load opponent profile:', error);
      setOpponentProfile(null);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleAddFriend = async () => {
    if (!opponentResult.playerId || friendActionLoading) return;
    
    setFriendActionLoading(true);
    setFriendError('');
    vibrate([10, 5, 10]);
    
    try {
      await friendsAPI.sendFriendRequestById(opponentResult.playerId);
      setFriendRequestSent(true);
    } catch (err: any) {
      setFriendError(err.message || 'Failed to send request');
      // If already friends or request already exists, update state
      if (err.message?.includes('already friends')) {
        setIsFriend(true);
      } else if (err.message?.includes('already pending')) {
        setFriendRequestSent(true);
      }
    } finally {
      setFriendActionLoading(false);
    }
  };

  const handleBlock = async () => {
    if (!token || !opponentResult.playerId) return;
    
    setIsBlocking(true);
    setBlockStatus('idle');
    try {
      await blockUser(token, opponentResult.playerId);
      setBlockStatus('success');
    } catch (error: any) {
      setBlockStatus('error');
    } finally {
      setIsBlocking(false);
    }
  };

  // Generate geometric particles
  const generateParticles = useCallback((isVictory: boolean): Particle[] => {
    const count = isVictory ? 45 : 25;
    const newParticles: Particle[] = [];
    const colors = isVictory 
      ? ['#00FFFF', '#7FFFFF', '#FFFFFF', '#FF00FF', '#00FFFF']
      : ['#FF00FF', '#FF7FFF', '#8B00FF', '#FF00FF'];
    const types: Particle['type'][] = ['diamond', 'square', 'triangle', 'line'];
    
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const velocity = isVictory ? 8 + Math.random() * 12 : 2 + Math.random() * 4;
      
      newParticles.push({
        id: i,
        x: 50,
        y: isVictory ? 35 : 0,
        size: 4 + Math.random() * 8,
        rotation: Math.random() * 360,
        velocityX: Math.cos(angle) * velocity * (isVictory ? 1 : 0.3),
        velocityY: isVictory ? Math.sin(angle) * velocity - 5 : Math.random() * 3 + 1,
        type: types[Math.floor(Math.random() * types.length)],
        color: colors[Math.floor(Math.random() * colors.length)],
        delay: Math.random() * 200,
      });
    }
    return newParticles;
  }, []);

  // Initial effects - ALL INSTANT
  useEffect(() => {
    if (hasTriggeredEffects.current) return;
    hasTriggeredEffects.current = true;

    // Flash
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 150);

    // Haptic only (no screen shake on victory)
    if (didWin && !isDraw) {
      if (isBigWin) {
        hapticBigWin();
      } else {
        hapticVictory();
      }
    } else if (!isDraw) {
      vibrate([50, 30, 50]);
      // Only shake on loss
      setScreenShake('normal');
      setTimeout(() => setScreenShake('none'), 300);
    }

    // Title slam-in IMMEDIATE
    setShowTitle(true);

    // Particles IMMEDIATE - only for victory
    if (didWin && !isDraw) {
      setParticles(generateParticles(true));
    } else {
      setParticles([]);
    }
  }, [didWin, isDraw, isBigWin, hapticVictory, hapticBigWin, vibrate, generateParticles]);

  // Grid breathing animation - more dynamic hue shift
  useEffect(() => {
    const interval = setInterval(() => {
      setBreathePhase(prev => (prev + 1) % 360);
      
      // Victory shifts toward cyan (180-200), defeat toward magenta (300-320), draw stays purple (260-280)
      const baseHue = didWin ? 190 : isDraw ? 270 : 310;
      const oscillation = Math.sin(Date.now() / 1500) * 30;
      setGridHue(baseHue + oscillation);
    }, 50);
    
    return () => clearInterval(interval);
  }, [didWin, isDraw]);

  // Rating slot machine roll with haptics and sound
  useEffect(() => {
    // Prevent multiple runs
    if (ratingAnimationStartedRef.current) {
      return;
    }

    const startRating = myResult.rating_before;
    const endRating = myResult.rating_after;
    const diff = endRating - startRating;
    
    if (diff === 0) {
      setDisplayedRating(endRating || startRating || 1500);
      setRatingLanded(true);
      return;
    }
    
    // Ensure we have valid ratings
    if (!startRating || !endRating || isNaN(startRating) || isNaN(endRating)) {
      setDisplayedRating(endRating || startRating || 1500);
      setRatingLanded(true);
      return;
    }

    // Mark as started to prevent re-runs
    ratingAnimationStartedRef.current = true;

    // Wait for slam animation to complete (0.8s)
    ratingAnimationRef.current = setTimeout(() => {
      
      const steps = Math.max(30, Math.min(Math.abs(diff), 50));
      let currentStep = 0;

      const animate = () => {
        currentStep++;
        const progress = currentStep / steps;
        
        // Accelerating curve: starts slow, speeds up
        const acceleratingProgress = Math.pow(progress, 0.7);
        const newRating = Math.round(startRating + diff * acceleratingProgress);
        
        setDisplayedRating(newRating);
        
        // Variable timing: starts slow (80ms), speeds up to fast (30ms)
        const baseInterval = 80;
        const minInterval = 30;
        const currentInterval = Math.max(minInterval, baseInterval - (progress * 50));
        
        // Increasing feedback frequency: starts sparse, becomes frequent
        const feedbackFrequency = Math.max(1, Math.floor(5 - (progress * 4)));
        if (currentStep % feedbackFrequency === 0) {
          // Haptic tick - stronger as it progresses
          const hapticStrength = Math.min(10, 5 + (progress * 5));
          vibrate([hapticStrength]);
          
          // Sound tick
          playRatingTick(diff > 0, progress);
        }
        
        console.log(`🎰 Step ${currentStep}/${steps}: ${newRating} (progress: ${(progress * 100).toFixed(1)}%)`);
        
        if (currentStep >= steps) {
          console.log('🎰 Animation complete!');
          setDisplayedRating(endRating);
          setRatingLanded(true);
          vibrate([30, 15, 30]);
          playFinalSound(diff > 0);
          ratingAnimationStepsRef.current = null;
        } else {
          // Schedule next step with variable timing
          ratingAnimationStepsRef.current = setTimeout(animate, currentInterval);
        }
      };

      // Start animation
      animate();
    }, 800);

    return () => {
      if (ratingAnimationRef.current) {
        clearTimeout(ratingAnimationRef.current);
        ratingAnimationRef.current = null;
      }
      if (ratingAnimationStepsRef.current) {
        clearTimeout(ratingAnimationStepsRef.current);
        ratingAnimationStepsRef.current = null;
      }
      // Note: Don't reset ratingAnimationStartedRef here - we want it to stay true
      // so the animation doesn't restart if component re-renders
    };
  }, [myResult.rating_before, myResult.rating_after]);

  // Search timer when finding new match
  useEffect(() => {
    if (!isFindingMatch) {
      setSearchTime(0);
      return;
    }
    
    const interval = setInterval(() => {
      setSearchTime(prev => prev + 1);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isFindingMatch]);

  // Matchmaking functions
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearTimeout(pollingRef.current);
      pollingRef.current = null;
    }
    attemptsRef.current = 0;
  }, []);

  const pollForMatch = useCallback(() => {
    pollingRef.current = setTimeout(async () => {
      attemptsRef.current++;
      
      if (attemptsRef.current >= 30) {
        try {
          await matchmakingAPI.leave();
        } catch (e) {}
        setIsFindingMatch(false);
        stopPolling();
        return;
      }

      try {
        const response = await matchmakingAPI.status() as { status: string; match_id?: number };
        
        if (response.status === 'matched') {
          stopPolling();
          onFindNewMatch(response.match_id!);
        } else if (response.status === 'queued') {
          pollForMatch();
        } else {
          setIsFindingMatch(false);
          stopPolling();
        }
      } catch (err) {
        setIsFindingMatch(false);
        stopPolling();
      }
    }, 1000);
  }, [onFindNewMatch, stopPolling]);

  const handleBackToLobby = () => {
    handleButtonPress();
    onBackToLobby();
  };

  const handleFindNewMatch = async () => {
    handleButtonPress();
    playJoinQueue();
    setIsFindingMatch(true);
    setSearchTime(0);
    
    try {
      // Dynamic import to avoid circular dependencies
      const { matchmakingAPI } = await import('../services/api');
      
      // First, make sure we've left any existing queue
      try {
        await matchmakingAPI.leave();
      } catch (e) {
        // Ignore errors from leaving - we might not be in a queue
      }
      
      // Join the matchmaking queue
      const result = await matchmakingAPI.join() as { status: string; match_id?: number };
      console.log('[ResultScreen] Join result:', result);
      
      if (result.status === 'matched' && result.match_id) {
        // Instant match found
        stopMusic();        // Stop lobby music first
        playMatchFound();
        console.log('[ResultScreen] Instant match found:', result.match_id);
        onFindNewMatch(result.match_id);
        setIsFindingMatch(false);
        return;
      }
      
      if (result.status === 'queued') {
        playSearching();
        // Poll for match status
        pollIntervalRef.current = setInterval(async () => {
          try {
            const status = await matchmakingAPI.status() as { status: string; match_id?: number };
            
            if (status.status === 'matched' && status.match_id) {
              stopMusic();      // Stop lobby music first
              playMatchFound();
              if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
              }
              setIsFindingMatch(false);
              onFindNewMatch(status.match_id);
            } else if (status.status !== 'queued') {
              // No longer queued and not matched - something went wrong
              stopSearching();
              if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
              }
              setIsFindingMatch(false);
            }
          } catch (err) {
            console.error('[ResultScreen] Polling error:', err);
          }
        }, 1000);
      }
    } catch (error) {
      console.error('[ResultScreen] Failed to find match:', error);
      setIsFindingMatch(false);
    }
  };

  const handleCancelSearch = async () => {
    handleButtonPress();
    stopSearching();
    
    // Clear polling interval first
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    
    setIsFindingMatch(false);
    
    try {
      const { matchmakingAPI } = await import('../services/api');
      await matchmakingAPI.leave();
    } catch (error) {
      console.error('[ResultScreen] Failed to cancel search:', error);
    }
  };

  // Cleanup polling and sounds on unmount
  useEffect(() => {
    return () => {
      stopSearching();
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [stopSearching]);

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Colors based on win/loss
  const fillColor = didWin ? '#00FFFF' : '#FF00FF';
  const fillColorLight = didWin ? '#7FFFFF' : '#FF7FFF';
  const fillColorDark = didWin ? '#00B3B3' : '#B300B3';
  const glowColor = didWin ? '#FF00FF' : '#00FFFF';

  const breatheOpacity = 0.15 + Math.sin(breathePhase * Math.PI / 180) * 0.05;

  const handleButtonPress = () => {
    vibrate([10]);
  };

  return (
    <div 
      className={`fixed inset-0 bg-void flex flex-col z-50 overflow-hidden ${
        screenShake === 'big' ? 'animate-shake-big' : screenShake === 'normal' ? 'animate-shake' : ''
      }`}
    >
      {/* Flash overlay */}
      {showFlash && (
        <div 
          className="absolute inset-0 z-40 pointer-events-none"
          style={{
            background: didWin 
              ? 'radial-gradient(circle, rgba(0,255,255,0.6) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(255,0,255,0.4) 0%, transparent 70%)',
          }}
        />
      )}

      {/* Drifting gradient blobs - intensity based on result */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Cyan blob - stronger on victory */}
        <div 
          className="absolute w-[550px] h-[550px] animate-drift-1"
          style={{
            background: didWin 
              ? 'radial-gradient(circle, rgba(0,255,255,0.22) 0%, rgba(0,255,255,0.08) 40%, transparent 70%)'
              : 'radial-gradient(circle, rgba(0,255,255,0.08) 0%, rgba(0,255,255,0.02) 40%, transparent 70%)',
            filter: 'blur(50px)',
            top: '-5%',
            left: '-10%',
          }}
        />
        
        {/* Magenta blob - stronger on defeat */}
        <div 
          className="absolute w-[500px] h-[500px] animate-drift-2"
          style={{
            background: !didWin && !isDraw
              ? 'radial-gradient(circle, rgba(255,0,255,0.22) 0%, rgba(255,0,255,0.08) 40%, transparent 70%)'
              : 'radial-gradient(circle, rgba(255,0,255,0.08) 0%, rgba(255,0,255,0.02) 40%, transparent 70%)',
            filter: 'blur(55px)',
            top: '25%',
            right: '-15%',
          }}
        />
        
        {/* Purple accent blob */}
        <div 
          className="absolute w-[400px] h-[400px] animate-drift-3"
          style={{
            background: 'radial-gradient(circle, rgba(139,0,255,0.12) 0%, rgba(139,0,255,0.04) 40%, transparent 70%)',
            filter: 'blur(45px)',
            bottom: '5%',
            left: '15%',
          }}
        />
      </div>

      {/* Animated grid - color shifts with breathePhase */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(hsla(${gridHue}, 80%, 50%, ${breatheOpacity}) 1px, transparent 1px),
            linear-gradient(90deg, hsla(${gridHue}, 80%, 50%, ${breatheOpacity}) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
      />

      {/* Secondary offset grid for depth */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(hsla(${(gridHue + 30) % 360}, 70%, 50%, ${breatheOpacity * 0.35}) 1px, transparent 1px),
            linear-gradient(90deg, hsla(${(gridHue + 30) % 360}, 70%, 50%, ${breatheOpacity * 0.35}) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
          transform: 'translate(25px, 25px)',
        }}
      />

      {/* Geometric Particles - Victory only */}
      {particles.length > 0 && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
          {particles.map((particle) => (
          <div
            key={particle.id}
            className="animate-particle-burst"
            style={{
              position: 'absolute',
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              '--vx': particle.velocityX,
              '--vy': particle.velocityY,
              '--rotation': `${particle.rotation}deg`,
              '--size': `${particle.size}px`,
              '--delay': `${particle.delay}ms`,
              animationDelay: `${particle.delay}ms`,
            } as React.CSSProperties}
          >
            {particle.type === 'diamond' && (
              <div 
                style={{
                  width: particle.size,
                  height: particle.size,
                  background: particle.color,
                  transform: 'rotate(45deg)',
                  boxShadow: `0 0 ${particle.size}px ${particle.color}`,
                }}
              />
            )}
            {particle.type === 'square' && (
              <div 
                style={{
                  width: particle.size,
                  height: particle.size,
                  background: particle.color,
                  boxShadow: `0 0 ${particle.size}px ${particle.color}`,
                }}
              />
            )}
            {particle.type === 'triangle' && (
              <div 
                style={{
                  width: 0,
                  height: 0,
                  borderLeft: `${particle.size / 2}px solid transparent`,
                  borderRight: `${particle.size / 2}px solid transparent`,
                  borderBottom: `${particle.size}px solid ${particle.color}`,
                  filter: `drop-shadow(0 0 ${particle.size / 2}px ${particle.color})`,
                }}
              />
            )}
            {particle.type === 'line' && (
              <div 
                style={{
                  width: particle.size * 2,
                  height: 2,
                  background: particle.color,
                  boxShadow: `0 0 ${particle.size}px ${particle.color}`,
                }}
              />
            )}
          </div>
        ))}
        </div>
      )}


      {/* Back Button */}
      <div className="relative z-50 pt-14 pl-4 safe-top">
        <button
          onClick={handleBackToLobby}
          className="flex items-center gap-2 text-secondary hover:text-player transition-colors group"
        >
          <svg 
            className="w-5 h-5 group-hover:scale-110 transition-transform" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          <span className="font-body font-medium text-sm uppercase tracking-wider">Lobby</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-10 -mt-8 relative z-30">
        {/* Result Title - Logo style with shimmer and float */}
        <div 
          className={`relative mb-6 ${showTitle ? 'animate-slam-in' : 'opacity-0 scale-150'}`}
          {...(showTitle && { style: { animation: 'slam-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards, float 4s ease-in-out 0.5s infinite' } })}
        >
          {/* Outer glow layer */}
          <span
            className="absolute inset-0 text-6xl sm:text-7xl select-none pointer-events-none"
            style={{
              fontFamily: "'Industry', 'Orbitron', sans-serif",
              fontWeight: 900,
              fontStyle: 'italic',
              letterSpacing: '-0.02em',
              color: 'transparent',
              WebkitTextStroke: `8px ${glowColor}`,
              filter: 'blur(12px)',
              opacity: 0.5,
            }}
            aria-hidden="true"
          >
            {isDraw ? 'DRAW' : didWin ? 'VICTORY' : 'DEFEAT'}
          </span>

          {/* Inner glow layer */}
          <span
            className="absolute inset-0 text-6xl sm:text-7xl select-none pointer-events-none"
            style={{
              fontFamily: "'Industry', 'Orbitron', sans-serif",
              fontWeight: 900,
              fontStyle: 'italic',
              letterSpacing: '-0.02em',
              color: 'transparent',
              WebkitTextStroke: `5px ${glowColor}`,
              filter: 'blur(4px)',
              opacity: 0.7,
            }}
            aria-hidden="true"
          >
            {isDraw ? 'DRAW' : didWin ? 'VICTORY' : 'DEFEAT'}
          </span>

          {/* White stroke layer */}
          <span
            className="absolute inset-0 text-6xl sm:text-7xl select-none pointer-events-none"
            style={{
              fontFamily: "'Industry', 'Orbitron', sans-serif",
              fontWeight: 900,
              fontStyle: 'italic',
              letterSpacing: '-0.02em',
              color: 'transparent',
              WebkitTextStroke: '3px rgba(255,255,255,0.9)',
            }}
            aria-hidden="true"
          >
            {isDraw ? 'DRAW' : didWin ? 'VICTORY' : 'DEFEAT'}
          </span>

          {/* Fill gradient - main visible text */}
          <span
            className="relative text-6xl sm:text-7xl select-none"
            style={{
              fontFamily: "'Industry', 'Orbitron', sans-serif",
              fontWeight: 900,
              fontStyle: 'italic',
              letterSpacing: '-0.02em',
              background: isDraw 
                ? 'linear-gradient(180deg, #FFFFFF 0%, #B8B8B8 50%, #888888 100%)'
                : `linear-gradient(180deg, ${fillColorLight} 0%, ${fillColor} 50%, ${fillColorDark} 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {isDraw ? 'DRAW' : didWin ? 'VICTORY' : 'DEFEAT'}
          </span>

          {/* Shimmer overlay - animating gradient */}
          <span
            className="absolute inset-0 text-6xl sm:text-7xl select-none pointer-events-none"
            style={{
              fontFamily: "'Industry', 'Orbitron', sans-serif",
              fontWeight: 900,
              fontStyle: 'italic',
              letterSpacing: '-0.02em',
              background: `linear-gradient(
                120deg, 
                transparent 0%, 
                transparent 30%, 
                rgba(255,255,255,0.4) 50%, 
                transparent 70%, 
                transparent 100%
              )`,
              backgroundSize: '200% 100%',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              animation: 'logo-shimmer 3s ease-in-out infinite',
            }}
            aria-hidden="true"
          >
            {isDraw ? 'DRAW' : didWin ? 'VICTORY' : 'DEFEAT'}
          </span>
        </div>

        {/* Bot match message - shown for first-time players after beating the tutorial bot */}
        {isBotMatch && didWin && (
          <div className="text-center mb-4" style={{ position: 'relative', zIndex: 40 }}>
            <p className="text-secondary text-base font-body">
              Great job! You&apos;re ready for real opponents. 🎮
            </p>
          </div>
        )}

        {/* Score comparison with equal-sized name boxes */}
        <div className="flex items-center justify-center gap-4 mb-6" style={{ position: 'relative', zIndex: 40 }}>
          {/* DEBUG: Score boxes should show full names */}
          {/* Your score box */}
          <div 
            className="flex flex-col items-center justify-center rounded-lg"
            style={{
              background: 'rgba(0,255,255,0.08)',
              border: '2px solid rgba(0,255,255,0.4)',
              boxShadow: '0 0 15px rgba(0,255,255,0.15), inset 0 0 20px rgba(0,255,255,0.05)',
              width: '140px',
              height: '140px',
              padding: '12px 8px',
            }}
          >
            <span 
              className="font-body uppercase tracking-wider mb-2 text-center w-full break-words leading-tight"
              style={{ 
                color: 'rgba(0,255,255,0.9)',
                fontSize: myName.length > 12 ? '9px' : myName.length > 8 ? '10px' : '11px',
              }}
              title={myName}
            >
              {myName}
            </span>
            <span 
              className="text-5xl font-mono font-bold text-player"
              style={{ textShadow: '0 0 20px rgba(0,255,255,0.5)' }}
            >
              {myResult.cellsCompleted}
            </span>
          </div>
          
          <span 
            className="text-2xl font-heading font-bold text-primary"
            style={{ textShadow: '0 0 10px rgba(139,0,255,0.4)' }}
          >
            —
          </span>
          
          {/* Opponent score box - clickable */}
          <button
            onClick={() => setShowOpponentModal(true)}
            className="flex flex-col items-center justify-center rounded-lg transition-all hover:scale-105 active:scale-95"
            style={{
              background: 'rgba(255,0,255,0.08)',
              border: '2px solid rgba(255,0,255,0.4)',
              boxShadow: '0 0 15px rgba(255,0,255,0.15), inset 0 0 20px rgba(255,0,255,0.05)',
              width: '140px',
              height: '140px',
              padding: '12px 8px',
            }}
          >
            <span 
              className="font-body uppercase tracking-wider mb-2 text-center w-full break-words leading-tight"
              style={{ 
                color: 'rgba(255,0,255,0.9)',
                fontSize: opponentName.length > 12 ? '9px' : opponentName.length > 8 ? '10px' : '11px',
              }}
              title={opponentName}
            >
              {opponentName}
            </span>
            <span 
              className="text-5xl font-mono font-bold text-opponent"
              style={{ textShadow: '0 0 20px rgba(255,0,255,0.5)' }}
            >
              {opponentResult.cellsCompleted}
            </span>
            <span className="text-[10px] font-body text-muted mt-1 opacity-60">
              tap for stats
            </span>
          </button>
        </div>

        {/* Stats row */}
        <div className="flex gap-8 mb-6 text-center">
          <div>
            <span className="text-xs font-body uppercase tracking-widest block mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Time Left
            </span>
            <span className="text-xl font-mono font-semibold text-primary" style={{ textShadow: '0 0 8px rgba(139,0,255,0.3)' }}>
              {formatTime(myResult.timeRemaining)}
            </span>
          </div>
          <div>
            <span className="text-xs font-body uppercase tracking-widest block mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Mistakes
            </span>
            <span className="text-xl font-mono font-semibold text-primary" style={{ textShadow: '0 0 8px rgba(139,0,255,0.3)' }}>
              {myResult.mistakes}
            </span>
          </div>
        </div>

        {/* Rating - Slot machine style */}
        <div 
          className={`rounded-xl px-10 py-4 mb-8 transition-all duration-300 ${ratingLanded ? 'animate-rating-land' : ''}`}
          style={{
            background: 'rgba(30,15,45,0.6)',
            border: isRanked 
              ? `2px solid ${ratingChange > 0 
                  ? 'rgba(0,255,136,0.5)' 
                  : ratingChange < 0 
                  ? 'rgba(255,51,102,0.5)' 
                  : 'rgba(139,0,255,0.3)'}`
              : '2px solid rgba(139,0,255,0.3)',
            boxShadow: isRanked && ratingChange > 0 
              ? '0 0 25px rgba(0,255,136,0.2), inset 0 0 20px rgba(0,255,136,0.05)' 
              : isRanked && ratingChange < 0 
              ? '0 0 25px rgba(255,51,102,0.2), inset 0 0 20px rgba(255,51,102,0.05)' 
              : '0 0 15px rgba(139,0,255,0.15)',
          }}
        >
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center justify-center gap-4">
              <span 
                className="text-4xl font-mono font-bold tabular-nums"
                style={{ 
                  color: '#FFFFFF',
                  textShadow: '0 0 15px rgba(255,255,255,0.3)',
                }}
              >
                {Math.round(displayedRating || myResult.rating_after || myResult.rating_before || 1500)}
              </span>
              {isRanked && ratingChange !== 0 && (
                <span 
                  className="text-2xl font-mono font-bold tabular-nums"
                  style={{
                    color: ratingChange > 0 ? '#00FF88' : '#FF3366',
                    textShadow: ratingChange > 0 
                      ? '0 0 12px rgba(0,255,136,0.6)' 
                      : '0 0 12px rgba(255,51,102,0.6)',
                  }}
                >
                  {ratingChange > 0 ? '+' : ''}{Math.round(ratingChange)}
                </span>
              )}
            </div>
            {!isRanked && (
              <span 
                className="text-xs font-body uppercase tracking-widest text-secondary"
                style={{ textShadow: '0 0 8px rgba(139,0,255,0.4)' }}
              >
                Friendly Match • No Rating Change
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="w-full max-w-xs space-y-3">
          {isFindingMatch ? (
            /* Finding Match State - replaces buttons */
            <div className="flex flex-col items-center">
              {/* Searching spinner */}
              <div 
                className="w-16 h-16 mb-4 rounded-full animate-spin"
                style={{
                  border: '3px solid rgba(0,255,255,0.2)',
                  borderTopColor: '#00FFFF',
                  boxShadow: '0 0 20px rgba(0,255,255,0.3)',
                }}
              />
              
              {/* Searching text */}
              <p 
                className="font-heading font-bold text-lg text-player mb-2 uppercase tracking-widest"
                style={{ textShadow: '0 0 15px rgba(0,255,255,0.5)' }}
              >
                Finding Match
              </p>
              
              {/* Timer */}
              <p 
                className="font-mono text-2xl text-primary mb-6"
                style={{ textShadow: '0 0 10px rgba(0,255,255,0.3)' }}
              >
                {Math.floor(searchTime / 60)}:{(searchTime % 60).toString().padStart(2, '0')}
              </p>
              
              {/* Cancel button */}
              <button
                onClick={handleCancelSearch}
                className="w-full py-3 font-body font-semibold uppercase tracking-wider rounded-xl transition-all active:scale-95"
                style={{
                  background: 'rgb(20, 12, 30)',
                  border: '3px solid rgba(255,51,102,0.5)',
                  color: '#FF3366',
                  boxShadow: '0 0 10px rgba(255,51,102,0.2), 0 4px 12px rgba(0,0,0,0.5)',
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            /* Normal button state */
            <>
              {/* Rematch - hidden for bot matches since you can only play the bot once */}
              {!isBotMatch && (
                <button
                  onClick={() => { 
                    handleButtonPress(); 
                    if (rematchState === 'idle' || rematchState === 'waiting') {
                      onRematch(); 
                    }
                  }}
                  disabled={rematchState === 'requested'}
                  className={`w-full py-4 text-lg font-body font-bold uppercase tracking-widest rounded-xl transition-all active:scale-95 ${
                    rematchState === 'waiting' ? '' : rematchState === 'requested' ? 'cursor-not-allowed' : 'animate-button-glow'
                  }`}
                  style={
                    rematchState === 'waiting'
                      ? {
                          background: 'rgb(15, 10, 25)',
                          border: '3px solid #00FF88',
                          color: '#00FF88',
                          boxShadow: '0 0 20px rgba(0,255,136,0.4), 0 4px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
                          animation: 'pulse 1s ease-in-out infinite',
                        }
                      : rematchState === 'requested'
                      ? {
                          background: 'rgb(20, 12, 30)',
                          border: '3px solid rgba(139,0,255,0.3)',
                          color: 'rgba(255,255,255,0.4)',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                        }
                      : {
                          background: 'rgb(15, 10, 25)',
                          border: '3px solid #00FFFF',
                          color: '#00FFFF',
                          boxShadow: '0 0 15px rgba(0,255,255,0.3), 0 4px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
                        }
                  }
                >
                  {rematchState === 'idle' && 'Rematch'}
                  {rematchState === 'requested' && `Waiting... ${rematchCountdown}s`}
                  {rematchState === 'waiting' && '⚔️ Accept Rematch'}
                </button>
              )}

              {/* Find New Match - stays on result screen and starts matchmaking */}
              <button
                onClick={handleFindNewMatch}
                className="w-full py-4 text-lg font-body font-semibold uppercase tracking-wider rounded-xl transition-all active:scale-95"
                style={{
                  background: 'rgb(20, 12, 30)',
                  border: '3px solid rgba(139,0,255,0.5)',
                  color: 'rgba(255,255,255,0.8)',
                  boxShadow: '0 0 10px rgba(139,0,255,0.2), 0 4px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
                }}
              >
                Find New Match
              </button>

              {/* Upgrade CTA - Show to free users after grace period on loss/draw */}
              {showUpgradeCTA && (
                <div className="mt-6 pt-6 border-t border-grid-line/30">
                  <button
                    onClick={() => {
                      handleButtonPress();
                      openUpgradeModal();
                    }}
                    className="w-full py-4 px-6 rounded-xl font-display font-bold text-base uppercase tracking-wider transition-all active:scale-95"
                    style={{
                      background: 'linear-gradient(135deg, rgba(255,215,0,0.2) 0%, rgba(255,165,0,0.2) 100%)',
                      border: '2px solid rgba(255,215,0,0.6)',
                      color: '#FFD700',
                      boxShadow: '0 0 20px rgba(255,215,0,0.2)',
                    }}
                  >
                    <div className="flex items-center justify-center gap-3">
                      <span className="text-xl">👑</span>
                      <span>Remove Ads with Sudoduel+</span>
                    </div>
                  </button>
                  <p className="text-center text-muted text-xs mt-2 font-body">
                    Plus unlock premium stats, custom emotes & more
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Opponent Stats Modal */}
      {showOpponentModal && (
        <div 
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          onClick={() => setShowOpponentModal(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-void/90 backdrop-blur-sm" />
          
          {/* Modal */}
          <div 
            className="relative bg-surface border-2 border-opponent/50 rounded-xl p-6 max-w-sm w-full animate-scale-in"
            style={{
              boxShadow: '0 0 30px rgba(255,0,255,0.2), 0 10px 40px rgba(0,0,0,0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setShowOpponentModal(false)}
              className="absolute top-4 right-4 text-muted hover:text-opponent transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Opponent Info */}
            <div className="flex flex-col items-center">
              {/* Avatar */}
              <div 
                className="w-20 h-20 rounded-full flex items-center justify-center text-3xl mb-4"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,0,255,0.3) 0%, rgba(139,0,255,0.3) 100%)',
                  border: '3px solid rgba(255,0,255,0.5)',
                  boxShadow: '0 0 20px rgba(255,0,255,0.3)',
                }}
              >
                {opponentName.charAt(0).toUpperCase()}
              </div>

              {/* Name */}
              <h3 
                className="font-heading font-bold text-xl text-opponent mb-1 text-center"
                style={{ textShadow: '0 0 10px rgba(255,0,255,0.4)' }}
              >
                {opponentName}
              </h3>

              {/* Rating and Rank */}
              <div className="flex items-center gap-2 mb-6 flex-wrap justify-center">
                <span className="text-muted text-sm font-body">Rating:</span>
                <span 
                  className="font-mono font-bold text-lg text-primary"
                  style={{ textShadow: '0 0 8px rgba(139,0,255,0.3)' }}
                >
                  {Math.round(opponentResult.rating_after || opponentResult.rating_before || 0) || '—'}
                </span>
                
                {/* Show rank if opponent is premium and we have it */}
                {profileLoading ? (
                  <span className="text-muted text-sm">•  Loading...</span>
                ) : opponentProfile?.is_premium && opponentProfile?.rank ? (
                  <>
                    <span className="text-muted text-sm">•</span>
                    <span className="text-muted text-sm font-body">Rank:</span>
                    <span 
                      className="font-mono font-bold text-primary"
                      style={{ textShadow: '0 0 8px rgba(139,0,255,0.3)' }}
                    >
                      #{opponentProfile.rank.toLocaleString()}
                    </span>
                  </>
                ) : null}
              </div>

              {/* Head to Head Stats */}
              <div 
                className="w-full rounded-lg p-4"
                style={{
                  background: 'rgba(30,15,45,0.6)',
                  border: '1px solid rgba(139,0,255,0.3)',
                }}
              >
                <p className="text-xs text-muted font-body uppercase tracking-widest text-center mb-3">
                  Match History
                </p>
                
                {h2hLoading ? (
                  <div className="flex justify-center py-2">
                    <div className="w-6 h-6 border-2 border-player border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : h2hStats ? (
                  <div className="flex justify-around">
                    <div className="text-center">
                      <span 
                        className="block text-2xl font-mono font-bold text-player"
                        style={{ textShadow: '0 0 10px rgba(0,255,255,0.4)' }}
                      >
                        {h2hStats.wins}
                      </span>
                      <span className="text-xs text-muted font-body uppercase">Wins</span>
                    </div>
                    
                    <div className="w-px" style={{ background: 'rgba(139,0,255,0.3)' }} />
                    
                    <div className="text-center">
                      <span 
                        className="block text-2xl font-mono font-bold text-opponent"
                        style={{ textShadow: '0 0 10px rgba(255,0,255,0.4)' }}
                      >
                        {h2hStats.losses}
                      </span>
                      <span className="text-xs text-muted font-body uppercase">Losses</span>
                    </div>
                    
                    <div className="w-px" style={{ background: 'rgba(139,0,255,0.3)' }} />
                    
                    <div className="text-center">
                      <span 
                        className="block text-2xl font-mono font-bold text-secondary"
                        style={{ textShadow: '0 0 10px rgba(139,0,255,0.3)' }}
                      >
                        {h2hStats.draws}
                      </span>
                      <span className="text-xs text-muted font-body uppercase">Draws</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-around">
                    <div className="text-center">
                      <span className="block text-2xl font-mono font-bold text-player" style={{ textShadow: '0 0 10px rgba(0,255,255,0.4)' }}>0</span>
                      <span className="text-xs text-muted font-body uppercase">Wins</span>
                    </div>
                    <div className="w-px" style={{ background: 'rgba(139,0,255,0.3)' }} />
                    <div className="text-center">
                      <span className="block text-2xl font-mono font-bold text-opponent" style={{ textShadow: '0 0 10px rgba(255,0,255,0.4)' }}>0</span>
                      <span className="text-xs text-muted font-body uppercase">Losses</span>
                    </div>
                    <div className="w-px" style={{ background: 'rgba(139,0,255,0.3)' }} />
                    <div className="text-center">
                      <span className="block text-2xl font-mono font-bold text-secondary" style={{ textShadow: '0 0 10px rgba(139,0,255,0.3)' }}>0</span>
                      <span className="text-xs text-muted font-body uppercase">Draws</span>
                    </div>
                  </div>
                )}

                {h2hStats && h2hStats.total_matches > 0 && (
                  <p className="text-xs text-muted text-center mt-3 opacity-60">
                    {h2hStats.total_matches} total matches
                  </p>
                )}
              </div>

              {/* Friend Error */}
              {friendError && (
                <p className="text-xs text-error text-center mt-3">{friendError}</p>
              )}

              {/* Add Friend Button */}
              <button
                onClick={handleAddFriend}
                disabled={friendActionLoading || isFriend || friendRequestSent}
                className="w-full mt-4 py-3 font-body font-bold uppercase tracking-widest rounded-lg transition-all active:scale-95 disabled:opacity-60"
                style={{
                  background: isFriend 
                    ? 'rgba(0,255,136,0.1)'
                    : friendRequestSent 
                      ? 'rgba(255,184,0,0.1)'
                      : 'rgb(20, 12, 30)',
                  border: isFriend 
                    ? '2px solid rgba(0,255,136,0.5)'
                    : friendRequestSent
                      ? '2px solid rgba(255,184,0,0.5)'
                      : '2px solid rgba(255,0,255,0.5)',
                  color: isFriend 
                    ? '#00FF88'
                    : friendRequestSent
                      ? '#FFB800'
                      : '#FF00FF',
                  boxShadow: isFriend 
                    ? '0 0 15px rgba(0,255,136,0.2)'
                    : friendRequestSent
                      ? '0 0 15px rgba(255,184,0,0.2)'
                      : '0 0 15px rgba(255,0,255,0.2)',
                }}
              >
                {friendActionLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Sending...
                  </span>
                ) : isFriend ? (
                  '✓ Friends'
                ) : friendRequestSent ? (
                  '📤 Request Sent'
                ) : (
                  'Add Friend'
                )}
              </button>

              {/* Block and Report Buttons */}
              <div className="flex gap-2" style={{ marginTop: '5px' }}>
                {/* Block Button */}
                <button
                  onClick={handleBlock}
                  disabled={isBlocking || blockStatus === 'success'}
                  className="flex-1 py-3 px-4 rounded-xl font-body font-semibold text-base transition-all touch-manipulation disabled:opacity-50"
                  style={{
                    background: blockStatus === 'success' ? 'rgba(255, 184, 0, 0.3)' : 'rgba(255, 184, 0, 0.15)',
                    border: '2px solid rgba(255, 184, 0, 0.5)',
                    color: '#FFB800',
                  }}
                >
                  {blockStatus === 'success' ? '✓ Blocked' : isBlocking ? 'Blocking...' : 'Block'}
                </button>
                
                {/* Report Button */}
                <button
                  onClick={() => {
                    setShowOpponentModal(false);
                    setShowReportModal(true);
                  }}
                  className="flex-1 py-3 px-4 rounded-xl font-body font-semibold text-base transition-all touch-manipulation"
                  style={{
                    background: 'rgba(255, 51, 102, 0.15)',
                    border: '2px solid rgba(255, 51, 102, 0.5)',
                    color: '#FF3366',
                  }}
                >
                  Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {token && (
        <ReportModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          playerName={opponentName}
          playerId={opponentResult.playerId}
        onSubmitReport={async (playerId: number, reason: string) => {
          if (!token) throw new Error('Not authenticated');
          await reportUser(token, playerId, reason);
        }}
        />
      )}
    </div>
  );
}

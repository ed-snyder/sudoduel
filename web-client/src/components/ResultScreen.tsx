import { useState, useEffect, useRef, useCallback } from 'react';
import { useHaptics } from '../hooks/useHaptics';
import { matchmakingAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

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
  reason,
  myResult,
  opponentResult,
  onRematch,
  onBackToLobby,
  onFindNewMatch,
  rematchState,
  rematchCountdown = 0,
}: ResultScreenProps) {
  const { user } = useAuth();
  const { vibrate, victory: hapticVictory, bigWin: hapticBigWin } = useHaptics();
  
  const [displayedRating, setDisplayedRating] = useState(myResult.rating_before);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [showFlash, setShowFlash] = useState(true);
  const [showTitle, setShowTitle] = useState(false);
  const [screenShake, setScreenShake] = useState<'none' | 'normal' | 'big'>('none');
  const [ratingLanded, setRatingLanded] = useState(false);
  const [gridHue, setGridHue] = useState(0);
  const [breathePhase, setBreathePhase] = useState(0);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptsRef = useRef(0);
  const hasTriggeredEffects = useRef(false);
  const ratingAnimationRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ratingAnimationStartedRef = useRef(false);
  const ratingAnimationStepsRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ratingChange = myResult.rating_change || 0;
  const opponentName = opponentResult.displayName || 'Opponent';
  const myDisplayName = myResult.displayName || user?.display_name || 'You';
  const isBigWin = didWin && ratingChange >= 25;

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

    // Haptic + shake IMMEDIATELY
    if (didWin && !isDraw) {
      if (isBigWin) {
        hapticBigWin();
        setScreenShake('big');
      } else {
        hapticVictory();
        setScreenShake('normal');
      }
    } else if (!isDraw) {
      vibrate([50, 30, 50]);
    }

    // Clear shake
    setTimeout(() => setScreenShake('none'), isBigWin ? 500 : 300);

    // Title slam-in IMMEDIATE
    setShowTitle(true);

    // Particles IMMEDIATE - only for victory
    if (didWin && !isDraw) {
      setParticles(generateParticles(true));
    } else {
      setParticles([]);
    }
  }, [didWin, isDraw, isBigWin, hapticVictory, hapticBigWin, vibrate, generateParticles]);

  // Grid breathing animation
  useEffect(() => {
    const interval = setInterval(() => {
      setBreathePhase(prev => (prev + 1) % 360);
      
      // Hue shifts: victory goes cyan (180), defeat goes magenta (300)
      const targetHue = didWin ? 180 : isDraw ? 270 : 300;
      const oscillation = Math.sin(Date.now() / 2000) * 15;
      setGridHue(targetHue + oscillation);
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
    
    console.log('🎰 Rating animation triggered:', {
      startRating,
      endRating,
      diff,
      rating_before: myResult.rating_before,
      rating_after: myResult.rating_after
    });
    
    if (diff === 0) {
      console.log('🎰 No rating change, skipping animation');
      setDisplayedRating(endRating);
      setRatingLanded(true);
      return;
    }

    // Mark as started to prevent re-runs
    ratingAnimationStartedRef.current = true;

    // Wait for slam animation to complete (0.8s)
    console.log('🎰 Starting rating animation in 800ms...');
    
    ratingAnimationRef.current = setTimeout(() => {
      console.log('🎰 Rating animation starting now!');
      
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
        setSearching(false);
        setSearchError('No opponent found. Try again!');
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
          setSearching(false);
          stopPolling();
        }
      } catch (err) {
        setSearching(false);
        stopPolling();
      }
    }, 1000);
  }, [onFindNewMatch, stopPolling]);

  const handleFindNewMatch = useCallback(async () => {
    setSearchError('');
    setSearching(true);
    attemptsRef.current = 0;

    try {
      const response = await matchmakingAPI.join() as { status: string; match_id?: number };
      
      if (response.status === 'matched') {
        stopPolling();
        onFindNewMatch(response.match_id!);
      } else {
        pollForMatch();
      }
    } catch (err: any) {
      setSearchError(err.message);
      setSearching(false);
    }
  }, [onFindNewMatch, pollForMatch, stopPolling]);

  const handleCancelSearch = useCallback(async () => {
    stopPolling();
    try {
      await matchmakingAPI.leave();
    } catch (err) {}
    setSearching(false);
  }, [stopPolling]);

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

  const getReasonText = () => {
    if (reason === 'FORFEIT') return didWin ? `${opponentName} forfeited` : `${myDisplayName} forfeited`;
    if (reason === 'PUZZLE_SOLVED') return didWin ? 'Puzzle completed!' : `${opponentName} solved it`;
    if (reason === 'TIMEOUT_SCORE') return didWin ? 'Higher score' : 'Lower score';
    if (reason === 'DRAW') return 'Equal scores';
    return '';
  };

  const getFlavorText = () => {
    if (isDraw) return '';
    if (didWin) {
      if (isBigWin) return '🔥 DOMINATED!';
      if (ratingChange >= 15) return 'Crushed it!';
      return 'Well played!';
    }
    return 'Next time...';
  };

  // Colors based on win/loss
  const fillColor = didWin ? '#00FFFF' : '#FF00FF';
  const fillColorLight = didWin ? '#7FFFFF' : '#FF7FFF';
  const fillColorDark = didWin ? '#00B3B3' : '#B300B3';
  const glowColor = didWin ? '#FF00FF' : '#00FFFF';

  const titleStyle = {
    fontFamily: "'Industry', 'Orbitron', sans-serif",
    fontWeight: 900,
    fontStyle: 'italic',
    letterSpacing: '-0.02em',
  };

  const breatheScale = 1 + Math.sin(breathePhase * Math.PI / 180) * 0.02;
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
          className="absolute inset-0 z-50 pointer-events-none"
          style={{
            background: didWin 
              ? 'radial-gradient(circle, rgba(0,255,255,0.6) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(255,0,255,0.4) 0%, transparent 70%)',
          }}
        />
      )}

      {/* Breathing grid background - behind everything */}
      <div 
        className="absolute inset-0 pointer-events-none transition-all duration-300 z-0"
        style={{
          backgroundImage: `
            linear-gradient(hsla(${gridHue}, 100%, 50%, ${breatheOpacity}) 1px, transparent 1px),
            linear-gradient(90deg, hsla(${gridHue}, 100%, 50%, ${breatheOpacity}) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
          transform: `scale(${breatheScale})`,
        }}
      />

      {/* Ambient glow - breathing */}
      <div 
        className="absolute inset-0 pointer-events-none transition-all duration-500 z-0"
        style={{
          background: didWin 
            ? `radial-gradient(circle at center 30%, rgba(0,255,255,${0.1 + Math.sin(breathePhase * Math.PI / 180) * 0.05}) 0%, transparent 50%)`
            : `radial-gradient(circle at center 30%, rgba(255,0,255,${0.08 + Math.sin(breathePhase * Math.PI / 180) * 0.04}) 0%, transparent 50%)`,
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
          onClick={() => { handleButtonPress(); onBackToLobby(); }}
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
        {/* Result Title - Slam in effect */}
        <div 
          className={`relative mb-3 ${showTitle ? 'animate-slam-in' : 'opacity-0 scale-150'}`}
        >
          {/* Outer glow layer */}
          <span
            className="absolute inset-0 text-8xl sm:text-9xl select-none pointer-events-none"
            style={{
              ...titleStyle,
              color: 'transparent',
              WebkitTextStroke: `8px ${glowColor}`,
              filter: 'blur(12px)',
              opacity: 0.6,
            }}
            aria-hidden="true"
          >
            {isDraw ? 'DRAW' : didWin ? 'VICTORY' : 'DEFEAT'}
          </span>

          {/* Inner glow layer */}
          <span
            className="absolute inset-0 text-8xl sm:text-9xl select-none pointer-events-none"
            style={{
              ...titleStyle,
              color: 'transparent',
              WebkitTextStroke: `5px ${glowColor}`,
              filter: 'blur(4px)',
              opacity: 0.8,
            }}
            aria-hidden="true"
          >
            {isDraw ? 'DRAW' : didWin ? 'VICTORY' : 'DEFEAT'}
          </span>

          {/* White stroke layer */}
          <span
            className="absolute inset-0 text-8xl sm:text-9xl select-none pointer-events-none"
            style={{
              ...titleStyle,
              color: 'transparent',
              WebkitTextStroke: '2.5px rgba(255,255,255,0.95)',
            }}
            aria-hidden="true"
          >
            {isDraw ? 'DRAW' : didWin ? 'VICTORY' : 'DEFEAT'}
          </span>

          {/* Fill gradient */}
          <span
            className="relative text-8xl sm:text-9xl select-none"
            style={{
              ...titleStyle,
              background: isDraw 
                ? 'linear-gradient(135deg, #8B8B8B 0%, #FFFFFF 50%, #8B8B8B 100%)'
                : `linear-gradient(135deg, ${fillColor} 0%, ${fillColorLight} 25%, ${fillColor} 50%, ${fillColorDark} 75%, ${fillColor} 100%)`,
              backgroundSize: '200% 200%',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              animation: 'logo-shimmer 3s ease-in-out infinite',
            }}
          >
            {isDraw ? 'DRAW' : didWin ? 'VICTORY' : 'DEFEAT'}
          </span>
        </div>

        {/* Reason + Flavor text */}
        <p 
          className="font-body text-sm mb-2 uppercase tracking-widest"
          style={{ 
            color: didWin ? 'rgba(0,255,255,0.8)' : !isDraw ? 'rgba(255,0,255,0.8)' : 'rgba(255,255,255,0.6)',
            textShadow: didWin 
              ? '0 0 10px rgba(0,255,255,0.4)' 
              : !isDraw 
              ? '0 0 10px rgba(255,0,255,0.4)' 
              : 'none',
          }}
        >
          {getReasonText()}
        </p>
        
        {getFlavorText() && (
          <p 
            className={`font-heading font-bold text-lg mb-6 ${!didWin && !isDraw ? 'animate-pulse' : ''}`}
            style={{ 
              color: didWin ? '#00FFFF' : '#FF00FF',
              textShadow: didWin 
                ? '0 0 15px rgba(0,255,255,0.6)' 
                : '0 0 15px rgba(255,0,255,0.6)',
            }}
          >
            {getFlavorText()}
          </p>
        )}

        {/* Score comparison */}
        <div className="flex items-center gap-6 mb-6">
          <div className="text-center">
            <span 
              className="text-xs font-body uppercase tracking-widest block mb-2"
              style={{ color: 'rgba(0,255,255,0.7)' }}
            >
              {myDisplayName}
            </span>
            <span 
              className="text-5xl font-mono font-bold text-player"
              style={{ textShadow: '0 0 20px rgba(0,255,255,0.5)' }}
            >
              {myResult.cellsCompleted}
            </span>
          </div>
          
          <span 
            className="text-2xl font-heading font-bold text-primary mt-4"
            style={{ textShadow: '0 0 10px rgba(139,0,255,0.4)' }}
          >
            —
          </span>
          
          <div className="text-center">
            <span 
              className="text-xs font-body uppercase tracking-widest block mb-2 truncate max-w-[100px]"
              style={{ color: 'rgba(255,0,255,0.7)' }}
              title={opponentName}
            >
              {opponentName.length > 10 ? opponentName.slice(0, 10) + '…' : opponentName}
            </span>
            <span 
              className="text-5xl font-mono font-bold text-opponent"
              style={{ textShadow: '0 0 20px rgba(255,0,255,0.5)' }}
            >
              {opponentResult.cellsCompleted}
            </span>
          </div>
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
            border: `2px solid ${ratingChange > 0 
              ? 'rgba(0,255,136,0.5)' 
              : ratingChange < 0 
              ? 'rgba(255,51,102,0.5)' 
              : 'rgba(139,0,255,0.3)'}`,
            boxShadow: ratingChange > 0 
              ? '0 0 25px rgba(0,255,136,0.2), inset 0 0 20px rgba(0,255,136,0.05)' 
              : ratingChange < 0 
              ? '0 0 25px rgba(255,51,102,0.2), inset 0 0 20px rgba(255,51,102,0.05)' 
              : '0 0 15px rgba(139,0,255,0.15)',
          }}
        >
          <div className="flex items-center justify-center gap-4">
            <span 
              className="text-4xl font-mono font-bold tabular-nums"
              style={{ 
                color: '#FFFFFF',
                textShadow: '0 0 15px rgba(255,255,255,0.3)',
              }}
            >
              {Math.round(displayedRating)}
            </span>
            <span 
              className="text-2xl font-mono font-bold tabular-nums"
              style={{
                color: ratingChange > 0 ? '#00FF88' : ratingChange < 0 ? '#FF3366' : '#888888',
                textShadow: ratingChange > 0 
                  ? '0 0 12px rgba(0,255,136,0.6)' 
                  : ratingChange < 0 
                  ? '0 0 12px rgba(255,51,102,0.6)' 
                  : 'none',
              }}
            >
              {ratingChange > 0 ? '+' : ''}{Math.round(ratingChange)}
            </span>
          </div>
        </div>

        {/* Action Buttons / Search UI */}
        <div className="w-full max-w-xs">
          {searching ? (
            <div className="text-center">
              <div className="relative w-20 h-20 mx-auto mb-6">
                <div className="absolute inset-0 rounded-full border-4 border-surface" />
                <div 
                  className="absolute inset-0 rounded-full border-4 border-transparent border-t-player animate-spin"
                  style={{ 
                    boxShadow: '0 0 20px rgba(0,255,255,0.5)',
                    filter: 'drop-shadow(0 0 10px rgba(0,255,255,0.8))'
                  }}
                />
              </div>
              
              <h2 className="text-xl font-display font-black text-primary mb-2 tracking-wide">SEARCHING...</h2>
              <p className="text-secondary font-display mb-1">Looking for an opponent</p>
              <p className="text-player text-lg font-display mb-6">
                0:{String(30 - attemptsRef.current).padStart(2, '0')}
              </p>
              
              {searchError && (
                <div 
                  className="w-full mb-4 px-4 py-3 bg-void bg-error/10 border border-error/50 rounded-lg"
                  style={{ boxShadow: '0 0 15px rgba(255,51,102,0.2)' }}
                >
                  <p className="text-error text-sm font-display">{searchError}</p>
                </div>
              )}
              
              <button
                onClick={handleCancelSearch}
                className="w-full py-3 bg-surface border border-grid-line text-secondary font-display font-black rounded-lg hover:border-error/50 hover:text-error transition-all"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Rematch - Pulsing glow */}
              <button
                onClick={() => { handleButtonPress(); onRematch(); }}
                disabled={rematchState === 'requested'}
                className={`w-full py-4 text-lg font-body font-bold uppercase tracking-widest rounded-xl transition-all active:scale-95 ${
                  rematchState === 'waiting' ? '' : rematchState === 'requested' ? 'cursor-not-allowed' : 'animate-button-glow'
                }`}
                style={
                  rematchState === 'waiting'
                    ? {
                        background: 'rgba(0,255,136,0.15)',
                        border: '2px solid #00FF88',
                        color: '#00FF88',
                        boxShadow: '0 0 20px rgba(0,255,136,0.3)',
                        animation: 'pulse 1s ease-in-out infinite',
                      }
                    : rematchState === 'requested'
                    ? {
                        background: 'rgba(30,15,45,0.4)',
                        border: '1px solid rgba(139,0,255,0.3)',
                        color: 'rgba(255,255,255,0.4)',
                      }
                    : {
                        background: 'rgba(0,255,255,0.1)',
                        border: '2px solid #00FFFF',
                        color: '#00FFFF',
                      }
                }
              >
                {rematchState === 'idle' && 'Rematch'}
                {rematchState === 'requested' && `Waiting... ${rematchCountdown}s`}
                {rematchState === 'waiting' && '⚔️ Accept Rematch'}
              </button>

              {/* Find New Match */}
              <button
                onClick={() => { handleButtonPress(); handleFindNewMatch(); }}
                className="w-full py-4 text-lg font-body font-semibold uppercase tracking-wider rounded-xl transition-all active:scale-95"
                style={{
                  background: 'rgba(30,15,45,0.4)',
                  border: '1px solid rgba(139,0,255,0.4)',
                  color: 'rgba(255,255,255,0.7)',
                }}
              >
                Find New Match
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

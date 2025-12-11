import { useEffect, useState, useRef } from 'react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import './GameEndOverlay.css';

interface GameEndOverlayProps {
  isActive: boolean;
  reason: 'complete' | 'timeout'; // 'complete' = GAME OVER, 'timeout' = TIME'S UP
  onComplete: () => void;
}

// Sound effect for dramatic impact
const playGameEndSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Deep boom sound
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Start with low frequency boom
    oscillator.frequency.setValueAtTime(80, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(40, audioContext.currentTime + 0.3);
    oscillator.type = 'sine';
    
    // Quick attack, medium decay
    gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.5);
    
    // Add a second higher "impact" layer
    const oscillator2 = audioContext.createOscillator();
    const gainNode2 = audioContext.createGain();
    
    oscillator2.connect(gainNode2);
    gainNode2.connect(audioContext.destination);
    
    oscillator2.frequency.setValueAtTime(150, audioContext.currentTime);
    oscillator2.frequency.exponentialRampToValueAtTime(60, audioContext.currentTime + 0.15);
    oscillator2.type = 'triangle';
    
    gainNode2.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    
    oscillator2.start();
    oscillator2.stop(audioContext.currentTime + 0.2);
  } catch (error) {
    console.warn('Could not play game end sound:', error);
  }
};

// Heavy haptic impact
const triggerHeavyHaptic = async () => {
  try {
    await Haptics.impact({ style: ImpactStyle.Heavy });
    // Double tap for extra impact
    setTimeout(() => {
      Haptics.impact({ style: ImpactStyle.Heavy });
    }, 50);
  } catch (error) {
    // Fallback to vibration API
    if (navigator.vibrate) {
      navigator.vibrate([100, 30, 100]);
    }
  }
};

export default function GameEndOverlay({
  isActive,
  reason,
  onComplete,
}: GameEndOverlayProps) {
  const [phase, setPhase] = useState<'hidden' | 'showing' | 'exiting'>('hidden');
  const hasTriggeredRef = useRef(false);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    if (!isActive || hasTriggeredRef.current) return;
    hasTriggeredRef.current = true;

    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];

    const addTimeout = (fn: () => void, delay: number) => {
      const id = setTimeout(fn, delay);
      timeoutsRef.current.push(id);
      return id;
    };

    // 0ms: Start showing, trigger haptic and sound
    setPhase('showing');
    triggerHeavyHaptic();
    playGameEndSound();

    // 4700ms: Start exit animation (5 seconds total - 300ms for exit)
    addTimeout(() => {
      setPhase('exiting');
    }, 4700);

    // 5000ms: Complete, trigger callback
    addTimeout(() => {
      setPhase('hidden');
      onComplete();
    }, 5000);

  }, [isActive, onComplete]);

  useEffect(() => {
    if (!isActive) {
      hasTriggeredRef.current = false;
      setPhase('hidden');
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
    }
  }, [isActive]);

  if (phase === 'hidden') {
    return null;
  }

  const displayText = reason === 'timeout' ? "TIME'S UP!" : "GAME OVER!";
  
  // Colors matching DEFEAT text style (magenta with cyan glow)
  const fillColor = '#FF00FF';
  const fillColorLight = '#FF7FFF';
  const fillColorDark = '#B300B3';
  const glowColor = '#00FFFF';

  return (
    <div className={`game-end-overlay ${phase === 'exiting' ? 'game-end-overlay-exit' : ''}`}>
      <div className={`game-end-text-container ${phase === 'exiting' ? 'game-end-text-exit' : ''}`}>
        {/* Outer glow layer */}
        <span
          className="absolute inset-0 game-end-text-layer"
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
          {displayText}
        </span>

        {/* Inner glow layer */}
        <span
          className="absolute inset-0 game-end-text-layer"
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
          {displayText}
        </span>

        {/* White stroke layer */}
        <span
          className="absolute inset-0 game-end-text-layer"
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
          {displayText}
        </span>

        {/* Fill gradient - main visible text */}
        <span
          className="relative game-end-text-fill"
          style={{
            fontFamily: "'Industry', 'Orbitron', sans-serif",
            fontWeight: 900,
            fontStyle: 'italic',
            letterSpacing: '-0.02em',
            background: `linear-gradient(180deg, ${fillColorLight} 0%, ${fillColor} 50%, ${fillColorDark} 100%)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          {displayText}
        </span>

        {/* Shimmer overlay - animating gradient */}
        <span
          className="absolute inset-0 game-end-text-layer"
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
          {displayText}
        </span>
      </div>
    </div>
  );
}

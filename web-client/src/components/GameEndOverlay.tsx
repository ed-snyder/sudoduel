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

    // 2300ms: Start exit animation
    addTimeout(() => {
      setPhase('exiting');
    }, 2300);

    // 2500ms: Complete, trigger callback
    addTimeout(() => {
      setPhase('hidden');
      onComplete();
    }, 2500);

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

  return (
    <div className={`game-end-overlay ${phase === 'exiting' ? 'game-end-overlay-exit' : ''}`}>
      <div className={`game-end-text-container ${phase === 'exiting' ? 'game-end-text-exit' : ''}`}>
        <span className="game-end-text">{displayText}</span>
        <div className="game-end-sheen" />
      </div>
    </div>
  );
}

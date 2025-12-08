import { useEffect, useState, useRef } from 'react';
import './GameCountdown.css';

export type CountdownPhase = 'hidden' | 'vs' | 'countdown' | 'go' | 'complete';

interface GameCountdownProps {
  playerName: string;
  playerRating: number;
  opponentName: string;
  opponentRating: number;
  onPhaseChange?: (phase: CountdownPhase) => void;
  onComplete?: () => void;
  isActive: boolean;
}

export default function GameCountdown({
  playerName,
  playerRating,
  opponentName,
  opponentRating,
  onPhaseChange,
  onComplete,
  isActive,
}: GameCountdownProps) {
  const [phase, setPhase] = useState<CountdownPhase>('hidden');
  const [countdownNumber, setCountdownNumber] = useState<number | null>(null);
  const hasStartedRef = useRef(false);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    if (!isActive || hasStartedRef.current) return;
    hasStartedRef.current = true;

    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];

    const addTimeout = (fn: () => void, delay: number) => {
      const id = setTimeout(fn, delay);
      timeoutsRef.current.push(id);
      return id;
    };

    // Timeline:
    // 0ms: VS screen
    // 2000ms: "3" appears
    // 3200ms: "2" appears
    // 4400ms: "1" appears
    // 5600ms: "GO!" appears
    // 6800ms: Complete

    setPhase('vs');
    onPhaseChange?.('vs');

    addTimeout(() => {
      setPhase('countdown');
      setCountdownNumber(3);
      onPhaseChange?.('countdown');
    }, 2000);

    addTimeout(() => setCountdownNumber(2), 3200);
    addTimeout(() => setCountdownNumber(1), 4400);

    addTimeout(() => {
      setPhase('go');
      setCountdownNumber(null);
      onPhaseChange?.('go');
    }, 5600);

    addTimeout(() => {
      setPhase('complete');
      onPhaseChange?.('complete');
      onComplete?.();
    }, 6800);

  }, [isActive, onPhaseChange, onComplete]);

  useEffect(() => {
    if (!isActive) {
      hasStartedRef.current = false;
      setPhase('hidden');
      setCountdownNumber(null);
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
    }
  }, [isActive]);

  if (phase === 'hidden' || phase === 'complete') {
    return null;
  }

  return (
    <div className="countdown-overlay">
      {phase === 'vs' && (
        <div className="vs-container">
          <div className="vs-player vs-player-left">
            <div className="vs-name">{playerName}</div>
            <div className="vs-rating">{Math.round(playerRating)}</div>
          </div>
          <div className="vs-text">VS</div>
          <div className="vs-player vs-player-right">
            <div className="vs-name">{opponentName}</div>
            <div className="vs-rating">{Math.round(opponentRating)}</div>
          </div>
        </div>
      )}

      {phase === 'countdown' && countdownNumber !== null && (
        <div className="countdown-number-container" key={countdownNumber}>
          <span className="countdown-number">{countdownNumber}!</span>
        </div>
      )}

      {phase === 'go' && (
        <div className="countdown-number-container countdown-go">
          <span className="countdown-number countdown-number-go">GO!</span>
        </div>
      )}
    </div>
  );
}

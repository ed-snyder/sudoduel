import { useEffect, useState, useRef } from 'react';
import './GameCountdown.css';

export type CountdownPhase = 'hidden' | 'countdown' | 'go' | 'complete';

interface GameCountdownProps {
  playerName: string;
  playerRating: number;
  opponentName: string;
  opponentRating: number;
  onPhaseChange?: (phase: CountdownPhase) => void;
  onCountdownNumberChange?: (number: number | null) => void;
  onComplete?: () => void;
  isActive: boolean;
}

export default function GameCountdown({
  playerName,
  playerRating,
  opponentName,
  opponentRating,
  onPhaseChange,
  onCountdownNumberChange,
  onComplete,
  isActive,
}: GameCountdownProps) {
  const [phase, setPhase] = useState<CountdownPhase>('hidden');
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
    // 0ms: "3" appears, grid starts drawing
    // 1200ms: "2" appears
    // 2400ms: "1" appears
    // 3600ms: "GO!" appears
    // 4800ms: Complete

    // Start countdown immediately
    setPhase('countdown');
    onCountdownNumberChange?.(3);
    onPhaseChange?.('countdown');

    addTimeout(() => {
      onCountdownNumberChange?.(2);
    }, 1200);
    addTimeout(() => {
      onCountdownNumberChange?.(1);
    }, 2400);

    addTimeout(() => {
      setPhase('go');
      onCountdownNumberChange?.(null);
      onPhaseChange?.('go');
    }, 3600);

    addTimeout(() => {
      setPhase('complete');
      onPhaseChange?.('complete');
      onComplete?.();
    }, 4800);

  }, [isActive, onPhaseChange, onComplete]);

  useEffect(() => {
    if (!isActive) {
      hasStartedRef.current = false;
      setPhase('hidden');
      onCountdownNumberChange?.(null);
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
    }
  }, [isActive, onCountdownNumberChange]);

  // No overlay needed - countdown numbers are displayed in banner area
  return null;
}

import { useEffect, useState, useRef } from 'react';
import './GameCountdown.css';

export type CountdownPhase = 'hidden' | 'countdown' | 'go' | 'complete';

// Standard animation duration is 4800ms
const ANIMATION_DURATION_MS = 4800;

interface GameCountdownProps {
  onPhaseChange?: (phase: CountdownPhase) => void;
  onCountdownNumberChange?: (number: number | null) => void;
  onComplete?: () => void;
  isActive: boolean;
  // Target local time when gameplay should start (for synchronization)
  // If not provided, uses standard 4800ms animation
  playAtLocalTime?: number | null;
}

export default function GameCountdown({
  onPhaseChange,
  onCountdownNumberChange,
  onComplete,
  isActive,
  playAtLocalTime,
}: GameCountdownProps) {
  const [_phase, setPhase] = useState<CountdownPhase>('hidden');
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

    // Calculate timing
    const now = Date.now();
    let timeUntilPlay = ANIMATION_DURATION_MS;
    
    if (playAtLocalTime) {
      timeUntilPlay = playAtLocalTime - now;
      // Ensure minimum animation time (can't start before animation shows)
      if (timeUntilPlay < ANIMATION_DURATION_MS) {
        console.log('[Countdown] Client is late, using standard animation');
        timeUntilPlay = ANIMATION_DURATION_MS;
      } else {
        console.log(`[Countdown] Synchronized start in ${timeUntilPlay}ms`);
      }
    }

    // Calculate ratio to scale animation timing (if we have extra time, add delay at end)
    // Animation phases are at fixed positions, we just delay completion if needed
    const extraDelay = Math.max(0, timeUntilPlay - ANIMATION_DURATION_MS);

    // Timeline:
    // 0ms: "3" appears, grid starts drawing
    // 1200ms: "2" appears
    // 2400ms: "1" appears
    // 3600ms: "GO!" appears
    // 4800ms + extraDelay: Complete (synchronized)

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

    // Complete at synchronized time (standard 4800ms + any extra delay for sync)
    addTimeout(() => {
      setPhase('complete');
      onPhaseChange?.('complete');
      onComplete?.();
    }, 4800 + extraDelay);

  }, [isActive, onPhaseChange, onComplete, playAtLocalTime]);

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

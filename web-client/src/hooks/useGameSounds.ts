import { useRef, useCallback } from 'react';

// Musical scale frequencies (C major, starting at C5)
const SCALE_FREQUENCIES = [
  523.25,  // C5 - streak 1
  587.33,  // D5 - streak 2
  659.25,  // E5 - streak 3
  698.46,  // F5 - streak 4
  783.99,  // G5 - streak 5
  880.00,  // A5 - streak 6
  987.77,  // B5 - streak 7
  1046.50, // C6 - streak 8 (max)
];

export function useGameSounds() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const streakRef = useRef(0);

  // Initialize audio context (must be called after user interaction)
  const initAudio = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    // Resume if suspended (browser autoplay policy)
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  }, []);

  // Correct move: bright ping that scales with streak
  const playCorrectSound = useCallback(() => {
    initAudio();
    const ctx = audioContextRef.current;
    if (!ctx) return;

    // Increment streak (cap at 8)
    streakRef.current = Math.min(streakRef.current + 1, 8);
    const frequency = SCALE_FREQUENCIES[streakRef.current - 1];

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    // Bright, bell-like tone (sine + slight harmonics)
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

    // Quick attack, short decay (ping sound)
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.01); // Fast attack
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15); // Quick decay

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.15);
  }, [initAudio]);

  // Incorrect move: low thud/buzz (devastating but short)
  const playIncorrectSound = useCallback(() => {
    initAudio();
    const ctx = audioContextRef.current;
    if (!ctx) return;

    // Reset streak on mistake
    streakRef.current = 0;

    // Layer 1: Low thud
    const oscLow = ctx.createOscillator();
    const gainLow = ctx.createGain();
    oscLow.type = 'sine';
    oscLow.frequency.setValueAtTime(80, ctx.currentTime);
    oscLow.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.2);
    gainLow.gain.setValueAtTime(0.4, ctx.currentTime);
    gainLow.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    oscLow.connect(gainLow);
    gainLow.connect(ctx.destination);
    oscLow.start(ctx.currentTime);
    oscLow.stop(ctx.currentTime + 0.2);

    // Layer 2: Harsh buzz
    const oscBuzz = ctx.createOscillator();
    const gainBuzz = ctx.createGain();
    oscBuzz.type = 'sawtooth';
    oscBuzz.frequency.setValueAtTime(120, ctx.currentTime);
    gainBuzz.gain.setValueAtTime(0.15, ctx.currentTime);
    gainBuzz.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    oscBuzz.connect(gainBuzz);
    gainBuzz.connect(ctx.destination);
    oscBuzz.start(ctx.currentTime);
    oscBuzz.stop(ctx.currentTime + 0.15);
  }, [initAudio]);

  // Reset streak manually (e.g., on game start)
  const resetStreak = useCallback(() => {
    streakRef.current = 0;
  }, []);

  // Get current streak (for UI if needed)
  const getStreak = useCallback(() => streakRef.current, []);

  return {
    playCorrectSound,
    playIncorrectSound,
    resetStreak,
    getStreak,
    initAudio,
  };
}


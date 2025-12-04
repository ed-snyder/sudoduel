import { useRef, useCallback, useEffect } from 'react';

// Pitch multipliers for streak (relative to base sound)
// Each step up is ~1.059 (semitone in equal temperament)
const STREAK_PITCH_MULTIPLIERS = [
  1.0,    // streak 1 - base pitch
  1.122,  // streak 2 - +2 semitones
  1.26,   // streak 3 - +4 semitones
  1.335,  // streak 4 - +5 semitones
  1.498,  // streak 5 - +7 semitones
  1.682,  // streak 6 - +9 semitones
  1.888,  // streak 7 - +11 semitones
  2.0,    // streak 8 - +12 semitones (octave)
];

export function useGameSounds() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const correctBufferRef = useRef<AudioBuffer | null>(null);
  const incorrectBufferRef = useRef<AudioBuffer | null>(null);
  const streakRef = useRef(0);

  // Initialize audio context
  const initAudio = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  }, []);

  // Load audio files on mount
  useEffect(() => {
    const loadSound = async (url: string): Promise<AudioBuffer | null> => {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        return await ctx.decodeAudioData(arrayBuffer);
      } catch (e) {
        console.warn(`Could not load sound: ${url}`, e);
        return null;
      }
    };

    // Load custom sounds if they exist, otherwise we'll use generated sounds
    loadSound('/sounds/correct.mp3').then(buf => { correctBufferRef.current = buf; });
    loadSound('/sounds/incorrect.mp3').then(buf => { incorrectBufferRef.current = buf; });
  }, []);

  // Play a buffer with optional playback rate (pitch)
  const playBuffer = useCallback((buffer: AudioBuffer, playbackRate: number = 1.0) => {
    const ctx = audioContextRef.current;
    if (!ctx) return;

    const source = ctx.createBufferSource();
    const gainNode = ctx.createGain();
    
    source.buffer = buffer;
    source.playbackRate.value = playbackRate;
    gainNode.gain.value = 0.5;
    
    source.connect(gainNode);
    gainNode.connect(ctx.destination);
    source.start();
  }, []);

  // Generate a ping sound (fallback if no custom sound loaded)
  const playGeneratedPing = useCallback((frequency: number) => {
    const ctx = audioContextRef.current;
    if (!ctx) return;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.15);
  }, []);

  // Generate incorrect sound (fallback if no custom sound loaded)
  const playGeneratedIncorrect = useCallback(() => {
    const ctx = audioContextRef.current;
    if (!ctx) return;

    // Low thud
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

    // Harsh buzz
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
  }, []);

  // Correct move sound
  const playCorrectSound = useCallback(() => {
    initAudio();
    
    streakRef.current = Math.min(streakRef.current + 1, 8);
    const pitchMultiplier = STREAK_PITCH_MULTIPLIERS[streakRef.current - 1];

    if (correctBufferRef.current) {
      // Use custom sound with pitch shift
      playBuffer(correctBufferRef.current, pitchMultiplier);
    } else {
      // Fallback to generated sound
      const baseFreq = 523.25; // C5
      playGeneratedPing(baseFreq * pitchMultiplier);
    }
  }, [initAudio, playBuffer, playGeneratedPing]);

  // Incorrect move sound
  const playIncorrectSound = useCallback(() => {
    initAudio();
    
    streakRef.current = 0;

    if (incorrectBufferRef.current) {
      // Use custom sound
      playBuffer(incorrectBufferRef.current, 1.0);
    } else {
      // Fallback to generated sound
      playGeneratedIncorrect();
    }
  }, [initAudio, playBuffer, playGeneratedIncorrect]);

  const resetStreak = useCallback(() => {
    streakRef.current = 0;
  }, []);

  const getStreak = useCallback(() => streakRef.current, []);

  return {
    playCorrectSound,
    playIncorrectSound,
    resetStreak,
    getStreak,
    initAudio,
  };
}

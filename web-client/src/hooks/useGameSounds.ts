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

  // Pre-initialize AudioContext on first user interaction to avoid cold start delay
  useEffect(() => {
    const initOnInteraction = () => {
      initAudio();
      // Play silent sound to fully initialize audio pipeline
      const ctx = audioContextRef.current;
      if (ctx) {
        ctx.resume().then(() => {
          const oscillator = ctx.createOscillator();
          const gain = ctx.createGain();
          gain.gain.value = 0; // Silent
          oscillator.connect(gain);
          gain.connect(ctx.destination);
          oscillator.start();
          oscillator.stop(ctx.currentTime + 0.001);
        });
      }
      document.removeEventListener('touchstart', initOnInteraction);
      document.removeEventListener('click', initOnInteraction);
    };
    
    document.addEventListener('touchstart', initOnInteraction, { once: true });
    document.addEventListener('click', initOnInteraction, { once: true });
    
    return () => {
      document.removeEventListener('touchstart', initOnInteraction);
      document.removeEventListener('click', initOnInteraction);
    };
  }, [initAudio]);

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

  // Correct move sound - enhanced with layered audio
  const playCorrectSound = useCallback(() => {
    initAudio();
    const ctx = audioContextRef.current;
    if (!ctx) return;
    
    streakRef.current = Math.min(streakRef.current + 1, 8);
    const streak = streakRef.current;
    const pitchMultiplier = STREAK_PITCH_MULTIPLIERS[streak - 1];
    const baseFreq = 523.25; // C5
    
    // Layer 1: Click transient (noise burst for attack)
    const clickDuration = 0.015;
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * clickDuration, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * 0.3;
    }
    const noiseSource = ctx.createBufferSource();
    const noiseGain = ctx.createGain();
    noiseSource.buffer = noiseBuffer;
    noiseGain.gain.setValueAtTime(0.15, ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + clickDuration);
    noiseSource.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noiseSource.start();
    noiseSource.stop(ctx.currentTime + clickDuration);
    
    // Layer 2: Main tone (sine wave)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(baseFreq * pitchMultiplier, ctx.currentTime);
    gain1.gain.setValueAtTime(0, ctx.currentTime);
    gain1.gain.linearRampToValueAtTime(0.35, ctx.currentTime + 0.01);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start();
    osc1.stop(ctx.currentTime + 0.2);
    
    // Layer 3: Harmony (fifth above) - starts at streak 3+
    if (streak >= 3) {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(baseFreq * pitchMultiplier * 1.5, ctx.currentTime); // Perfect fifth
      gain2.gain.setValueAtTime(0, ctx.currentTime);
      gain2.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.01);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start();
      osc2.stop(ctx.currentTime + 0.18);
    }
    
    // Layer 4: Full chord (major third) - starts at streak 5+
    if (streak >= 5) {
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.type = 'triangle';
      osc3.frequency.setValueAtTime(baseFreq * pitchMultiplier * 1.25, ctx.currentTime); // Major third
      gain3.gain.setValueAtTime(0, ctx.currentTime);
      gain3.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.015);
      gain3.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc3.connect(gain3);
      gain3.connect(ctx.destination);
      osc3.start();
      osc3.stop(ctx.currentTime + 0.22);
    }
    
    // Layer 5: Sub bass thump for streak 8
    if (streak >= 8) {
      const oscBass = ctx.createOscillator();
      const gainBass = ctx.createGain();
      oscBass.type = 'sine';
      oscBass.frequency.setValueAtTime(80, ctx.currentTime);
      oscBass.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.1);
      gainBass.gain.setValueAtTime(0.25, ctx.currentTime);
      gainBass.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      oscBass.connect(gainBass);
      gainBass.connect(ctx.destination);
      oscBass.start();
      oscBass.stop(ctx.currentTime + 0.15);
    }
  }, [initAudio]);

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

  // Victory jingle (ascending synth arpeggio)
  const playVictorySound = useCallback(() => {
    initAudio();
    const ctx = audioContextRef.current;
    if (!ctx) return;

    // Ascending arpeggio: C5 → E5 → G5 → C6
    const notes = [523.25, 659.25, 783.99, 1046.50];
    const noteLength = 0.12;
    
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * noteLength);
      
      gain.gain.setValueAtTime(0, ctx.currentTime + i * noteLength);
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + i * noteLength + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * noteLength + noteLength);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(ctx.currentTime + i * noteLength);
      osc.stop(ctx.currentTime + i * noteLength + noteLength);
    });
    
    // Final chord sustain
    const finalTime = ctx.currentTime + notes.length * noteLength;
    [523.25, 659.25, 783.99, 1046.50].forEach(freq => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, finalTime);
      gain.gain.setValueAtTime(0.15, finalTime);
      gain.gain.exponentialRampToValueAtTime(0.001, finalTime + 0.8);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(finalTime);
      osc.stop(finalTime + 0.8);
    });
  }, [initAudio]);

  // Soft defeat sound
  const playDefeatSound = useCallback(() => {
    initAudio();
    const ctx = audioContextRef.current;
    if (!ctx) return;

    // Descending minor notes, soft and quick
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.3);
    
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  }, [initAudio]);

  // Distant tick for opponent moves (optional)
  const playDistantTick = useCallback(() => {
    initAudio();
    const ctx = audioContextRef.current;
    if (!ctx) return;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    gain.gain.setValueAtTime(0.05, ctx.currentTime); // Very quiet
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  }, [initAudio]);

  return {
    playCorrectSound,
    playIncorrectSound,
    resetStreak,
    getStreak,
    initAudio,
    playVictorySound,
    playDefeatSound,
    playDistantTick,
  };
}

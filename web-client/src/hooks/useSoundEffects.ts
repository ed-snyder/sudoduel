import { useRef, useCallback, useEffect } from 'react';

// Sound file paths
const SOUNDS = {
  // Matchmaking
  joinQueue: '/sounds/matchmaking/join-queue.mp3',
  searching: '/sounds/matchmaking/searching.mp3',
  matchFound: '/sounds/matchmaking/match-found.mp3',
  
  // Gameplay
  countdown: '/sounds/gameplay/countdown.mp3',
  cellTap: '/sounds/gameplay/cell-tap.mp3',
  correct: '/sounds/gameplay/correct.mp3',
  incorrect: '/sounds/gameplay/incorrect.mp3',
  toolbarButton: '/sounds/gameplay/toolbar-button.mp3',
  rowComplete: '/sounds/gameplay/row-complete.mp3',
  streak5: '/sounds/gameplay/streak-5.mp3',
  lockout: '/sounds/gameplay/lockout.mp3',
  downToWire: '/sounds/gameplay/down-to-wire.mp3',
  timesUp: '/sounds/gameplay/times-up.mp3',
  
  // Results
  victory: '/sounds/results/victory.mp3',
  defeat: '/sounds/results/defeat.mp3',
  
  // UI
  buttonTap: '/sounds/ui/button-tap.mp3',
  modalOpen: '/sounds/ui/modal-open.mp3',
  modalClose: '/sounds/ui/modal-close.mp3',
  emoteReceived: '/sounds/ui/emote-received.mp3',
  
  // Premium
  purchased: '/sounds/premium/purchased.mp3',
} as const;

type SoundName = keyof typeof SOUNDS;

// Pitch multipliers for correct sound streak
const STREAK_PITCH_MULTIPLIERS = [
  1.0,    // streak 1
  1.122,  // streak 2
  1.26,   // streak 3
  1.335,  // streak 4
  1.498,  // streak 5
  1.682,  // streak 6
  1.888,  // streak 7
  2.0,    // streak 8
];

// Pitch multipliers for countdown (3, 2, 1 same pitch, GO! one octave higher)
const COUNTDOWN_PITCH: Record<number | 'go', number> = {
  3: 1.0,
  2: 1.0,
  1: 1.0,
  go: 2.0, // One octave higher (2x frequency)
};

// Read SFX volume from localStorage (default 55%)
const getSfxVolume = (): number => {
  const stored = localStorage.getItem('sudoduel_sfx_volume');
  return stored ? parseInt(stored, 10) : 55;
};

export function useSoundEffects(volumeMultiplier: number = 1.0) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const buffersRef = useRef<Map<SoundName, AudioBuffer>>(new Map());
  const searchingSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const searchingGainRef = useRef<GainNode | null>(null);
  const streakRef = useRef(0);
  const volumeMultiplierRef = useRef(volumeMultiplier);
  
  // Update ref when multiplier changes
  volumeMultiplierRef.current = volumeMultiplier;

  // Initialize AudioContext
  const initAudio = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  // Pre-initialize AudioContext on first user interaction
  useEffect(() => {
    const initOnInteraction = () => {
      initAudio();
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

  // Load a sound file into buffer
  const loadSound = useCallback(async (name: SoundName): Promise<AudioBuffer | undefined> => {
    if (buffersRef.current.has(name)) return buffersRef.current.get(name);
    
    try {
      const ctx = initAudio();
      const response = await fetch(SOUNDS[name]);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      buffersRef.current.set(name, audioBuffer);
      return audioBuffer;
    } catch (error) {
      console.warn(`[SoundEffects] Failed to load sound: ${name}`, error);
      return undefined;
    }
  }, [initAudio]);

  // Preload critical sounds on mount
  useEffect(() => {
    const criticalSounds: SoundName[] = [
      'cellTap', 'correct', 'incorrect', 'countdown', 
      'rowComplete', 'toolbarButton', 'victory', 'defeat'
    ];
    criticalSounds.forEach(loadSound);
  }, [loadSound]);

  // Play a sound with optional pitch and volume adjustments
  const playSound = useCallback(async (
    name: SoundName, 
    options?: { pitch?: number; volume?: number }
  ): Promise<AudioBufferSourceNode | undefined> => {
    const ctx = initAudio();
    let buffer = buffersRef.current.get(name);
    
    if (!buffer) {
      buffer = await loadSound(name);
      if (!buffer) return undefined;
    }

    const source = ctx.createBufferSource();
    const gainNode = ctx.createGain();
    
    source.buffer = buffer;
    source.playbackRate.value = options?.pitch ?? 1.0;
    
    // Apply SFX volume setting + per-sound adjustment + screen multiplier
    const baseVolume = getSfxVolume() / 100;
    const soundVolume = options?.volume ?? 1.0;
    gainNode.gain.value = baseVolume * soundVolume * volumeMultiplierRef.current;
    
    source.connect(gainNode);
    gainNode.connect(ctx.destination);
    source.start();
    
    return source;
  }, [initAudio, loadSound]);

  // === MATCHMAKING SOUNDS ===
  
  const playJoinQueue = useCallback(() => {
    playSound('joinQueue');
  }, [playSound]);
  
  const playSearching = useCallback(async () => {
    // Stop any existing searching sound
    if (searchingSourceRef.current) {
      try {
        searchingSourceRef.current.stop();
      } catch (e) {}
      searchingSourceRef.current = null;
    }
    
    const ctx = initAudio();
    let buffer = buffersRef.current.get('searching');
    if (!buffer) {
      buffer = await loadSound('searching');
      if (!buffer) return;
    }
    
    const source = ctx.createBufferSource();
    const gainNode = ctx.createGain();
    
    source.buffer = buffer;
    source.loop = true;
    gainNode.gain.value = (getSfxVolume() / 100) * volumeMultiplierRef.current;
    
    source.connect(gainNode);
    gainNode.connect(ctx.destination);
    source.start();
    
    searchingSourceRef.current = source;
    searchingGainRef.current = gainNode;
  }, [initAudio, loadSound]);
  
  const stopSearching = useCallback(() => {
    if (searchingSourceRef.current) {
      try {
        searchingSourceRef.current.stop();
      } catch (e) {}
      searchingSourceRef.current = null;
      searchingGainRef.current = null;
    }
  }, []);
  
  const playMatchFound = useCallback(() => {
    stopSearching();
    playSound('matchFound');
  }, [playSound, stopSearching]);

  // === GAMEPLAY SOUNDS ===
  
  const playCountdown = useCallback((number: 3 | 2 | 1 | 'go') => {
    const pitch = COUNTDOWN_PITCH[number];
    const volume = number === 'go' ? 1.4 : 1.2; // GO! louder
    playSound('countdown', { pitch, volume });
  }, [playSound]);
  
  const playCellTap = useCallback(() => {
    playSound('cellTap', { volume: 0.8 });
  }, [playSound]);
  
  const playCorrect = useCallback(() => {
    streakRef.current = Math.min(streakRef.current + 1, 8);
    const pitch = STREAK_PITCH_MULTIPLIERS[streakRef.current - 1];
    playSound('correct', { pitch });
    
    // Play extra sound at streak 5+
    if (streakRef.current >= 5) {
      playSound('streak5', { volume: 0.7 });
    }
  }, [playSound]);
  
  const playIncorrect = useCallback(() => {
    streakRef.current = 0;
    playSound('incorrect');
  }, [playSound]);
  
  const playToolbarButton = useCallback(() => {
    playSound('toolbarButton', { volume: 0.9 });
  }, [playSound]);
  
  const playRowComplete = useCallback(() => {
    playSound('rowComplete');
  }, [playSound]);
  
  const playLockout = useCallback(() => {
    playSound('lockout');
  }, [playSound]);
  
  const playDownToWire = useCallback(() => {
    // Louder than other sounds so it's noticeable
    playSound('downToWire', { volume: 1.4 });
  }, [playSound]);
  
  const playTimesUp = useCallback(() => {
    playSound('timesUp');
  }, [playSound]);

  // === RESULT SOUNDS ===
  
  const playVictory = useCallback(() => {
    playSound('victory');
  }, [playSound]);
  
  const playDefeat = useCallback(() => {
    playSound('defeat');
  }, [playSound]);

  // === UI SOUNDS ===
  
  const playButtonTap = useCallback(() => {
    playSound('buttonTap', { volume: 0.7 });
  }, [playSound]);
  
  const playModalOpen = useCallback(() => {
    playSound('modalOpen', { volume: 0.8 });
  }, [playSound]);
  
  const playModalClose = useCallback(() => {
    playSound('modalClose', { volume: 0.8 });
  }, [playSound]);
  
  const playEmoteReceived = useCallback(() => {
    playSound('emoteReceived');
  }, [playSound]);

  // === PREMIUM SOUNDS ===
  
  const playPremiumPurchased = useCallback(() => {
    playSound('purchased');
  }, [playSound]);

  // === UTILITY ===
  
  const resetStreak = useCallback(() => {
    streakRef.current = 0;
  }, []);
  
  const getStreak = useCallback(() => streakRef.current, []);

  return {
    // Matchmaking
    playJoinQueue,
    playSearching,
    stopSearching,
    playMatchFound,
    
    // Gameplay
    playCountdown,
    playCellTap,
    playCorrect,
    playIncorrect,
    playToolbarButton,
    playRowComplete,
    playLockout,
    playDownToWire,
    playTimesUp,
    
    // Results
    playVictory,
    playDefeat,
    
    // UI
    playButtonTap,
    playModalOpen,
    playModalClose,
    playEmoteReceived,
    
    // Premium
    playPremiumPurchased,
    
    // Utility
    resetStreak,
    getStreak,
    initAudio,
  };
}

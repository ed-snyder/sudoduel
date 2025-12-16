import { createContext, useContext, useRef, useEffect, useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { App } from '@capacitor/app';

type MusicTrack = 'menu' | 'game' | null;

interface MusicContextType {
  playGameMusic: () => void;
  stopMusic: () => void;
  fadeOut: (duration?: number) => void;
  setVolume: (volume: number) => void;
  currentTrack: MusicTrack;
}

const MusicContext = createContext<MusicContextType | null>(null);

const getMusicVolume = (): number => {
  const stored = localStorage.getItem('sudoduel_music_volume');
  return stored ? parseInt(stored, 10) : 100;
};

// Module-level audio context and nodes - iOS requires Web Audio API for volume control
let audioContext: AudioContext | null = null;
let sourceNode: MediaElementAudioSourceNode | null = null;
let gainNode: GainNode | null = null;
let globalAudio: HTMLAudioElement | null = null;
let globalCurrentTrack: MusicTrack = null;
let globalCurrentSrc: string | null = null;

// Initialize or get AudioContext
const getAudioContext = (): AudioContext => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
};

export function MusicProvider({ children }: { children: ReactNode }) {
  const fadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [currentTrack, setCurrentTrack] = useState<MusicTrack>(globalCurrentTrack);

  const stopMusic = useCallback(() => {
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }
    if (globalAudio) {
      globalAudio.pause();
      globalAudio.src = '';
    }
    if (sourceNode) {
      try { sourceNode.disconnect(); } catch (e) {}
      sourceNode = null;
    }
    globalAudio = null;
    globalCurrentTrack = null;
    globalCurrentSrc = null;
    setCurrentTrack(null);
  }, []);

  const playTrack = useCallback((track: MusicTrack, src: string) => {
    // Don't restart if same track and same source are already playing
    if (globalCurrentTrack === track && globalCurrentSrc === src && globalAudio && !globalAudio.paused) {
      return;
    }

    // Clear any fade in progress
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }

    // Stop current music
    if (globalAudio) {
      globalAudio.pause();
      globalAudio.src = '';
    }
    if (sourceNode) {
      try { sourceNode.disconnect(); } catch (e) {}
      sourceNode = null;
    }

    // Create audio element
    const audio = new Audio(src);
    audio.loop = true;
    audio.crossOrigin = 'anonymous';
    
    // Set up Web Audio API for volume control (required for iOS)
    const ctx = getAudioContext();
    
    // Create nodes
    const source = ctx.createMediaElementSource(audio);
    const gain = ctx.createGain();
    
    // Set initial volume
    const volume = getMusicVolume() / 100;
    gain.gain.value = volume;
    
    // Connect: source -> gain -> destination
    source.connect(gain);
    gain.connect(ctx.destination);
    
    // Store references
    sourceNode = source;
    gainNode = gain;
    globalAudio = audio;
    globalCurrentTrack = track;
    globalCurrentSrc = src;
    
    // Start playback
    audio.play().catch(() => {
      // Autoplay blocked - user interaction required
    });

    setCurrentTrack(track);
  }, []);

  const playGameMusic = useCallback(() => {
    const tracks = [
      '/sounds/music/in-game.mp3',
      '/sounds/music/in-game-2.mp3',  // Add your new file
    ];
    const randomTrack = tracks[Math.floor(Math.random() * tracks.length)];
    playTrack('game', randomTrack);
  }, [playTrack]);

  const fadeOut = useCallback((duration: number = 1000) => {
    if (!gainNode) return;

    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
    }

    const startVolume = gainNode.gain.value;
    const steps = 20;
    const stepTime = duration / steps;
    const volumeStep = startVolume / steps;

    let step = 0;
    fadeIntervalRef.current = setInterval(() => {
      step++;
      if (gainNode) {
        gainNode.gain.value = Math.max(0, startVolume - (volumeStep * step));
      }

      if (step >= steps) {
        if (fadeIntervalRef.current) {
          clearInterval(fadeIntervalRef.current);
          fadeIntervalRef.current = null;
        }
        stopMusic();
      }
    }, stepTime);
  }, [stopMusic]);

  // Direct volume setter - called from Settings (uses GainNode for iOS compatibility)
  const setVolume = useCallback((volume: number) => {
    const normalizedVolume = Math.max(0, Math.min(100, volume)) / 100;
    if (gainNode) {
      gainNode.gain.value = normalizedVolume;
    }
  }, []);

  // Cleanup on unmount (don't stop music, just clear fade interval)
  useEffect(() => {
    return () => {
      if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
    };
  }, []);

  // Pause music when app goes to background to prevent Control Center appearance
  useEffect(() => {
    let listener: any;
    
    const setupListener = async () => {
      listener = await App.addListener('appStateChange', ({ isActive }) => {
        if (!isActive && globalAudio && !globalAudio.paused) {
          // App went to background - pause music
          globalAudio.pause();
        } else if (isActive && globalAudio && globalCurrentTrack) {
          // App became active - resume music if we have a track
          globalAudio.play().catch(() => {
            // Failed to resume
          });
        }
      });
    };
    
    setupListener();
    
    return () => {
      if (listener) {
        listener.remove();
      }
    };
  }, []);

  return (
    <MusicContext.Provider value={{
      playGameMusic,
      stopMusic,
      fadeOut,
      setVolume,
      currentTrack,
    }}>
      {children}
    </MusicContext.Provider>
  );
}

export function useMusic() {
  const context = useContext(MusicContext);
  if (!context) {
    throw new Error('useMusic must be used within MusicProvider');
  }
  return context;
}

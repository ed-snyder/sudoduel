import { createContext, useContext, useRef, useEffect, useCallback, useState } from 'react';
import type { ReactNode } from 'react';

type MusicTrack = 'menu' | 'game' | null;

interface MusicContextType {
  playMenuMusic: () => void;
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

// Module-level audio element - persists across re-renders
let globalAudio: HTMLAudioElement | null = null;
let globalCurrentTrack: MusicTrack = null;

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
      globalAudio = null;
    }
    globalCurrentTrack = null;
    setCurrentTrack(null);
  }, []);

  const playTrack = useCallback((track: MusicTrack, src: string) => {
    // Don't restart if same track is already playing
    if (globalCurrentTrack === track && globalAudio && !globalAudio.paused) {
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

    // Start new track
    const audio = new Audio(src);
    audio.loop = true;
    audio.volume = getMusicVolume() / 100;
    audio.play().catch(err => {
      console.warn('[Music] Autoplay blocked:', err);
    });

    globalAudio = audio;
    globalCurrentTrack = track;
    setCurrentTrack(track);
  }, []);

  const playMenuMusic = useCallback(() => {
    playTrack('menu', '/sounds/music/menu-lobby.mp3');
  }, [playTrack]);

  const playGameMusic = useCallback(() => {
    playTrack('game', '/sounds/music/in-game.mp3');
  }, [playTrack]);

  const fadeOut = useCallback((duration: number = 1000) => {
    if (!globalAudio) return;

    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
    }

    const audio = globalAudio;
    const startVolume = audio.volume;
    const steps = 20;
    const stepTime = duration / steps;
    const volumeStep = startVolume / steps;

    let step = 0;
    fadeIntervalRef.current = setInterval(() => {
      step++;
      if (audio) {
        audio.volume = Math.max(0, startVolume - (volumeStep * step));
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

  // Direct volume setter - called from Settings
  const setVolume = useCallback((volume: number) => {
    const normalizedVolume = Math.max(0, Math.min(100, volume)) / 100;
    console.log('[Music] setVolume called:', normalizedVolume, 'globalAudio exists:', !!globalAudio);
    if (globalAudio) {
      globalAudio.volume = normalizedVolume;
      console.log('[Music] Volume set successfully');
    } else {
      console.log('[Music] No audio element to set volume on');
    }
  }, []);

  // Cleanup on unmount (don't stop music, just clear fade interval)
  useEffect(() => {
    return () => {
      if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
    };
  }, []);

  return (
    <MusicContext.Provider value={{
      playMenuMusic,
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

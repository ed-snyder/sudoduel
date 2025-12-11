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

export function MusicProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentTrackRef = useRef<MusicTrack>(null);
  const fadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [currentTrack, setCurrentTrack] = useState<MusicTrack>(null);

  const stopMusic = useCallback(() => {
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    currentTrackRef.current = null;
    setCurrentTrack(null);
  }, []);

  const playTrack = useCallback((track: MusicTrack, src: string) => {
    // Don't restart if same track is already playing
    if (currentTrackRef.current === track && audioRef.current && !audioRef.current.paused) {
      return;
    }

    // Clear any fade in progress
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }

    // Stop current music
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }

    // Start new track
    const audio = new Audio(src);
    audio.loop = true;
    audio.volume = getMusicVolume() / 100;
    audio.play().catch(err => {
      console.warn('[Music] Autoplay blocked:', err);
    });

    audioRef.current = audio;
    currentTrackRef.current = track;
    setCurrentTrack(track);
  }, []);

  const playMenuMusic = useCallback(() => {
    playTrack('menu', '/sounds/music/menu-lobby.mp3');
  }, [playTrack]);

  const playGameMusic = useCallback(() => {
    playTrack('game', '/sounds/music/in-game.mp3');
  }, [playTrack]);

  const fadeOut = useCallback((duration: number = 1000) => {
    if (!audioRef.current) return;

    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
    }

    const audio = audioRef.current;
    const startVolume = audio.volume;
    const steps = 20;
    const stepTime = duration / steps;
    const volumeStep = startVolume / steps;

    let step = 0;
    fadeIntervalRef.current = setInterval(() => {
      step++;
      audio.volume = Math.max(0, startVolume - (volumeStep * step));

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
    console.log('[Music] setVolume called:', normalizedVolume);
    if (audioRef.current) {
      audioRef.current.volume = normalizedVolume;
    }
  }, []);

  // Listen for volume changes
  useEffect(() => {
    const handleVolumeChange = () => {
      const newVolume = getMusicVolume() / 100;
      console.log('[Music] Volume change event received, setting to:', newVolume);
      if (audioRef.current) {
        audioRef.current.volume = newVolume;
      }
    };

    // Listen for cross-tab changes (storage event)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'sudoduel_music_volume') {
        handleVolumeChange();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Listen for same-tab changes (custom event)
    window.addEventListener('musicVolumeChange', handleVolumeChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('musicVolumeChange', handleVolumeChange);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
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

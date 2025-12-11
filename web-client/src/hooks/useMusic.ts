import { useRef, useCallback, useEffect } from 'react';

const MUSIC = {
  menuLobby: '/sounds/music/menu-lobby.mp3',
  inGame: '/sounds/music/in-game.mp3',
} as const;

type MusicTrack = keyof typeof MUSIC;

// Read music volume from localStorage
const getMusicVolume = (): number => {
  const stored = localStorage.getItem('sudoduel_music_volume');
  return stored ? parseInt(stored, 10) : 100;
};

export function useMusic() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentTrackRef = useRef<MusicTrack | null>(null);
  const fadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Update volume when it changes in settings
  const updateVolume = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.volume = getMusicVolume() / 100;
    }
  }, []);

  // Listen for storage changes (when settings are updated)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'sudoduel_music_volume') {
        updateVolume();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [updateVolume]);

  const playMusic = useCallback((track: MusicTrack) => {
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
      audioRef.current = null;
    }
    
    // Start new track
    const audio = new Audio(MUSIC[track]);
    audio.loop = true;
    audio.volume = getMusicVolume() / 100;
    
    audio.play().catch(err => {
      console.warn('[Music] Autoplay blocked:', err);
    });
    
    audioRef.current = audio;
    currentTrackRef.current = track;
  }, []);

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
  }, []);

  const fadeOut = useCallback((duration: number = 1000) => {
    if (!audioRef.current) return;
    
    // Clear any existing fade
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

  // Convenience methods
  const playMenuMusic = useCallback(() => playMusic('menuLobby'), [playMusic]);
  const playGameMusic = useCallback(() => playMusic('inGame'), [playMusic]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current);
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  return {
    playMusic,
    playMenuMusic,
    playGameMusic,
    stopMusic,
    fadeOut,
    updateVolume,
  };
}

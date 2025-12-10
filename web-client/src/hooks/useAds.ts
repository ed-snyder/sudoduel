import { useState, useEffect, useCallback } from 'react';
import { useSubscription } from '../context/SubscriptionContext';
import { adService } from '../services/adService';

const STORAGE_KEYS = {
  GAMES_PLAYED: 'sudoduel_games_played',
  HAS_WON: 'sudoduel_has_won',
};

interface UseAdsReturn {
  shouldShowAd: (result: 'win' | 'loss' | 'draw') => boolean;
  showAdIfNeeded: (result: 'win' | 'loss' | 'draw') => Promise<void>;
  recordGamePlayed: (didWin: boolean) => void;
  isInGracePeriod: boolean;
  gamesPlayed: number;
  hasWon: boolean;
}

export function useAds(): UseAdsReturn {
  const { isPremium } = useSubscription();
  
  const [gamesPlayed, setGamesPlayed] = useState<number>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.GAMES_PLAYED);
    return stored ? parseInt(stored, 10) : 0;
  });
  
  const [hasWon, setHasWon] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_KEYS.HAS_WON) === 'true';
  });

  // Initialize ad service on mount
  useEffect(() => {
    adService.initialize();
  }, []);

  // Grace period: No ads until first win OR 10 games played
  const isInGracePeriod = !hasWon && gamesPlayed < 10;

  // Record a game being played
  const recordGamePlayed = useCallback((didWin: boolean) => {
    const newCount = gamesPlayed + 1;
    setGamesPlayed(newCount);
    localStorage.setItem(STORAGE_KEYS.GAMES_PLAYED, String(newCount));

    if (didWin && !hasWon) {
      setHasWon(true);
      localStorage.setItem(STORAGE_KEYS.HAS_WON, 'true');
    }
  }, [gamesPlayed, hasWon]);

  // Determine if we should show an ad for this result
  const shouldShowAd = useCallback((result: 'win' | 'loss' | 'draw'): boolean => {
    if (isPremium) return false;
    if (isInGracePeriod) return false;
    return result !== 'win';
  }, [isPremium, isInGracePeriod]);

  // Show ad if conditions are met
  const showAdIfNeeded = useCallback(async (result: 'win' | 'loss' | 'draw'): Promise<void> => {
    if (!shouldShowAd(result)) return;

    try {
      await adService.showInterstitial();
    } catch (error) {
      console.error('[useAds] Error showing ad:', error);
    }
  }, [shouldShowAd]);

  return {
    shouldShowAd,
    showAdIfNeeded,
    recordGamePlayed,
    isInGracePeriod,
    gamesPlayed,
    hasWon,
  };
}

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { playerAPI } from '../services/api';
import { useAuth } from './AuthContext';

interface SubscriptionContextType {
  isPremium: boolean;
  isUpgradeModalOpen: boolean;
  openUpgradeModal: () => void;
  closeUpgradeModal: () => void;
  updatePremiumStatus: (newStatus: boolean) => Promise<void>;
  // Dev only - for testing (kept for backward compatibility)
  togglePremiumStatus: () => void;
}

const SubscriptionContext = createContext<SubscriptionContextType | null>(null);

const STORAGE_KEY = 'sudoduel_premium';

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [isPremium, setIsPremium] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  });
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  // Sync to localStorage when premium status changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(isPremium));
  }, [isPremium]);

  const openUpgradeModal = useCallback(() => setIsUpgradeModalOpen(true), []);
  const closeUpgradeModal = useCallback(() => setIsUpgradeModalOpen(false), []);
  
  const togglePremiumStatus = useCallback(() => {
    console.log('[SubscriptionContext] Toggling premium status, current:', isPremium);
    setIsPremium(prev => {
      const newValue = !prev;
      console.log('[SubscriptionContext] New premium value:', newValue);
      localStorage.setItem(STORAGE_KEY, String(newValue));
      return newValue;
    });
  }, [isPremium]);

  return (
    <SubscriptionContext.Provider value={{
      isPremium,
      isUpgradeModalOpen,
      openUpgradeModal,
      closeUpgradeModal,
      togglePremiumStatus,
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  return context;
}

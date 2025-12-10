import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { playerAPI } from '../services/api';
import { useAuth } from './AuthContext';
import { purchaseService, PRODUCT_IDS, type PurchaseResult } from '../services/purchaseService';

interface SubscriptionContextType {
  isPremium: boolean;
  isUpgradeModalOpen: boolean;
  openUpgradeModal: () => void;
  closeUpgradeModal: () => void;
  updatePremiumStatus: (newStatus: boolean) => Promise<void>;
  purchaseSubscription: (plan: 'monthly' | 'yearly') => Promise<PurchaseResult>;
  restorePurchases: () => Promise<PurchaseResult>;
  isProcessingPurchase: boolean;
  // Dev only - for testing (kept for backward compatibility)
  togglePremiumStatus: () => void;
}

const SubscriptionContext = createContext<SubscriptionContextType | null>(null);

const STORAGE_KEY = 'sudoduel_premium';

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { token, user } = useAuth();
  const [isPremium, setIsPremium] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  });
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isProcessingPurchase, setIsProcessingPurchase] = useState(false);

  // Initialize purchase service - deferred
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      purchaseService.initialize();
    }, 2000);
    return () => clearTimeout(timeoutId);
  }, []);

  // Load premium status from backend when user logs in - deferred
  useEffect(() => {
    if (!token || !user) return;
    
    const timeoutId = setTimeout(async () => {
      try {
        const playerInfo = await playerAPI.getMe() as { is_premium?: boolean };
        const backendPremium = playerInfo.is_premium || false;
        setIsPremium(backendPremium);
        localStorage.setItem(STORAGE_KEY, String(backendPremium));
      } catch (error) {
        console.error('[Subscription] Failed to fetch premium status:', error);
        // Keep localStorage value if API call fails
      }
    }, 1000);
    
    return () => clearTimeout(timeoutId);
  }, [token, user?.id]); // Re-fetch when user changes

  // Sync to localStorage when premium status changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(isPremium));
  }, [isPremium]);

  const openUpgradeModal = useCallback(() => setIsUpgradeModalOpen(true), []);
  const closeUpgradeModal = useCallback(() => setIsUpgradeModalOpen(false), []);

  // Update premium status (syncs to backend)
  const updatePremiumStatus = useCallback(async (newStatus: boolean) => {
    try {
      // Update backend first
      await playerAPI.updatePremiumStatus(newStatus);
      
      // Then update local state and localStorage
      setIsPremium(newStatus);
      localStorage.setItem(STORAGE_KEY, String(newStatus));
      
      console.log(`[Subscription] Premium status updated to: ${newStatus}`);
    } catch (error) {
      console.error('[Subscription] Failed to update premium status:', error);
      throw error;
    }
  }, []);
  
  const purchaseSubscription = useCallback(async (plan: 'monthly' | 'yearly'): Promise<PurchaseResult> => {
    setIsProcessingPurchase(true);
    
    try {
      const productId = plan === 'monthly' ? PRODUCT_IDS.MONTHLY : PRODUCT_IDS.YEARLY;
      const result = await purchaseService.purchase(productId);
      
      if (result.success) {
        // Update premium status in backend and local state
        await updatePremiumStatus(true);
        setIsUpgradeModalOpen(false);
      }
      
      return result;
    } catch (error: any) {
      console.error('[Subscription] Purchase failed:', error);
      return {
        success: false,
        error: error.message || 'Purchase failed',
      };
    } finally {
      setIsProcessingPurchase(false);
    }
  }, [updatePremiumStatus]);

  const restorePurchases = useCallback(async (): Promise<PurchaseResult> => {
    setIsProcessingPurchase(true);
    
    try {
      const result = await purchaseService.restorePurchases();
      
      if (result.success) {
        await updatePremiumStatus(true);
      }
      
      return result;
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Restore failed',
      };
    } finally {
      setIsProcessingPurchase(false);
    }
  }, [updatePremiumStatus]);

  // Toggle premium status (for backward compatibility, calls updatePremiumStatus)
  const togglePremiumStatus = useCallback(async () => {
    console.log('[SubscriptionContext] Toggling premium status, current:', isPremium);
    try {
      await updatePremiumStatus(!isPremium);
    } catch (error) {
      console.error('[SubscriptionContext] Failed to toggle premium status:', error);
    }
  }, [isPremium, updatePremiumStatus]);

  return (
    <SubscriptionContext.Provider value={{
      isPremium,
      isUpgradeModalOpen,
      openUpgradeModal,
      closeUpgradeModal,
      updatePremiumStatus,
      purchaseSubscription,
      restorePurchases,
      isProcessingPurchase,
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

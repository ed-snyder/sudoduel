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
  purchaseSubscription: (plan: 'monthly' | 'yearly') => Promise<PurchaseResult>;
  restorePurchases: () => Promise<PurchaseResult>;
  isProcessingPurchase: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | null>(null);

const STORAGE_KEY = 'sudoduel_premium';

// Helper function to play purchase sound (not a hook, can be called from context)
const playPurchaseSound = () => {
  try {
    const audio = new Audio('/sounds/premium/purchased.mp3');
    const volume = parseInt(localStorage.getItem('sudoduel_sfx_volume') || '100', 10);
    audio.volume = volume / 100;
    audio.play().catch(err => console.warn('[Purchase] Could not play sound:', err));
  } catch (e) {
    console.warn('[Purchase] Could not play sound:', e);
  }
};

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
    }, 3000); // Increased from 2000
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
  
  const purchaseSubscription = useCallback(async (plan: 'monthly' | 'yearly'): Promise<PurchaseResult> => {
    setIsProcessingPurchase(true);
    
    try {
      const productId = plan === 'monthly' ? PRODUCT_IDS.MONTHLY : PRODUCT_IDS.YEARLY;
      const result = await purchaseService.purchase(productId);
      
      if (result.success) {
        // Validate the receipt with the backend
        if (result.receipt) {
          try {
            const validation = await playerAPI.validatePremiumPurchase(result.receipt, 'ios');
            if (validation.success && validation.is_premium) {
              // Play purchase success sound
              playPurchaseSound();
              // Update local state
              setIsPremium(true);
              localStorage.setItem(STORAGE_KEY, 'true');
              setIsUpgradeModalOpen(false);
              console.log('[Subscription] Premium validated with backend');
              return result;
            } else {
              console.error('[Subscription] Backend validation failed:', validation.error);
              return {
                success: false,
                error: validation.error || 'Failed to validate purchase with server',
              };
            }
          } catch (error: any) {
            console.error('[Subscription] Failed to validate with backend:', error);
            // Purchase went through with Apple but backend validation failed
            // Still mark as premium locally (Apple is source of truth)
            playPurchaseSound();
            setIsPremium(true);
            localStorage.setItem(STORAGE_KEY, 'true');
            setIsUpgradeModalOpen(false);
            return result;
          }
        } else {
          // No receipt available (shouldn't happen on real device)
          console.warn('[Subscription] Purchase succeeded but no receipt available');
          playPurchaseSound();
          setIsPremium(true);
          localStorage.setItem(STORAGE_KEY, 'true');
          setIsUpgradeModalOpen(false);
        }
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
  }, []);

  const restorePurchases = useCallback(async (): Promise<PurchaseResult> => {
    setIsProcessingPurchase(true);
    
    try {
      const result = await purchaseService.restorePurchases();
      
      if (result.success && result.receipt) {
        // Validate the receipt with the backend
        try {
          const validation = await playerAPI.restorePremium(result.receipt, 'ios');
          if (validation.success && validation.is_premium) {
            playPurchaseSound();
            setIsPremium(true);
            localStorage.setItem(STORAGE_KEY, 'true');
            console.log('[Subscription] Premium restored and validated with backend');
            return result;
          } else {
            return {
              success: false,
              error: validation.error || 'No active subscription found',
            };
          }
        } catch (error: any) {
          console.error('[Subscription] Failed to validate restore with backend:', error);
          // Restore succeeded with Apple - trust that
          playPurchaseSound();
          setIsPremium(true);
          localStorage.setItem(STORAGE_KEY, 'true');
          return result;
        }
      } else if (result.success) {
        // Restore succeeded but no receipt
        console.warn('[Subscription] Restore succeeded but no receipt available');
        playPurchaseSound();
        setIsPremium(true);
        localStorage.setItem(STORAGE_KEY, 'true');
        return result;
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
  }, []);

  return (
    <SubscriptionContext.Provider value={{
      isPremium,
      isUpgradeModalOpen,
      openUpgradeModal,
      closeUpgradeModal,
      purchaseSubscription,
      restorePurchases,
      isProcessingPurchase,
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

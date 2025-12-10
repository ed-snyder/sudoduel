import { useState, useEffect } from 'react';
import { useSubscription } from '../context/SubscriptionContext';
import { purchaseService, PRODUCT_IDS } from '../services/purchaseService';

export default function UpgradeModal() {
  const { isUpgradeModalOpen, closeUpgradeModal, purchaseSubscription, restorePurchases: contextRestorePurchases } = useSubscription();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [monthlyPrice, setMonthlyPrice] = useState('$4.99');
  const [yearlyPrice, setYearlyPrice] = useState('$29.99');
  const [isLoading, setIsLoading] = useState(true);

  // Initialize purchase service and load prices when modal opens
  useEffect(() => {
    if (isUpgradeModalOpen) {
      setError(null);
      setIsLoading(true);
      
      const loadProducts = async () => {
        try {
          await purchaseService.initialize();
          
          const monthly = purchaseService.getProduct(PRODUCT_IDS.MONTHLY);
          const yearly = purchaseService.getProduct(PRODUCT_IDS.YEARLY);
          
          if (monthly?.price) setMonthlyPrice(monthly.price);
          if (yearly?.price) setYearlyPrice(yearly.price);
        } catch (err) {
          console.error('[UpgradeModal] Failed to load products:', err);
        } finally {
          setIsLoading(false);
        }
      };
      
      loadProducts();
    }
  }, [isUpgradeModalOpen]);

  if (!isUpgradeModalOpen) return null;

  const handlePurchase = async (plan: 'monthly' | 'yearly') => {
    if (isProcessing || isRestoring) return;
    
    setIsProcessing(true);
    setError(null);
    
    try {
      console.log(`[UpgradeModal] Purchasing ${plan}...`);
      
      // Use context method which handles premium status update
      const result = await purchaseSubscription(plan);
      console.log('[UpgradeModal] Purchase result:', result);
      
      if (result.success) {
        console.log('[UpgradeModal] Purchase successful! Modal closing...');
        closeUpgradeModal();
      } else {
        setError(result.error || 'Purchase failed. Please try again.');
      }
    } catch (err: any) {
      console.error('[UpgradeModal] Purchase error:', err);
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestore = async () => {
    if (isProcessing || isRestoring) return;
    
    setIsRestoring(true);
    setError(null);
    
    try {
      console.log('[UpgradeModal] Restoring purchases...');
      // Use context method which handles premium status update
      const result = await contextRestorePurchases();
      console.log('[UpgradeModal] Restore result:', result);
      
      if (result.success) {
        console.log('[UpgradeModal] Restored! Modal closing...');
        closeUpgradeModal();
      } else {
        setError(result.error || 'No active subscription found.');
      }
    } catch (err: any) {
      console.error('[UpgradeModal] Restore error:', err);
      setError(err.message || 'Failed to restore purchases.');
    } finally {
      setIsRestoring(false);
    }
  };

  const isDisabled = isProcessing || isRestoring || isLoading;

  return (
    <div 
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      onClick={closeUpgradeModal}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-void/95 backdrop-blur-sm" />
      
      {/* Modal */}
      <div 
        className="relative bg-surface border-2 rounded-xl w-full max-w-md overflow-hidden animate-scale-in max-h-[90vh] overflow-y-auto"
        style={{ 
          boxShadow: '0 0 30px rgba(139,0,255,0.3)',
          borderColor: 'rgba(255, 215, 0, 0.6)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={closeUpgradeModal}
          className="absolute top-4 right-4 text-muted hover:text-secondary transition-colors z-10"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="px-6 pt-6 pb-4 text-center">
          <h2 
            className="font-heading font-black text-3xl uppercase tracking-wider"
            style={{
              background: 'linear-gradient(90deg, #FFD700 0%, #FFA500 50%, #FFD700 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            SUDODUEL+
          </h2>
        </div>

        {/* Content */}
        <div className="px-6 pb-6 space-y-4">
          {/* Benefits */}
          <div className="space-y-3">
            <div>
              <h3 className="font-heading font-bold text-base text-primary">Custom Emotes</h3>
              <p className="font-body text-secondary text-sm italic">
                Say <em>whatever</em> you want
              </p>
            </div>

            <div>
              <h3 className="font-heading font-bold text-base text-primary">No Ads</h3>
              <p className="font-body text-secondary text-sm italic">
                Improve your UX AND lower our hosting costs ;)
              </p>
            </div>

            <div>
              <h3 className="font-heading font-bold text-base text-primary">Global Ranking & Leaderboard</h3>
              <p className="font-body text-secondary text-sm italic">
                Get the recognition you deserve.
              </p>
            </div>

            <div>
              <h3 className="font-heading font-bold text-base text-primary">Advanced Stats</h3>
              <p className="font-body text-secondary text-sm italic">
                Use them to improve, or brag
              </p>
            </div>

            <div>
              <h3 className="font-heading font-bold text-base text-primary">Premium Name Styling</h3>
              <p className="font-body text-secondary text-sm italic">
                Stunt on em
              </p>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="p-3 rounded-lg bg-error/10 border border-error/30">
              <p className="text-error text-sm text-center font-body">{error}</p>
            </div>
          )}

          {/* Purchase Options */}
          <div className="pt-2 space-y-3">
            {/* Monthly button */}
            <button
              onClick={() => handlePurchase('monthly')}
              disabled={isDisabled}
              className="w-full py-4 px-6 rounded-xl font-body font-bold text-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: 'rgba(139, 69, 19, 0.4)',
                border: '2px solid rgba(255, 215, 0, 0.6)',
                color: '#FFD700',
              }}
            >
              {isProcessing ? 'Processing...' : isLoading ? 'Loading...' : `${monthlyPrice} / month`}
            </button>

            {/* Yearly button with badge */}
            <div className="relative">
              <button
                onClick={() => handlePurchase('yearly')}
                disabled={isDisabled}
                className="w-full py-4 px-6 rounded-xl font-body font-bold text-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: 'rgba(139, 69, 19, 0.4)',
                  border: '2px solid rgba(255, 215, 0, 0.6)',
                  color: '#FFD700',
                }}
              >
                {isLoading ? 'Loading...' : `${yearlyPrice} / year`}
              </button>
              {/* Best Value badge */}
              <span 
                className="absolute -top-0 right-4 transform translate-y-[-50%] px-2 py-0.5 rounded text-xs font-bold uppercase"
                style={{
                  background: '#FFD700',
                  color: '#000',
                }}
              >
                BEST VALUE
              </span>
            </div>

            {/* Restore purchases */}
            <button
              onClick={handleRestore}
              disabled={isDisabled}
              className="w-full py-2 text-center font-body text-sm text-secondary hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRestoring ? 'Restoring...' : 'Restore Purchases'}
            </button>
          </div>

          {/* Legal text */}
          <div className="pt-2 space-y-2">
            <p className="text-center text-muted font-body text-xs leading-relaxed">
              Payment will be charged to your Apple ID account at confirmation of purchase. 
              Subscription automatically renews unless canceled at least 24 hours before the end of the current period. 
              Manage subscriptions in Account Settings.
            </p>
            <p className="text-center text-muted font-body text-xs">
              <a href="https://sudoduel.com/privacy" className="underline hover:text-secondary">Privacy Policy</a>
              {' · '}
              <a href="https://sudoduel.com/terms" className="underline hover:text-secondary">Terms of Service</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

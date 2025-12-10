import { useState, useEffect } from 'react';
import { useSubscription } from '../context/SubscriptionContext';
import { purchaseService, PRODUCT_IDS } from '../services/purchaseService';

// UPDATE THESE WITH YOUR ACTUAL URLs
const PRIVACY_POLICY_URL = 'https://www.notion.so/SudoDuel-Privacy-Policy-2c3c4dad9ac880758129d0d10ab5d59b';
const TERMS_OF_SERVICE_URL = 'https://www.notion.so/SudoDuel-Terms-of-Service-2c3c4dad9ac8808ab570cc280a115aaf';

export default function UpgradeModal() {
  const {
    isUpgradeModalOpen,
    closeUpgradeModal,
    purchaseSubscription,
    restorePurchases,
    isProcessingPurchase,
  } = useSubscription();

  const [error, setError] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [monthlyPrice, setMonthlyPrice] = useState('$3.99');
  const [yearlyPrice, setYearlyPrice] = useState('$29.99');

  // Load real prices from StoreKit when modal opens
  useEffect(() => {
    if (isUpgradeModalOpen) {
      const loadPrices = async () => {
        await purchaseService.initialize();
        const monthly = purchaseService.getProduct(PRODUCT_IDS.MONTHLY);
        const yearly = purchaseService.getProduct(PRODUCT_IDS.YEARLY);
        if (monthly?.price) setMonthlyPrice(monthly.price);
        if (yearly?.price) setYearlyPrice(yearly.price);
      };
      loadPrices();
    }
  }, [isUpgradeModalOpen]);

  if (!isUpgradeModalOpen) return null;

  const handlePurchase = async (plan: 'monthly' | 'yearly') => {
    setError(null);
    console.log(`[UpgradeModal] Purchasing ${plan} plan...`);
    
    const result = await purchaseSubscription(plan);

    if (!result.success) {
      console.log('[UpgradeModal] Purchase failed:', result.error);
      setError(result.error || 'Purchase failed. Please try again.');
    } else {
      console.log(`[UpgradeModal] Purchased ${plan} plan successfully`);
    }
  };

  const handleRestore = async () => {
    setError(null);
    setIsRestoring(true);
    console.log('[UpgradeModal] Restoring purchases...');

    const result = await restorePurchases();

    if (!result.success) {
      setError(result.error || 'No active subscription found.');
    } else {
      console.log('[UpgradeModal] Restore successful');
    }

    setIsRestoring(false);
  };

  const openURL = (url: string) => {
    window.open(url, '_blank');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={closeUpgradeModal}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-void/90 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative bg-surface border-2 border-gold/50 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-scale-in"
        style={{ boxShadow: '0 0 40px rgba(255,215,0,0.3)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={closeUpgradeModal}
          className="absolute top-4 right-4 z-10 text-muted hover:text-primary transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="px-6 pt-6 pb-4 text-center border-b border-grid-line">
          <div className="text-4xl mb-2">👑</div>
          <h2 className="text-2xl font-display font-black text-gold">SUDODUEL+</h2>
          <p className="text-muted text-sm font-body mt-1">Unlock the full experience</p>
        </div>

        {/* Features */}
        <div className="px-6 py-4">
          <ul className="space-y-3">
            {[
              'Ad-free experience',
              'Premium statistics & analytics',
              'Custom emotes',
              'Exclusive leaderboard badge',
              'Priority matchmaking',
            ].map((feature, index) => (
              <li key={index} className="flex items-center gap-3">
                <span className="text-gold">✓</span>
                <span className="text-primary text-sm font-body">{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-6 mb-4 p-3 bg-error/10 border border-error/50 rounded-lg">
            <p className="text-error text-sm text-center font-body">{error}</p>
          </div>
        )}

        {/* Pricing Buttons */}
        <div className="px-6 pb-4 space-y-3">
          {/* Monthly */}
          <button
            onClick={() => handlePurchase('monthly')}
            disabled={isProcessingPurchase || isRestoring}
            className="w-full py-4 px-6 rounded-xl font-display font-bold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, rgba(255,215,0,0.1) 0%, rgba(255,165,0,0.1) 100%)',
              border: '2px solid rgba(255,215,0,0.4)',
              color: '#FFD700',
            }}
          >
            {isProcessingPurchase ? 'Processing...' : `${monthlyPrice} / month`}
          </button>

          {/* Yearly */}
          <button
            onClick={() => handlePurchase('yearly')}
            disabled={isProcessingPurchase || isRestoring}
            className="w-full py-4 px-6 rounded-xl font-display font-bold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed relative"
            style={{
              background: 'linear-gradient(135deg, rgba(255,215,0,0.2) 0%, rgba(255,165,0,0.2) 100%)',
              border: '2px solid rgba(255,215,0,0.6)',
              color: '#FFD700',
              boxShadow: '0 0 20px rgba(255,215,0,0.2)',
            }}
          >
            <span className="absolute -top-2 -right-2 bg-gold text-void text-xs font-bold px-2 py-1 rounded-full">
              SAVE 37%
            </span>
            {isProcessingPurchase ? 'Processing...' : `${yearlyPrice} / year`}
          </button>
        </div>

        {/* Restore Purchases Button */}
        <div className="px-6 pb-4">
          <button
            onClick={handleRestore}
            disabled={isProcessingPurchase || isRestoring}
            className="w-full py-2 text-muted text-sm font-body hover:text-primary transition-colors disabled:opacity-50"
          >
            {isRestoring ? 'Restoring...' : 'Restore Purchases'}
          </button>
        </div>

        {/* Apple Required Legal Disclosure */}
        <div className="px-6 pb-6">
          <div className="bg-void/50 rounded-lg p-3 border border-grid-line/30">
            <p className="text-[10px] text-muted/80 font-body text-center leading-relaxed">
              Payment will be charged to your Apple ID account at confirmation of purchase.
              Subscription automatically renews unless canceled at least 24 hours before
              the end of the current period. Your account will be charged for renewal
              within 24 hours prior to the end of the current period. You can manage
              and cancel your subscriptions by going to your Account Settings on the
              App Store after purchase.
            </p>
            <div className="flex justify-center gap-3 mt-3 pt-2 border-t border-grid-line/30">
              <button
                onClick={() => openURL(PRIVACY_POLICY_URL)}
                className="text-[11px] text-player/80 font-body underline hover:text-player transition-colors"
              >
                Privacy Policy
              </button>
              <span className="text-muted/50">•</span>
              <button
                onClick={() => openURL(TERMS_OF_SERVICE_URL)}
                className="text-[11px] text-player/80 font-body underline hover:text-player transition-colors"
              >
                Terms of Service
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

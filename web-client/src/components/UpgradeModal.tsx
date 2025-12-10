import { useState, useEffect } from 'react';
import { useSubscription } from '../context/SubscriptionContext';
import { purchaseService, PRODUCT_IDS } from '../services/purchaseService';

const PRIVACY_POLICY_URL = 'https://sudoduel.com/privacy';
const TERMS_OF_SERVICE_URL = 'https://sudoduel.com/terms';

const FEATURES = [
  {
    title: 'Custom Emotes',
    subtitle: <>Say <em>whatever</em> you want</>,
  },
  {
    title: 'No Ads',
    subtitle: 'Improve your UX AND lower our hosting costs ;)',
  },
  {
    title: 'Global Ranking & Leaderboard',
    subtitle: 'Get the recognition you deserve.',
  },
  {
    title: 'Advanced Stats',
    subtitle: 'Use them to improve, or brag',
  },
  {
    title: 'Premium Name Styling',
    subtitle: 'Stunt on em',
  },
];

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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isUpgradeModalOpen) {
      setError(null);
      setIsLoading(true);
      
      const loadPrices = async () => {
        await purchaseService.initialize();
        const monthly = purchaseService.getProduct(PRODUCT_IDS.MONTHLY);
        const yearly = purchaseService.getProduct(PRODUCT_IDS.YEARLY);
        if (monthly?.price) setMonthlyPrice(monthly.price);
        if (yearly?.price) setYearlyPrice(yearly.price);
        setIsLoading(false);
      };
      
      loadPrices();
    }
  }, [isUpgradeModalOpen]);

  if (!isUpgradeModalOpen) return null;

  const handlePurchase = async (plan: 'monthly' | 'yearly') => {
    setError(null);
    console.log(`[UpgradeModal] Purchasing ${plan}...`);

    const result = await purchaseSubscription(plan);

    if (!result.success) {
      setError(result.error || 'Purchase failed. Please try again.');
    } else {
      console.log(`[UpgradeModal] Success!`);
    }
  };

  const handleRestore = async () => {
    setError(null);
    setIsRestoring(true);

    const result = await restorePurchases();

    if (!result.success) {
      setError(result.error || 'No active subscription found.');
    }

    setIsRestoring(false);
  };

  const openURL = (url: string) => {
    window.open(url, '_blank');
  };

  const isDisabled = isProcessingPurchase || isRestoring || isLoading;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={closeUpgradeModal}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative bg-surface rounded-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto"
        style={{
          border: '2px solid rgba(255,215,0,0.5)',
          boxShadow: '0 0 30px rgba(255,215,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={closeUpgradeModal}
          className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-void/50 text-muted hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header - No Crown */}
        <div className="px-6 pt-6 pb-4 text-center">
          <h2
            className="text-2xl font-display font-black tracking-wide"
            style={{
              background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            SUDODUEL+
          </h2>
        </div>

        {/* Features with Custom Copy */}
        <div className="px-6 pb-5">
          <div className="space-y-4">
            {FEATURES.map((feature, index) => (
              <div key={index}>
                <div className="text-white font-display font-bold text-sm">
                  {feature.title}
                </div>
                <div className="text-muted text-xs font-body mt-0.5">
                  {feature.subtitle}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-6 mb-3 p-3 bg-error/20 border border-error/50 rounded-lg">
            <p className="text-error text-sm text-center font-body">{error}</p>
          </div>
        )}

        {/* Pricing Buttons */}
        <div className="px-6 pb-3 space-y-2">
          {/* Monthly */}
          <button
            onClick={() => handlePurchase('monthly')}
            disabled={isDisabled}
            className="w-full py-3 rounded-xl font-display font-bold text-lg transition-all active:scale-[0.98] disabled:opacity-50"
            style={{
              background: 'linear-gradient(135deg, rgba(255,215,0,0.15) 0%, rgba(255,165,0,0.15) 100%)',
              border: '2px solid rgba(255,215,0,0.5)',
              color: '#FFD700',
            }}
          >
            {isProcessingPurchase ? 'Processing...' : isLoading ? 'Loading...' : `${monthlyPrice} / month`}
          </button>

          {/* Yearly */}
          <button
            onClick={() => handlePurchase('yearly')}
            disabled={isDisabled}
            className="w-full py-3 rounded-xl font-display font-bold text-lg transition-all active:scale-[0.98] disabled:opacity-50 relative"
            style={{
              background: 'linear-gradient(135deg, rgba(255,215,0,0.25) 0%, rgba(255,165,0,0.25) 100%)',
              border: '2px solid rgba(255,215,0,0.7)',
              color: '#FFD700',
              boxShadow: '0 0 15px rgba(255,215,0,0.15)',
            }}
          >
            <span
              className="absolute -top-2 right-3 text-xs font-bold px-2 py-0.5 rounded-full"
              style={{
                background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                color: '#000',
              }}
            >
              BEST VALUE
            </span>
            {isProcessingPurchase ? 'Processing...' : isLoading ? 'Loading...' : `${yearlyPrice} / year`}
          </button>
        </div>

        {/* Restore Purchases */}
        <div className="px-6 pb-3">
          <button
            onClick={handleRestore}
            disabled={isDisabled}
            className="w-full py-2 text-muted text-sm font-body hover:text-white transition-colors disabled:opacity-50"
          >
            {isRestoring ? 'Restoring...' : 'Restore Purchases'}
          </button>
        </div>

        {/* Legal Disclosure */}
        <div className="px-4 pb-4">
          <p className="text-[9px] text-muted/60 font-body text-center leading-relaxed">
            Payment will be charged to your Apple ID account at confirmation of purchase.
            Subscription automatically renews unless canceled at least 24 hours before
            the end of the current period. Manage subscriptions in Account Settings.
          </p>
          <div className="flex justify-center gap-2 mt-2">
            <button
              onClick={() => openURL(PRIVACY_POLICY_URL)}
              className="text-[10px] text-muted/70 font-body underline hover:text-white"
            >
              Privacy Policy
            </button>
            <span className="text-muted/40 text-[10px]">•</span>
            <button
              onClick={() => openURL(TERMS_OF_SERVICE_URL)}
              className="text-[10px] text-muted/70 font-body underline hover:text-white"
            >
              Terms of Service
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useSubscription } from '../context/SubscriptionContext';

export default function UpgradeModal() {
  const { isUpgradeModalOpen, closeUpgradeModal, updatePremiumStatus } = useSubscription();
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isUpgradeModalOpen) return null;

  const handlePurchase = async (plan: 'monthly' | 'yearly') => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    try {
      console.log(`[UpgradeModal] Purchasing ${plan} plan...`);
      // In production, this would go through App Store / Google Play
      // For now, directly update premium status
      await updatePremiumStatus(true);
      console.log(`[UpgradeModal] Purchased ${plan} plan successfully`);
      closeUpgradeModal();
    } catch (error) {
      console.error('[UpgradeModal] Purchase failed:', error);
      // TODO: Show error toast to user
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      onClick={closeUpgradeModal}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-void/95 backdrop-blur-sm" />
      
      {/* Modal */}
      <div 
        className="relative bg-surface border border-grid-line rounded-xl w-full max-w-md overflow-hidden animate-scale-in"
        style={{ boxShadow: '0 0 30px rgba(139,0,255,0.2)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-grid-line">
          <h2 className="font-heading font-bold text-2xl text-player">Sudoduel+</h2>
          <button
            onClick={closeUpgradeModal}
            className="text-muted hover:text-secondary transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-4">
          {/* Benefits */}
          <div className="space-y-4">
            <div>
              <h3 className="font-heading font-bold text-lg text-primary mb-1">Custom Emotes</h3>
              <p className="font-body text-secondary text-sm">
                Say <em>whatever</em> you want
              </p>
            </div>

            <div>
              <h3 className="font-heading font-bold text-lg text-primary mb-1">No Ads</h3>
              <p className="font-body text-secondary text-sm">
                Help us with hosting fees AND improve your UX
              </p>
            </div>

            <div>
              <h3 className="font-heading font-bold text-lg text-primary mb-1">Global Ranking and Leaderboard</h3>
              <p className="font-body text-secondary text-sm">
                Get the recognition you deserve
              </p>
            </div>

            <div>
              <h3 className="font-heading font-bold text-lg text-primary mb-1">Premium Animated Name</h3>
              <p className="font-body text-secondary text-sm">
                Stunt on em
              </p>
            </div>

            <div>
              <h3 className="font-heading font-bold text-lg text-primary mb-1">Advanced Stats</h3>
              <p className="font-body text-secondary text-sm">
                Use them to improve, or brag
              </p>
            </div>
          </div>

          {/* Purchase Options */}
          <div className="pt-4 space-y-3">
            <button
              onClick={() => handlePurchase('monthly')}
              disabled={isProcessing}
              className="w-full py-4 px-6 rounded-xl font-body font-bold text-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: 'rgba(0, 255, 255, 0.1)',
                border: '2px solid rgba(0, 255, 255, 0.5)',
                color: '#00FFFF',
                boxShadow: '0 0 20px rgba(0, 255, 255, 0.3)',
              }}
            >
              {isProcessing ? 'Processing...' : '$3.99/month'}
            </button>

            <button
              onClick={() => handlePurchase('yearly')}
              disabled={isProcessing}
              className="w-full text-center font-body text-sm text-secondary hover:text-player transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              $29.99/year (save 37%)
            </button>
          </div>

          {/* Footer */}
          <p className="text-center text-muted font-body text-xs pt-2">
            Cancel or restore your purchase anytime.
          </p>
        </div>
      </div>
    </div>
  );
}

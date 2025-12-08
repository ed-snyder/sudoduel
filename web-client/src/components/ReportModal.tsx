import { useState } from 'react';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerName: string;
  playerId: number;
  onSubmitReport: (playerId: number, reason: string) => Promise<void>;
}

const REPORT_REASONS = [
  { id: 'cheating', label: 'Cheating', description: 'Using external tools or exploits' },
  { id: 'offensive_content', label: 'Offensive Content', description: 'Inappropriate username or behavior' },
];

export default function ReportModal({
  isOpen,
  onClose,
  playerName,
  playerId,
  onSubmitReport,
}: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!selectedReason) return;
    
    setIsLoading(true);
    setStatus('idle');
    setErrorMessage('');
    
    try {
      await onSubmitReport(playerId, selectedReason);
      setStatus('success');
      // Auto-close after success
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (error: any) {
      setStatus('error');
      setErrorMessage(error.message || 'Failed to submit report');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    // Reset state after close
    setTimeout(() => {
      setSelectedReason(null);
      setStatus('idle');
      setErrorMessage('');
    }, 200);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[2100] flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-void/90 backdrop-blur-sm" />
      
      {/* Modal */}
      <div 
        className="relative w-full max-w-sm rounded-2xl border-2 border-error/50 overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, rgba(26, 6, 64, 0.98) 0%, rgba(18, 3, 48, 0.99) 100%)',
          boxShadow: '0 0 40px rgba(255, 51, 102, 0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-error/30">
          <h3 className="font-heading font-bold text-lg text-error text-center">
            Report Player
          </h3>
          <p className="font-body text-sm text-secondary text-center mt-1 truncate">
            {playerName}
          </p>
        </div>
        
        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Success Message */}
          {status === 'success' && (
            <div className="text-center py-4">
              <div className="text-success text-4xl mb-2">✓</div>
              <div className="text-success font-body font-semibold">Report Submitted</div>
              <div className="text-secondary font-body text-sm mt-1">Thank you for helping keep SudoDuel fair</div>
            </div>
          )}
          
          {/* Error Message */}
          {status === 'error' && (
            <div className="text-center py-2 text-error font-body">
              {errorMessage}
            </div>
          )}
          
          {/* Report Form */}
          {status !== 'success' && (
            <>
              {/* Reason Selection */}
              <div className="space-y-2">
                <label className="font-body text-sm text-secondary">
                  Reason for report
                </label>
                {REPORT_REASONS.map((reason) => (
                  <button
                    key={reason.id}
                    onClick={() => setSelectedReason(reason.id)}
                    className={`w-full py-3 px-4 rounded-xl text-left transition-all touch-manipulation ${
                      selectedReason === reason.id 
                        ? 'border-error bg-error/20' 
                        : 'border-accent/30 bg-surface/50'
                    }`}
                    style={{
                      border: `2px solid ${selectedReason === reason.id ? 'rgba(255, 51, 102, 0.7)' : 'rgba(139, 0, 255, 0.3)'}`,
                    }}
                  >
                    <div className="font-body font-semibold text-primary">
                      {reason.label}
                    </div>
                    <div className="font-body text-xs text-muted mt-0.5">
                      {reason.description}
                    </div>
                  </button>
                ))}
              </div>
              
              {/* Submit Button */}
              <button
                onClick={handleSubmit}
                disabled={!selectedReason || isLoading}
                className="w-full py-3 px-4 rounded-xl font-body font-bold text-base transition-all touch-manipulation disabled:opacity-50"
                style={{
                  background: selectedReason ? 'rgba(255, 51, 102, 0.3)' : 'rgba(255, 51, 102, 0.1)',
                  border: '2px solid rgba(255, 51, 102, 0.6)',
                  color: '#FF3366',
                  boxShadow: selectedReason ? '0 0 20px rgba(255, 51, 102, 0.3)' : 'none',
                }}
              >
                {isLoading ? 'Submitting...' : 'Submit Report'}
              </button>
            </>
          )}
          
          {/* Cancel Button */}
          <button
            onClick={handleClose}
            className="w-full py-3 px-4 rounded-xl font-body font-semibold text-base transition-all touch-manipulation"
            style={{
              background: 'rgba(139, 0, 255, 0.15)',
              border: '2px solid rgba(139, 0, 255, 0.4)',
              color: '#B8A8D4',
            }}
          >
            {status === 'success' ? 'Close' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
}

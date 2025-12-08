import { useState } from 'react';

interface PlayerActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerName: string;
  playerId: number;
  onAddFriend: (playerId: number) => Promise<void>;
  onReport: (playerId: number) => void; // Opens report modal
}

export default function PlayerActionModal({
  isOpen,
  onClose,
  playerName,
  playerId,
  onAddFriend,
  onReport,
}: PlayerActionModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error' | 'already_friends' | 'pending'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleAddFriend = async () => {
    setIsLoading(true);
    setStatus('idle');
    setErrorMessage('');
    
    try {
      await onAddFriend(playerId);
      setStatus('success');
      // Auto-close after success
      setTimeout(() => {
        onClose();
        setStatus('idle');
      }, 1500);
    } catch (error: any) {
      if (error.message?.includes('already friends')) {
        setStatus('already_friends');
      } else if (error.message?.includes('pending')) {
        setStatus('pending');
      } else {
        setStatus('error');
        setErrorMessage(error.message || 'Failed to send friend request');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleReport = () => {
    onReport(playerId);
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
      setStatus('idle');
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-void/90 backdrop-blur-sm" />
      
      {/* Modal */}
      <div 
        className="relative w-full max-w-xs rounded-2xl border-2 border-accent/50 overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, rgba(26, 6, 64, 0.98) 0%, rgba(18, 3, 48, 0.99) 100%)',
          boxShadow: '0 0 40px rgba(139, 0, 255, 0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-accent/30">
          <h3 className="font-heading font-bold text-lg text-primary text-center truncate">
            {playerName}
          </h3>
        </div>
        
        {/* Content */}
        <div className="p-4 space-y-3">
          {/* Status Messages */}
          {status === 'success' && (
            <div className="text-center py-2 text-success font-body">
              ✓ Friend request sent!
            </div>
          )}
          
          {status === 'already_friends' && (
            <div className="text-center py-2 text-player font-body">
              Already friends!
            </div>
          )}
          
          {status === 'pending' && (
            <div className="text-center py-2 text-warning font-body">
              Request already pending
            </div>
          )}
          
          {status === 'error' && (
            <div className="text-center py-2 text-error font-body">
              {errorMessage}
            </div>
          )}
          
          {/* Buttons */}
          {status === 'idle' && (
            <>
              {/* Add Friend Button */}
              <button
                onClick={handleAddFriend}
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl font-body font-semibold text-base transition-all touch-manipulation disabled:opacity-50"
                style={{
                  background: 'rgba(0, 255, 255, 0.15)',
                  border: '2px solid rgba(0, 255, 255, 0.5)',
                  color: '#00FFFF',
                  boxShadow: '0 0 15px rgba(0, 255, 255, 0.2)',
                }}
              >
                {isLoading ? 'Sending...' : '+ Add Friend'}
              </button>
              
              {/* Report Button */}
              <button
                onClick={handleReport}
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl font-body font-semibold text-base transition-all touch-manipulation disabled:opacity-50"
                style={{
                  background: 'rgba(255, 51, 102, 0.15)',
                  border: '2px solid rgba(255, 51, 102, 0.5)',
                  color: '#FF3366',
                }}
              >
                Report Player
              </button>
            </>
          )}
          
          {/* Close/Cancel Button */}
          <button
            onClick={() => {
              onClose();
              setStatus('idle');
            }}
            className="w-full py-3 px-4 rounded-xl font-body font-semibold text-base transition-all touch-manipulation"
            style={{
              background: 'rgba(139, 0, 255, 0.15)',
              border: '2px solid rgba(139, 0, 255, 0.4)',
              color: '#B8A8D4',
            }}
          >
            {status === 'idle' ? 'Cancel' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}

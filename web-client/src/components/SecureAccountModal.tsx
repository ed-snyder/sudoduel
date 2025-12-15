import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { oauthService } from '../services/oauthService';

interface SecureAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SecureAccountModal({ isOpen, onClose }: SecureAccountModalProps) {
  const { linkGoogle, linkApple } = useAuth();
  const [loading, setLoading] = useState<'google' | 'apple' | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [googleAvailable, setGoogleAvailable] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    setGoogleAvailable(oauthService.isGoogleAvailable());
    setAppleAvailable(oauthService.isAppleAvailable());
  }, []);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setLoading(null);
      setError('');
      setSuccess(false);
    }
  }, [isOpen]);

  // Auto-close after success
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        onClose();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [success, onClose]);

  const handleLinkGoogle = async () => {
    setError('');
    setLoading('google');
    try {
      const result = await linkGoogle();
      if (result.success) {
        setSuccess(true);
      } else {
        // User cancelled
        setLoading(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to link Google account');
      setLoading(null);
    }
  };

  const handleLinkApple = async () => {
    setError('');
    setLoading('apple');
    try {
      const result = await linkApple();
      if (result.success) {
        setSuccess(true);
      } else {
        // User cancelled
        setLoading(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to link Apple account');
      setLoading(null);
    }
  };

  if (!isOpen) return null;

  const isLoading = loading !== null;

  return (
    <div className="fixed inset-0 bg-void/95 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div 
        className="bg-surface border border-grid-line rounded-xl p-6 max-w-sm w-full shadow-2xl animate-scale-in"
        style={{ boxShadow: '0 0 40px rgba(0,255,136,0.1)' }}
      >
        {success ? (
          // Success State
          <div className="text-center py-4">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-player/20 border-2 border-player flex items-center justify-center">
              <CheckIcon className="w-8 h-8 text-player" />
            </div>
            <h2 className="text-xl font-heading font-bold text-player mb-2">
              Account Secured!
            </h2>
            <p className="text-secondary text-sm font-body">
              Your progress is now saved forever
            </p>
          </div>
        ) : (
          // Link Account State
          <>
            {/* Header */}
            <div className="text-center mb-6">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-amber-500/20 border border-amber-500/50 flex items-center justify-center">
                <ShieldIcon className="w-6 h-6 text-amber-400" />
              </div>
              <h2 className="text-xl font-heading font-bold text-primary mb-1">
                Secure Your Account
              </h2>
              <p className="text-secondary text-sm font-body">
                Link to keep your progress forever
              </p>
            </div>

            {/* Error Display */}
            {error && (
              <div 
                className="mb-4 px-4 py-3 bg-error/10 border border-error/50 rounded-lg animate-shake"
                style={{ boxShadow: '0 0 15px rgba(255,51,102,0.2)' }}
              >
                <p className="text-error text-sm font-body text-center">{error}</p>
              </div>
            )}

            {/* Link Buttons */}
            <div className="space-y-3 mb-4">
              {/* Apple Button - iOS only */}
              {appleAvailable && (
                <button
                  onClick={handleLinkApple}
                  disabled={isLoading}
                  className="w-full py-3.5 bg-white text-black font-body font-semibold rounded-lg flex items-center justify-center gap-3 hover:bg-gray-100 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {loading === 'apple' ? (
                    <LoadingSpinner color="black" />
                  ) : (
                    <>
                      <AppleLogo />
                      <span>Continue with Apple</span>
                    </>
                  )}
                </button>
              )}

              {/* Google Button - Native only */}
              {googleAvailable && (
                <button
                  onClick={handleLinkGoogle}
                  disabled={isLoading}
                  className="w-full py-3.5 bg-white border border-gray-300 text-gray-700 font-body font-semibold rounded-lg flex items-center justify-center gap-3 hover:bg-gray-50 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {loading === 'google' ? (
                    <LoadingSpinner color="gray" />
                  ) : (
                    <>
                      <GoogleLogo />
                      <span>Continue with Google</span>
                    </>
                  )}
                </button>
              )}

              {/* Fallback if no OAuth available */}
              {!googleAvailable && !appleAvailable && (
                <p className="text-muted text-sm text-center font-body py-4">
                  Sign in options are only available in the mobile app.
                </p>
              )}
            </div>

            {/* Cancel Button */}
            <button
              onClick={onClose}
              disabled={isLoading}
              className="w-full py-3 bg-transparent border border-grid-line text-secondary font-body font-semibold rounded-lg hover:border-muted hover:text-primary disabled:opacity-50 transition-all"
            >
              Maybe Later
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// Loading Spinner Component
function LoadingSpinner({ color }: { color: 'black' | 'gray' }) {
  const colorClass = color === 'black' ? 'text-black' : 'text-gray-500';
  return (
    <svg className={`animate-spin h-5 w-5 ${colorClass}`} viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
    </svg>
  );
}

// Check icon for success state
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

// Shield icon
function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  );
}

// Apple Logo SVG
function AppleLogo() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
    </svg>
  );
}

// Google Logo SVG
function GoogleLogo() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

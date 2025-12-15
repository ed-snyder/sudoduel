import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { oauthService } from '../services/oauthService';
import SudoDuelLogo from '../components/SudoDuelLogo';
import BackgroundEffects from '../components/BackgroundEffects';

export default function LoginPage() {
  const { loginWithGoogle, loginWithApple, loginAsGuest } = useAuth();
  const [loading, setLoading] = useState<'google' | 'apple' | 'guest' | null>(null);
  const [error, setError] = useState('');
  const [googleAvailable, setGoogleAvailable] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    setGoogleAvailable(oauthService.isGoogleAvailable());
    setAppleAvailable(oauthService.isAppleAvailable());
  }, []);

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading('google');
    try {
      await loginWithGoogle();
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google');
    } finally {
      setLoading(null);
    }
  };

  const handleAppleSignIn = async () => {
    setError('');
    setLoading('apple');
    try {
      await loginWithApple();
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Apple');
    } finally {
      setLoading(null);
    }
  };

  const handleGuestSignIn = async () => {
    setError('');
    setLoading('guest');
    try {
      await loginAsGuest();
    } catch (err: any) {
      setError(err.message || 'Failed to continue as guest');
    } finally {
      setLoading(null);
    }
  };

  const isLoading = loading !== null;

  return (
    <div className="min-h-screen bg-void flex flex-col relative z-20">
      <BackgroundEffects />
      
      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 safe-top safe-bottom relative z-20">
        {/* Logo */}
        <div className="mb-4">
          <SudoDuelLogo size="xl" />
        </div>
        
        {/* Tagline */}
        <p className="text-secondary mb-10 font-body text-lg tracking-wide">
          Competitive 1v1 Sudoku
        </p>

        {/* Error Message */}
        {error && (
          <div 
            className="w-full max-w-sm mb-4 px-4 py-3 bg-void bg-error/10 border border-error/50 rounded-lg animate-shake"
            style={{ boxShadow: '0 0 15px rgba(255,51,102,0.2)' }}
          >
            <p className="text-error text-sm font-body text-center">{error}</p>
          </div>
        )}

        {/* Sign In Buttons */}
        <div className="w-full max-w-sm space-y-3">
          {/* Apple Sign In - iOS only */}
          {appleAvailable && (
            <button
              onClick={handleAppleSignIn}
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

          {/* Google Sign In - Native platforms only */}
          {googleAvailable && (
            <button
              onClick={handleGoogleSignIn}
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

          {/* Divider - only show if there are OAuth options */}
          {(googleAvailable || appleAvailable) && (
            <div className="flex items-center gap-4 py-2">
              <div className="flex-1 h-px bg-grid-line"></div>
              <span className="text-muted text-sm font-body">or</span>
              <div className="flex-1 h-px bg-grid-line"></div>
            </div>
          )}

          {/* Guest Sign In - Always available */}
          <button
            onClick={handleGuestSignIn}
            disabled={isLoading}
            className="w-full py-3.5 bg-transparent border-2 border-player text-player font-body font-bold uppercase tracking-widest rounded-lg hover:bg-player/20 hover:shadow-glow-player active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {loading === 'guest' ? (
              <LoadingSpinner color="player" />
            ) : (
              'Play as Guest'
            )}
          </button>
        </div>

        {/* Disclaimer Text */}
        <p className="mt-8 text-xs text-muted text-center max-w-xs font-body leading-relaxed">
          Guest progress is saved on this device only.
          <br />
          Create an account anytime to sync across devices.
        </p>
        
        <p className="absolute bottom-4 text-xs text-muted/50 font-mono">v1.0.0</p>
      </div>
    </div>
  );
}

// Loading Spinner Component
function LoadingSpinner({ color }: { color: 'black' | 'gray' | 'player' }) {
  const colorClass = color === 'player' ? 'text-player' : color === 'black' ? 'text-black' : 'text-gray-500';
  return (
    <svg className={`animate-spin h-5 w-5 ${colorClass}`} viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
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

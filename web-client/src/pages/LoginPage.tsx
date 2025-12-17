import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '../context/AuthContext';
import { oauthService } from '../services/oauthService';
import SudoDuelLogo from '../components/SudoDuelLogo';
import BackgroundEffects from '../components/BackgroundEffects';

// Check if running on web (not native app)
const isWebBrowser = !Capacitor.isNativePlatform();

export default function LoginPage() {
  // Show landing page for web visitors
  if (isWebBrowser) {
    return <LandingPage />;
  }

  // Native app - show login
  return <NativeLoginPage />;
}

// ============================================
// LANDING PAGE (Web Browser)
// ============================================
function LandingPage() {
  return (
    <div className="min-h-screen bg-void flex flex-col relative z-20">
      <BackgroundEffects />
      
      {/* Content */}
      <div className="flex-1 flex flex-col items-center px-4 py-12 safe-top safe-bottom relative z-20 overflow-y-auto">
        {/* Logo */}
        <div className="mb-4">
          <SudoDuelLogo size="xl" />
        </div>
        
        {/* Tagline */}
        <p className="text-secondary mb-6 font-body text-lg tracking-wide text-center">
          Competitive 1v1 Sudoku
        </p>

        {/* Coming Soon Badge */}
        <div 
          className="mb-8 px-6 py-3 rounded-xl border-2"
          style={{ 
            borderColor: 'rgba(0, 255, 255, 0.5)',
            background: 'rgba(0, 255, 255, 0.1)',
            boxShadow: '0 0 20px rgba(0, 255, 255, 0.2)'
          }}
        >
          <p className="text-player font-display font-bold text-lg tracking-wide">
            🌐 Playable on Web Browser Soon!
          </p>
        </div>

        {/* Description */}
        <div className="w-full max-w-md mb-8 text-center">
          <p className="text-primary font-body text-base leading-relaxed mb-4">
            Sudoduel is a competitive, head-to-head Sudoku experience that transforms the classic puzzle into an adrenaline-fueled multiplayer game. Challenge players worldwide in real-time. Race to solve grids, beat opponents, and climb the rankings.
          </p>
        </div>

        {/* App Store Links */}
        <div className="w-full max-w-sm mb-8">
          <p className="text-muted font-body text-sm text-center mb-4 uppercase tracking-widest">
            Download Now
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {/* App Store */}
            <a
              href="https://apps.apple.com/app/sudoduel"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-6 py-3 bg-surface border-2 border-player text-player font-body font-semibold rounded-lg hover:bg-player/20 hover:shadow-glow-player transition-all duration-200"
            >
              <AppleLogo />
              <span>App Store</span>
            </a>
            
            {/* Google Play */}
            <a
              href="https://play.google.com/store/apps/details?id=com.sudoduel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-6 py-3 bg-surface border-2 border-secondary text-secondary font-body font-semibold rounded-lg hover:bg-secondary/10 transition-all duration-200"
            >
              <PlayStoreLogo />
              <span>Google Play</span>
            </a>
          </div>
        </div>

        {/* Known Issues */}
        <div className="w-full max-w-md mb-8">
          <p className="text-muted font-body text-sm text-center mb-4 uppercase tracking-widest">
            Known Issues
          </p>
          <div 
            className="rounded-xl p-4 space-y-2"
            style={{ 
              background: 'rgba(45, 15, 30, 0.6)',
              border: '1px solid rgba(255, 51, 102, 0.3)'
            }}
          >
            <p className="text-secondary font-body text-xs">
              • None at the moment! Report issues on Discord or via email.
            </p>
          </div>
        </div>

        {/* Roadmap */}
        <div className="w-full max-w-md mb-8">
          <p className="text-muted font-body text-sm text-center mb-4 uppercase tracking-widest">
            Roadmap
          </p>
          <div 
            className="rounded-xl p-4 space-y-3"
            style={{ 
              background: 'rgba(30, 15, 45, 0.6)',
              border: '1px solid rgba(139, 0, 255, 0.3)'
            }}
          >
            <RoadmapItem done label="iOS App Launch" />
            <RoadmapItem done label="Ranked Matchmaking & Leaderboards" />
            <RoadmapItem done label="Friends System & Private Matches" />
            <RoadmapItem label="Web Browser Version" />
            <RoadmapItem label="Android Version" />
            <RoadmapItem label="More Difficulty Levels & Rankings (Medium, Hard, Expert, etc.)" />
            <RoadmapItem label="iPad Support" />
            <RoadmapItem label="Tournaments & Seasons" />
          </div>
        </div>

        {/* Contact & Social */}
        <div className="w-full max-w-sm mb-8">
          <p className="text-muted font-body text-sm text-center mb-4 uppercase tracking-widest">
            Connect With Us
          </p>
          <div className="flex flex-col gap-3">
            {/* Discord */}
            <a
              href="https://discord.gg/sudoduel"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-6 py-3 bg-surface border-2 rounded-lg font-body font-semibold transition-all duration-200 hover:scale-[1.02]"
              style={{ 
                borderColor: '#5865F2',
                color: '#5865F2'
              }}
            >
              <DiscordLogo />
              <span>Join our Discord</span>
            </a>
            
            {/* Contact Email */}
            <div className="flex items-center justify-center gap-3 px-6 py-3">
              <a
                href="mailto:support@axolabs.io"
                className="flex items-center gap-2 text-muted font-body text-sm hover:text-primary transition-colors"
              >
                <EmailIcon />
                <span>support@axolabs.io</span>
              </a>
              <span className="text-muted/50">•</span>
              <a
                href="https://www.axolabs.io"
                target="_blank"
                rel="noopener noreferrer"
                className="text-player font-body text-sm hover:text-player/80 transition-colors"
              >
                axolabs.io
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto pt-8 text-center">
          <p className="text-xs text-muted/50 font-mono">
            © Axo Labs LLC 2025 • 
            <a href="https://www.notion.so/Sudoduel-Privacy-Policy-2c3c4dad9ac880758129d0d10ab5d59b" className="hover:text-muted ml-1">Privacy</a> • 
            <a href="https://www.notion.so/Sudoduel-Terms-of-Service-2c3c4dad9ac8808ab570cc280a115aaf?source=copy_link" className="hover:text-muted ml-1">Terms</a>
          </p>
        </div>
      </div>
    </div>
  );
}

// Roadmap Item Component
function RoadmapItem({ done, label }: { done?: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3">
      {done ? (
        <svg className="w-5 h-5 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <div className="w-5 h-5 rounded-full border-2 border-muted flex-shrink-0" />
      )}
      <span className={`font-body text-sm ${done ? 'text-secondary' : 'text-muted'}`}>
        {label}
      </span>
    </div>
  );
}

// ============================================
// NATIVE LOGIN PAGE (iOS/Android App)
// ============================================
function NativeLoginPage() {
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
              className="w-full py-3.5 bg-surface border-2 border-player text-player font-body font-semibold rounded-lg flex items-center justify-center gap-3 hover:bg-player/20 hover:shadow-glow-player active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
            >
              {loading === 'apple' ? (
                <LoadingSpinner color="player" />
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
              className="w-full py-3.5 bg-surface border-2 border-player text-player font-body font-semibold rounded-lg flex items-center justify-center gap-3 hover:bg-player/20 hover:shadow-glow-player active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
            >
              {loading === 'google' ? (
                <LoadingSpinner color="player" />
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

          {/* Guest Sign In - Always available (secondary styling) */}
          <button
            onClick={handleGuestSignIn}
            disabled={isLoading}
            className="w-full py-3.5 bg-surface border-2 border-secondary text-secondary font-body font-semibold rounded-lg flex items-center justify-center gap-3 hover:bg-secondary/10 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
          >
            {loading === 'guest' ? (
              <LoadingSpinner color="secondary" />
            ) : (
              <>
                <GuestIcon />
                <span>Play as Guest</span>
              </>
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
function LoadingSpinner({ color }: { color: 'player' | 'secondary' }) {
  const colorClass = color === 'player' ? 'text-player' : 'text-secondary';
  return (
    <svg className={`animate-spin h-5 w-5 ${colorClass}`} viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
    </svg>
  );
}

// Apple Logo SVG - uses fill-current to inherit text color
function AppleLogo() {
  return (
    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
    </svg>
  );
}

// Google Logo SVG - uses currentColor to inherit text color
function GoogleLogo() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

// Guest/User Icon SVG
function GuestIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  );
}

// Play Store Logo SVG
function PlayStoreLogo() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.198l2.807 1.626a1 1 0 0 1 0 1.73l-2.808 1.626L15.206 12l2.492-2.491zM5.864 2.658L16.8 9.99l-2.302 2.302-8.634-8.634z"/>
    </svg>
  );
}

// Discord Logo SVG
function DiscordLogo() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
    </svg>
  );
}

// Email Icon SVG
function EmailIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  );
}

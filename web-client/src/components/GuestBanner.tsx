import { useState, useEffect } from 'react';

interface GuestBannerProps {
  onSecureAccount: () => void;
}

const DISMISS_KEY = 'guest_banner_dismissed';

export default function GuestBanner({ onSecureAccount }: GuestBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  // Check if banner was dismissed this session
  useEffect(() => {
    const wasDismissed = sessionStorage.getItem(DISMISS_KEY) === 'true';
    setDismissed(wasDismissed);
  }, []);

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, 'true');
    setDismissed(true);
  };

  if (dismissed) {
    return null;
  }

  return (
    <div className="w-full bg-amber-500/10 border-b border-amber-500/30 px-4 py-2.5">
      <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
        {/* Left side: Icon and text */}
        <div className="flex items-center gap-2 min-w-0">
          <ShieldIcon className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span className="text-amber-200 text-sm font-body truncate">
            <span className="font-semibold">Guest</span>
            <span className="hidden sm:inline"> • Progress saved on this device only</span>
            <span className="sm:hidden"> • Device only</span>
          </span>
        </div>

        {/* Right side: Secure button and dismiss */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onSecureAccount}
            className="px-3 py-1 bg-amber-500/20 border border-amber-500/50 text-amber-300 text-sm font-body font-semibold rounded hover:bg-amber-500/30 hover:border-amber-400 transition-all"
          >
            Secure Account
          </button>
          <button
            onClick={handleDismiss}
            className="p-1 text-amber-400/60 hover:text-amber-300 transition-colors"
            aria-label="Dismiss banner"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Shield icon (unlocked/open shield)
function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <path d="M12 8v4"/>
      <path d="M12 16h.01"/>
    </svg>
  );
}

// Close/X icon
function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

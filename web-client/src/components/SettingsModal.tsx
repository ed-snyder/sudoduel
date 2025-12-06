import { useState, useEffect } from 'react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
}

export default function SettingsModal({ isOpen, onClose, onLogout }: SettingsModalProps) {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hapticEnabled, setHapticEnabled] = useState(true);

  useEffect(() => {
    if (isOpen) {
      const sound = localStorage.getItem('soundEnabled');
      const haptic = localStorage.getItem('hapticEnabled');
      setSoundEnabled(sound !== 'false');
      setHapticEnabled(haptic !== 'false');
    }
  }, [isOpen]);

  const handleSoundToggle = (enabled: boolean) => {
    setSoundEnabled(enabled);
    localStorage.setItem('soundEnabled', enabled.toString());
  };

  const handleHapticToggle = (enabled: boolean) => {
    setHapticEnabled(enabled);
    localStorage.setItem('hapticEnabled', enabled.toString());
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-void/90 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-surface border border-grid-line rounded-xl w-full max-w-md shadow-2xl animate-scale-in">
        {/* Header */}
        <div className="px-5 py-4 border-b border-grid-line flex items-center justify-between">
          <h2 className="text-xl font-heading font-semibold text-primary tracking-wide">SETTINGS</h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-player transition-colors p-1"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-5 space-y-6">
          {/* Toggles */}
          <div className="space-y-4">
            {/* Sound Effects */}
            <div className="flex items-center justify-between">
              <div>
                <div className="font-body font-medium text-primary">Sound Effects</div>
                <div className="text-sm text-muted font-body">Play sounds for moves</div>
              </div>
              <button
                onClick={() => handleSoundToggle(!soundEnabled)}
                className={`relative w-14 h-8 rounded-full transition-all duration-200 ${
                  soundEnabled 
                    ? 'bg-player/30 border-2 border-player shadow-glow-player-subtle' 
                    : 'bg-elevated border-2 border-grid-line'
                }`}
              >
                <div
                  className={`absolute top-1 left-1 w-5 h-5 rounded-full transition-all duration-200 ${
                    soundEnabled 
                      ? 'translate-x-6 bg-player shadow-glow-player-subtle' 
                      : 'translate-x-0 bg-muted'
                  }`}
                />
              </button>
            </div>

            {/* Haptic Feedback */}
            <div className="flex items-center justify-between">
              <div>
                <div className="font-body font-medium text-primary">Haptic Feedback</div>
                <div className="text-sm text-muted font-body">Vibrate on incorrect moves</div>
              </div>
              <button
                onClick={() => handleHapticToggle(!hapticEnabled)}
                className={`relative w-14 h-8 rounded-full transition-all duration-200 ${
                  hapticEnabled 
                    ? 'bg-player/30 border-2 border-player shadow-glow-player-subtle' 
                    : 'bg-elevated border-2 border-grid-line'
                }`}
              >
                <div
                  className={`absolute top-1 left-1 w-5 h-5 rounded-full transition-all duration-200 ${
                    hapticEnabled 
                      ? 'translate-x-6 bg-player shadow-glow-player-subtle' 
                      : 'translate-x-0 bg-muted'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* About */}
          <div className="pt-4 border-t border-grid-line">
            <div className="text-sm text-muted font-body">
              <div className="font-medium text-secondary mb-1">About</div>
              <div className="font-mono text-xs">SudoDuel v1.0.0</div>
            </div>
          </div>

          {/* Log Out */}
          <div className="pt-4">
            <button
              onClick={() => {
                onLogout();
                onClose();
              }}
              className="w-full py-3 bg-transparent border-2 border-error text-error font-body font-semibold rounded-lg hover:bg-error/20 hover:shadow-glow-error transition-all"
            >
              Log Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

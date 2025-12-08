import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { logout } = useAuth();
  const [hapticEnabled, setHapticEnabled] = useState(true);
  const [simplifyGraphics, setSimplifyGraphics] = useState(false);
  const [musicVolume, setMusicVolume] = useState(70);
  const [sfxVolume, setSfxVolume] = useState(80);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Load settings from localStorage
  useEffect(() => {
    const savedHaptic = localStorage.getItem('hapticEnabled');
    if (savedHaptic !== null) setHapticEnabled(savedHaptic === 'true');
    
    const savedSimplify = localStorage.getItem('simplifyGraphics');
    if (savedSimplify !== null) setSimplifyGraphics(savedSimplify === 'true');
    
    const savedMusic = localStorage.getItem('musicVolume');
    if (savedMusic !== null) setMusicVolume(parseInt(savedMusic, 10));
    
    const savedSfx = localStorage.getItem('sfxVolume');
    if (savedSfx !== null) setSfxVolume(parseInt(savedSfx, 10));
  }, [isOpen]);

  const handleHapticToggle = () => {
    const newValue = !hapticEnabled;
    setHapticEnabled(newValue);
    localStorage.setItem('hapticEnabled', String(newValue));
  };

  const handleSimplifyToggle = () => {
    const newValue = !simplifyGraphics;
    setSimplifyGraphics(newValue);
    localStorage.setItem('simplifyGraphics', String(newValue));
  };

  const handleMusicVolume = (value: number) => {
    setMusicVolume(value);
    localStorage.setItem('musicVolume', String(value));
  };

  const handleSfxVolume = (value: number) => {
    setSfxVolume(value);
    localStorage.setItem('sfxVolume', String(value));
  };

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  const handleLogoutConfirm = () => {
    logout();
    onClose();
  };

  const handleLogoutCancel = () => {
    setShowLogoutConfirm(false);
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-void/90 backdrop-blur-sm" />
      
      {/* Modal */}
      <div 
        className="relative bg-surface border border-grid-line rounded-xl w-full max-w-sm overflow-hidden animate-scale-in"
        style={{ boxShadow: '0 0 30px rgba(139,0,255,0.2)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-grid-line">
          <h2 className="font-heading font-bold text-lg text-primary">Settings</h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-player transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="divide-y divide-grid-line">
          {/* Music Volume */}
          <div className="px-4 py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-body text-primary">Music Volume</span>
              <span className="font-mono text-sm text-muted">{musicVolume}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={musicVolume}
              onChange={(e) => handleMusicVolume(parseInt(e.target.value, 10))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #00FFFF 0%, #00FFFF ${musicVolume}%, rgba(139,0,255,0.3) ${musicVolume}%, rgba(139,0,255,0.3) 100%)`,
              }}
            />
          </div>

          {/* SFX Volume */}
          <div className="px-4 py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-body text-primary">SFX Volume</span>
              <span className="font-mono text-sm text-muted">{sfxVolume}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={sfxVolume}
              onChange={(e) => handleSfxVolume(parseInt(e.target.value, 10))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #00FFFF 0%, #00FFFF ${sfxVolume}%, rgba(139,0,255,0.3) ${sfxVolume}%, rgba(139,0,255,0.3) 100%)`,
              }}
            />
          </div>

          {/* Haptic Feedback Toggle */}
          <div className="px-4 py-4 flex items-center justify-between">
            <span className="font-body text-primary">Haptic Feedback</span>
            <button
              onClick={handleHapticToggle}
              className={`relative w-12 h-7 rounded-full transition-all ${
                hapticEnabled 
                  ? 'bg-player/30 border border-player' 
                  : 'bg-elevated border border-grid-line'
              }`}
              style={{
                boxShadow: hapticEnabled ? '0 0 10px rgba(0,255,255,0.3)' : 'none',
              }}
            >
              <div 
                className={`absolute top-1 w-5 h-5 rounded-full transition-all ${
                  hapticEnabled 
                    ? 'right-1 bg-player' 
                    : 'left-1 bg-muted'
                }`}
              />
            </button>
          </div>

          {/* Simplify Graphics Toggle */}
          <div className="px-4 py-4 flex items-center justify-between">
            <span className="font-body text-primary">Simplify Graphics</span>
            <button
              onClick={handleSimplifyToggle}
              className={`relative w-12 h-7 rounded-full transition-all ${
                simplifyGraphics 
                  ? 'bg-player/30 border border-player' 
                  : 'bg-elevated border border-grid-line'
              }`}
              style={{
                boxShadow: simplifyGraphics ? '0 0 10px rgba(0,255,255,0.3)' : 'none',
              }}
            >
              <div 
                className={`absolute top-1 w-5 h-5 rounded-full transition-all ${
                  simplifyGraphics 
                    ? 'right-1 bg-player' 
                    : 'left-1 bg-muted'
                }`}
              />
            </button>
          </div>

          {/* Privacy Policy & Terms */}
          <div className="px-4 py-4 space-y-3 border-t border-grid-line">
            <a
              href="https://sudoduel.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-3 px-4 rounded-xl font-body text-sm text-secondary text-left flex items-center justify-between transition-all active:scale-[0.98]"
              style={{ background: 'rgba(26, 6, 64, 0.4)' }}
            >
              <span>Privacy Policy</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
            
            <a
              href="https://sudoduel.com/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-3 px-4 rounded-xl font-body text-sm text-secondary text-left flex items-center justify-between transition-all active:scale-[0.98]"
              style={{ background: 'rgba(26, 6, 64, 0.4)' }}
            >
              <span>Terms of Service</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          </div>

          {/* About */}
          <div className="px-4 py-4">
            <span className="font-body text-muted text-sm">SudoDuel v1.0.0</span>
          </div>

          {/* Logout */}
          <div className="px-4 py-4">
            <button
              onClick={handleLogoutClick}
              className="w-full py-3 rounded-lg font-body font-semibold transition-all"
              style={{
                background: 'rgba(255,51,102,0.1)',
                border: '2px solid rgba(255,51,102,0.5)',
                color: '#FF3366',
              }}
            >
              Log Out
            </button>
          </div>
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div 
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          onClick={handleLogoutCancel}
        >
          <div className="absolute inset-0 bg-void/80" />
          <div 
            className="relative bg-surface border border-error/50 rounded-xl p-6 max-w-xs w-full animate-scale-in"
            style={{ boxShadow: '0 0 30px rgba(255,51,102,0.2)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-heading font-bold text-lg text-primary text-center mb-2">
              Log Out?
            </h3>
            <p className="text-secondary font-body text-sm text-center mb-6">
              Are you sure you want to log out of your account?
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleLogoutCancel}
                className="flex-1 py-3 rounded-lg font-body font-semibold transition-all"
                style={{
                  background: 'rgb(20, 12, 30)',
                  border: '2px solid rgba(139,0,255,0.4)',
                  color: 'rgba(255,255,255,0.8)',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleLogoutConfirm}
                className="flex-1 py-3 rounded-lg font-body font-semibold transition-all"
                style={{
                  background: 'rgba(255,51,102,0.2)',
                  border: '2px solid #FF3366',
                  color: '#FF3366',
                }}
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

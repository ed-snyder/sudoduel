import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';
import { authAPI } from '../services/api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { logout } = useAuth();
  const { isPremium, togglePremiumStatus } = useSubscription();
  const [hapticEnabled, setHapticEnabled] = useState(true);
  const [simplifyGraphics, setSimplifyGraphics] = useState(false);
  const [musicVolume, setMusicVolume] = useState(70);
  const [sfxVolume, setSfxVolume] = useState(80);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

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

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return;
    
    setDeleteLoading(true);
    setDeleteError('');
    
    try {
      await authAPI.deleteAccount();
      // Clear all local data
      localStorage.clear();
      // Redirect to login (force refresh to clear all state)
      window.location.href = '/';
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete account');
      setDeleteLoading(false);
    }
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
        className="relative bg-surface border border-grid-line rounded-xl w-full max-w-sm overflow-hidden animate-scale-in flex flex-col"
        style={{ boxShadow: '0 0 30px rgba(139,0,255,0.2)', maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Fixed at top */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-grid-line flex-shrink-0">
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

        {/* Content - Scrollable */}
        <div className="divide-y divide-grid-line overflow-y-auto flex-1" style={{ maxHeight: 'calc(85vh - 60px)' }}>
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

          {/* Legal Links */}
          <div className="px-4 py-4 space-y-3 border-t border-grid-line">
            <a
              href="https://www.notion.so/SudoDuel-Privacy-Policy-2c3c4dad9ac880758129d0d10ab5d59b"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-3 px-4 rounded-xl font-body text-sm text-secondary text-left transition-all active:scale-[0.98]"
              style={{ background: 'rgba(26, 6, 64, 0.4)' }}
            >
              Privacy Policy ↗
            </a>
            
            <a
              href="https://www.notion.so/SudoDuel-Terms-of-Service-2c3c4dad9ac8808ab570cc280a115aaf"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-3 px-4 rounded-xl font-body text-sm text-secondary text-left transition-all active:scale-[0.98]"
              style={{ background: 'rgba(26, 6, 64, 0.4)' }}
            >
              Terms of Service ↗
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

          {/* Danger Zone */}
          <div className="mt-8 pt-6 border-t border-error/20 px-4 pb-4">
            <h3 className="text-error font-display font-bold text-sm mb-4 uppercase tracking-wider">
              Danger Zone
            </h3>
            
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full py-3 rounded-lg font-body font-semibold transition-all active:scale-95"
              style={{
                background: 'rgba(255,51,102,0.1)',
                border: '2px solid rgba(255,51,102,0.5)',
                color: '#FF3366',
              }}
            >
              Delete Account
            </button>
          </div>

          {/* DEV OPTIONS - only in development - placed at bottom after Danger Zone */}
          {(import.meta.env.DEV || import.meta.env.MODE === 'development') && (
            <div className="px-4 py-4 border-t border-warning/30 bg-warning/5">
              <h3 className="text-xs font-display font-black text-warning uppercase tracking-wider mb-3">
                ⚠️ Dev Options
              </h3>
              
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-primary font-display">Sudoduel+ Status</span>
                  <p className="text-xs text-muted mt-0.5">Toggle premium for testing</p>
                </div>
                <button
                  onClick={() => {
                    console.log('Toggling premium, current:', isPremium);
                    togglePremiumStatus();
                  }}
                  className={`px-3 py-1.5 rounded-lg font-mono text-sm font-bold transition-all ${
                    isPremium 
                      ? 'bg-player/20 text-player border border-player' 
                      : 'bg-surface text-muted border border-grid-line'
                  }`}
                >
                  {isPremium ? 'PREMIUM' : 'FREE'}
                </button>
              </div>
            </div>
          )}
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

      {/* Delete Account Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-void/95 backdrop-blur-sm"
            onClick={() => {
              setShowDeleteConfirm(false);
              setDeleteConfirmText('');
              setDeleteError('');
            }}
          />
          
          <div 
            className="relative bg-surface border-2 border-error/50 rounded-xl p-6 max-w-sm w-full animate-scale-in"
            style={{
              boxShadow: '0 0 30px rgba(255,51,102,0.3), 0 10px 40px rgba(0,0,0,0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Warning Icon */}
            <div className="flex justify-center mb-4">
              <div 
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{
                  background: 'rgba(255,51,102,0.2)',
                  border: '2px solid #FF3366',
                }}
              >
                <svg className="w-8 h-8 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
            
            <h3 className="font-heading font-bold text-xl text-error text-center mb-2">
              Delete Account?
            </h3>
            
            <p className="text-secondary font-body text-sm text-center mb-4">
              This action is <strong className="text-error">permanent</strong> and cannot be undone. 
              All your data will be deleted including:
            </p>
            
            <ul className="text-muted font-body text-xs mb-4 space-y-1 pl-4">
              <li>• Your profile and display name</li>
              <li>• Match history and statistics</li>
              <li>• Friends list and pending requests</li>
              <li>• Rating and ranking data</li>
            </ul>
            
            <p className="text-secondary font-body text-sm text-center mb-4">
              Type <strong className="text-error font-mono">DELETE</strong> to confirm:
            </p>
            
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value.toUpperCase())}
              placeholder="Type DELETE"
              className="w-full px-4 py-3 bg-elevated border border-grid-line rounded-lg text-primary font-mono text-center focus:outline-none focus:border-error transition-all mb-4"
              autoComplete="off"
            />
            
            {deleteError && (
              <p className="text-error text-sm text-center mb-4">{deleteError}</p>
            )}
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText('');
                  setDeleteError('');
                }}
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
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== 'DELETE' || deleteLoading}
                className="flex-1 py-3 rounded-lg font-body font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: deleteConfirmText === 'DELETE' ? 'rgba(255,51,102,0.3)' : 'rgba(255,51,102,0.1)',
                  border: '2px solid #FF3366',
                  color: '#FF3366',
                }}
              >
                {deleteLoading ? 'Deleting...' : 'Delete Forever'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

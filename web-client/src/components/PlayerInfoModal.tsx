import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { playerAPI } from '../services/api';
import { validateUsername } from '../utils/usernameValidator';
import { useSoundEffects } from '../hooks/useSoundEffects';

interface PlayerInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenStats: () => void;
  onOpenHistory: () => void;
}

export default function PlayerInfoModal({ isOpen, onClose, onOpenStats, onOpenHistory }: PlayerInfoModalProps) {
  const { user, refreshUser } = useAuth();
  const { playModalOpen, playModalClose } = useSoundEffects(0.8);
  const hasPlayedOpenSound = useRef(false);
  const [displayName, setDisplayName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [nameError, setNameError] = useState('');
  const [isCheckingName, setIsCheckingName] = useState(false);
  const [nameAvailable, setNameAvailable] = useState<boolean | null>(null);

  // Play modal open sound
  useEffect(() => {
    if (isOpen && !hasPlayedOpenSound.current) {
      playModalOpen();
      hasPlayedOpenSound.current = true;
    }
    if (!isOpen) {
      hasPlayedOpenSound.current = false;
    }
  }, [isOpen, playModalOpen]);

  // Handle close with sound
  const handleClose = useCallback(() => {
    playModalClose();
    onClose();
  }, [playModalClose, onClose]);

  // Load current display name when modal opens
  useEffect(() => {
    if (isOpen && user?.display_name) {
      setDisplayName(user.display_name);
      setNameSaved(false);
      setNameError('');
      setNameAvailable(null);
    }
  }, [isOpen, user?.display_name]);

  // Debounced name availability check
  useEffect(() => {
    const trimmedName = displayName.trim();
    
    // Reset state if name is same as current or empty
    if (!trimmedName || trimmedName === user?.display_name) {
      setNameAvailable(null);
      setNameError('');
      return;
    }

    // Validate format using username validator
    const validation = validateUsername(trimmedName);
    if (!validation.valid) {
      setNameError(validation.error || 'Invalid username');
      setNameAvailable(false);
      return;
    }

    setNameError('');
    setIsCheckingName(true);

    const timeoutId = setTimeout(async () => {
      try {
        const response = await playerAPI.checkDisplayName(trimmedName);
        setNameAvailable(response.available);
        if (!response.available) {
          setNameError('Name already taken');
        }
      } catch (error: any) {
        console.error('Failed to check name:', error);
      } finally {
        setIsCheckingName(false);
      }
    }, 300); // Debounce 300ms

    return () => clearTimeout(timeoutId);
  }, [displayName, user?.display_name]);

  const handleSaveDisplayName = async () => {
    const trimmedName = displayName.trim();
    
    if (!trimmedName || trimmedName === user?.display_name) return;
    
    // Validate before saving
    const validation = validateUsername(trimmedName);
    if (!validation.valid) {
      setNameError(validation.error || 'Invalid username');
      return;
    }
    
    if (!nameAvailable) return;
    
    setIsSavingName(true);
    setNameError('');
    
    try {
      await playerAPI.updateProfile(trimmedName);
      
      setNameSaved(true);
      setNameAvailable(null);
      if (refreshUser) {
        await refreshUser();
      }
      setTimeout(() => setNameSaved(false), 2000);
    } catch (error: any) {
      console.error('Failed to update display name:', error);
      setNameError(error.message || 'Failed to save');
    } finally {
      setIsSavingName(false);
    }
  };

  const handleStatsClick = () => {
    onClose();
    onOpenStats();
  };

  const handleHistoryClick = () => {
    onClose();
    onOpenHistory();
  };

  const getInputBorderColor = () => {
    if (nameError) return '2px solid rgba(255,51,102,0.5)';
    if (nameAvailable === true) return '2px solid rgba(0,255,136,0.5)';
    if (isCheckingName) return '2px solid rgba(0,255,255,0.3)';
    return '1px solid rgba(45,27,105,0.5)';
  };

  const getStatusIndicator = () => {
    if (displayName.trim() === user?.display_name || !displayName.trim()) return null;
    
    if (isCheckingName) {
      return (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="w-4 h-4 border-2 border-player border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }
    
    if (nameError) {
      return (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-error">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
      );
    }
    
    if (nameAvailable === true) {
      return (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-success">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      );
    }
    
    return null;
  };

  if (!isOpen) return null;

  const canSave = displayName.trim() && 
                  displayName.trim() !== user?.display_name && 
                  nameAvailable === true && 
                  !isCheckingName;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-void/95" />
      
      {/* Modal */}
      <div 
        className="relative bg-surface border border-grid-line rounded-xl w-full max-w-sm overflow-hidden animate-scale-in"
        style={{ boxShadow: '0 0 30px rgba(0,255,255,0.2)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-grid-line">
          <h2 className="font-heading font-bold text-lg text-primary">Player Info</h2>
          <button
            onClick={handleClose}
            className="text-muted hover:text-player transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Display Name Editor */}
          <div>
            <label className="block text-sm text-muted font-body mb-2">Display Name</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value.slice(0, 20))}
                  maxLength={20}
                  className="w-full px-3 py-3 pr-10 bg-elevated rounded-lg text-primary font-body focus:outline-none transition-all"
                  style={{ border: getInputBorderColor() }}
                  placeholder="Enter name..."
                />
                {getStatusIndicator()}
              </div>
              <button
                onClick={handleSaveDisplayName}
                disabled={isSavingName || !canSave}
                className="px-4 py-3 rounded-lg font-body font-bold text-sm transition-all disabled:opacity-40"
                style={{
                  background: nameSaved ? 'rgba(0,255,136,0.2)' : 'rgb(15, 10, 25)',
                  border: nameSaved ? '2px solid #00FF88' : '2px solid rgba(0,255,255,0.5)',
                  color: nameSaved ? '#00FF88' : '#00FFFF',
                }}
              >
                {isSavingName ? '...' : nameSaved ? '✓' : 'Save'}
              </button>
            </div>
            <div className="flex justify-between items-center mt-1">
              <p className={`text-xs font-body ${nameError ? 'text-error' : 'text-muted'}`}>
                {nameError || 'Letters, numbers, spaces, underscores, hyphens'}
              </p>
              <p className="text-xs text-muted font-mono">
                {displayName.length}/20
              </p>
            </div>
          </div>

          {/* Action Buttons Grid */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            {/* Stats */}
            <button
              onClick={handleStatsClick}
              className="flex flex-col items-center gap-2 py-4 rounded-lg transition-all hover:scale-105 active:scale-95"
              style={{
                background: 'rgba(139,0,255,0.1)',
                border: '2px solid rgba(139,0,255,0.3)',
                boxShadow: '0 0 10px rgba(139,0,255,0.1)',
              }}
            >
              <svg className="w-6 h-6 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="text-xs font-body font-semibold text-secondary">Stats</span>
            </button>

            {/* History */}
            <button
              onClick={handleHistoryClick}
              className="flex flex-col items-center gap-2 py-4 rounded-lg transition-all hover:scale-105 active:scale-95"
              style={{
                background: 'rgba(139,0,255,0.1)',
                border: '2px solid rgba(139,0,255,0.3)',
                boxShadow: '0 0 10px rgba(139,0,255,0.1)',
              }}
            >
              <svg className="w-6 h-6 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs font-body font-semibold text-secondary">History</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

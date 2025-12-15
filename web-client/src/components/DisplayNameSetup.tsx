import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { playerAPI } from '../services/api';
import { validateUsername } from '../utils/usernameValidator';
import SudoDuelLogo from './SudoDuelLogo';
import BackgroundEffects from './BackgroundEffects';

interface DisplayNameSetupProps {
  onComplete: () => void;
  suggestedName?: string;
}

/**
 * Sanitize a name for use as a display name
 * - Replace spaces with underscores
 * - Remove invalid characters (keep only a-zA-Z0-9_)
 * - Limit to 15 characters
 */
function sanitizeName(name: string): string {
  return name
    .replace(/\s+/g, '_')           // Replace spaces with underscores
    .replace(/[^a-zA-Z0-9_]/g, '')  // Remove invalid characters
    .slice(0, 15);                   // Limit to 15 characters
}

export default function DisplayNameSetup({ onComplete, suggestedName }: DisplayNameSetupProps) {
  const { refreshUser } = useAuth();
  const [displayName, setDisplayName] = useState(() => 
    suggestedName ? sanitizeName(suggestedName) : ''
  );
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Validate pre-filled name on mount
  useEffect(() => {
    if (displayName) {
      const result = validateUsername(displayName);
      if (!result.valid) {
        setError(result.error || 'Invalid name');
      }
    }
  }, []);

  const handleDisplayNameChange = (value: string) => {
    setDisplayName(value);
    if (value.length > 0) {
      const result = validateUsername(value);
      setError(result.error || '');
    } else {
      setError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmed = displayName.trim();
    
    // Final validation
    const validation = validateUsername(trimmed);
    if (!validation.valid) {
      setError(validation.error || 'Invalid name');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await playerAPI.updateProfile(trimmed);
      await refreshUser();
      onComplete();
    } catch (err: any) {
      setError(err.message || 'Failed to save name');
    } finally {
      setLoading(false);
    }
  };

  const isValid = displayName.trim().length > 0 && !error;

  return (
    <div className="min-h-screen bg-void flex flex-col relative z-20">
      <BackgroundEffects />
      
      <div className="flex-1 flex flex-col items-center justify-center px-4 safe-top safe-bottom relative z-20">
        {/* Logo */}
        <div className="mb-6">
          <SudoDuelLogo size="lg" />
        </div>
        
        {/* Welcome Text */}
        <h1 className="text-3xl font-heading font-bold text-primary mb-2 tracking-wide">
          Welcome!
        </h1>
        <p className="text-secondary mb-8 font-body text-lg">
          Choose your player name
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
          {/* Error Display */}
          {error && (
            <div 
              className="px-4 py-3 bg-error/10 border border-error/50 rounded-lg animate-shake"
              style={{ boxShadow: '0 0 15px rgba(255,51,102,0.2)' }}
            >
              <p className="text-error text-sm font-body text-center">{error}</p>
            </div>
          )}

          {/* Name Input */}
          <div>
            <input
              type="text"
              value={displayName}
              onChange={(e) => handleDisplayNameChange(e.target.value)}
              placeholder="YourName"
              maxLength={15}
              autoFocus
              className={`w-full px-4 py-4 bg-surface border-2 rounded-lg text-primary text-center text-xl font-body font-semibold placeholder-muted focus:outline-none transition-all duration-200 ${
                error 
                  ? 'border-error/50 focus:border-error focus:shadow-glow-error-subtle' 
                  : 'border-grid-line focus:border-player focus:shadow-glow-player-subtle'
              }`}
            />
            <p className="text-muted text-xs font-body mt-2 text-center">
              3-15 characters • Letters, numbers, underscores
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !isValid}
            className="w-full py-4 bg-void border-2 border-player text-player font-body font-bold uppercase tracking-widest rounded-lg hover:bg-player/20 hover:shadow-glow-player active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                Saving...
              </span>
            ) : (
              "Let's Go!"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

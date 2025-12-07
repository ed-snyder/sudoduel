import { useState } from 'react';
import { extractEmojis } from '../utils/emoji';

interface AvatarPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAvatar: string;
  onSave: (avatar: string) => void;
  isPremium: boolean;
}

export default function AvatarPickerModal({ isOpen, onClose, currentAvatar, onSave, isPremium }: AvatarPickerModalProps) {
  const [selectedTab, setSelectedTab] = useState<'emoji' | 'initials'>('emoji');
  const [emoji, setEmoji] = useState(currentAvatar.length > 2 || /\p{Emoji}/u.test(currentAvatar) ? currentAvatar : '😎');
  const [initials, setInitials] = useState(currentAvatar.length <= 2 && !/\p{Emoji}/u.test(currentAvatar) ? currentAvatar : '');

  const handleEmojiChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Extract complete emojis (handles complex emojis correctly)
    const emojis = extractEmojis(value);
    if (emojis.length > 0) {
      // Use the last emoji entered
      setEmoji(emojis[emojis.length - 1]);
    }
  };

  const handleSave = () => {
    if (selectedTab === 'emoji') {
      onSave(emoji);
    } else {
      onSave(initials.toUpperCase());
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-void/90 backdrop-blur-sm flex items-end justify-center z-50 p-4 pb-20 animate-fade-in">
      <div 
        className="bg-surface border border-grid-line rounded-xl w-full max-w-sm shadow-2xl animate-scale-in"
        style={{ 
          boxShadow: '0 0 20px rgba(255, 0, 255, 0.4), 0 0 40px rgba(255, 0, 255, 0.2), 0 0 60px rgba(255, 0, 255, 0.1)'
        }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-grid-line flex items-center justify-between">
          <h2 className="text-lg font-heading font-semibold text-primary tracking-wide">CHOOSE AVATAR</h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-player transition-colors p-1"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="px-4 pt-4">
          <div className="flex bg-elevated rounded-lg p-1 border border-grid-line">
            <button
              onClick={() => setSelectedTab('emoji')}
              className={`flex-1 py-2 text-center rounded-md font-body font-semibold text-sm transition-all duration-200 ${
                selectedTab === 'emoji'
                  ? 'bg-player/20 text-player border border-player/50'
                  : 'text-muted hover:text-secondary'
              }`}
            >
              Emoji
            </button>
            <button
              onClick={() => setSelectedTab('initials')}
              className={`flex-1 py-2 text-center rounded-md font-body font-semibold text-sm transition-all duration-200 relative ${
                selectedTab === 'initials'
                  ? 'bg-player/20 text-player border border-player/50'
                  : 'text-muted hover:text-secondary'
              }`}
            >
              Initials
              {!isPremium && (
                <span className="absolute -top-1 -right-1 text-xs px-1.5 py-0.5 bg-gold text-void rounded font-bold">
                  PRO
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {selectedTab === 'emoji' ? (
            <div className="space-y-4">
              <p className="text-sm text-muted font-body text-center">Tap to open emoji picker</p>
              <input
                type="text"
                value={emoji}
                onChange={handleEmojiChange}
                placeholder="😎"
                className="w-full px-4 py-6 bg-elevated border border-grid-line rounded-lg text-5xl text-center focus:outline-none focus:border-player focus:shadow-glow-player-subtle transition-all"
                style={{ caretColor: 'transparent' }}
              />
              <p className="text-xs text-muted/60 font-body text-center">
                Your device's emoji keyboard will open
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {!isPremium ? (
                <div className="text-center py-6">
                  <div className="text-4xl mb-3">👑</div>
                  <p className="text-secondary font-body mb-2">Premium Feature</p>
                  <p className="text-muted text-sm font-body">Upgrade to use custom initials</p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted font-body text-center">Enter up to 2 characters</p>
                  <input
                    type="text"
                    value={initials}
                    onChange={(e) => setInitials(e.target.value.slice(0, 2))}
                    maxLength={2}
                    placeholder="AB"
                    className="w-full px-4 py-4 bg-elevated border border-grid-line rounded-lg text-primary font-heading text-3xl text-center tracking-widest placeholder-muted/50 focus:outline-none focus:border-player focus:shadow-glow-player-subtle transition-all"
                  />
                </>
              )}
            </div>
          )}
        </div>

        {/* Preview & Save */}
        <div className="px-4 pb-4 space-y-4">
          <div className="flex items-center justify-center">
            <div className="text-center">
              <p className="text-xs text-muted font-body mb-2">Preview</p>
              <div 
                className="w-16 h-16 rounded-full flex items-center justify-center border-2 border-player text-2xl font-heading font-bold"
                style={{ 
                  background: 'linear-gradient(135deg, rgba(0,255,255,0.2) 0%, rgba(139,0,255,0.2) 100%)',
                  boxShadow: '0 0 20px rgba(0,255,255,0.3), inset 0 0 15px rgba(0,255,255,0.2)'
                }}
              >
                {selectedTab === 'emoji' ? emoji : (initials.toUpperCase() || '?')}
              </div>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={selectedTab === 'initials' && !isPremium}
            className="w-full py-3 bg-transparent border-2 border-player text-player font-body font-semibold rounded-lg hover:bg-player/20 hover:shadow-glow-player disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

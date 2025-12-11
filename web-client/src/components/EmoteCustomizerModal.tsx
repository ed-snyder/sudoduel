import { useState, useEffect, useRef, useCallback } from 'react';
import { extractEmojis } from '../utils/emoji';
import { useSoundEffects } from '../hooks/useSoundEffects';

interface EmoteCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  isPremium?: boolean; // Keep for future use
}

const DEFAULT_EMOTES = ['👋', '👍', '😭', '🫵😂'];

export default function EmoteCustomizerModal({ isOpen, onClose, isPremium = false }: EmoteCustomizerModalProps) {
  const { playModalOpen, playModalClose } = useSoundEffects(0.8);
  const hasPlayedOpenSound = useRef(false);
  const [emotes, setEmotes] = useState<string[]>(DEFAULT_EMOTES);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [inputValue, setInputValue] = useState('');

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

  // Load saved emotes from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('customEmotes');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 4) {
          // Use setTimeout to avoid calling setState synchronously in effect
          setTimeout(() => setEmotes(parsed), 0);
        }
      } catch {
        console.error('Failed to parse saved emotes');
      }
    }
  }, [isOpen]);

  const handleEmoteClick = (index: number) => {
    setEditingIndex(index);
    setInputValue(''); // Start empty instead of current emote
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Extract emojis only - allow up to 2 complete emojis
    const emojis = extractEmojis(value, 2);
    setInputValue(emojis.join(''));
  };

  const handleSaveEmote = () => {
    if (editingIndex === null || !inputValue) return;
    
    const newEmotes = [...emotes];
    newEmotes[editingIndex] = inputValue;
    setEmotes(newEmotes);
    localStorage.setItem('customEmotes', JSON.stringify(newEmotes));
    setEditingIndex(null);
    setInputValue('');
  };

  const handleResetToDefault = () => {
    setEmotes(DEFAULT_EMOTES);
    localStorage.setItem('customEmotes', JSON.stringify(DEFAULT_EMOTES));
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleClose}
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
          <h2 className="font-heading font-bold text-lg text-primary">Emotes</h2>
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
          {/* Emote slots */}
          <div className="grid grid-cols-4 gap-3">
            {emotes.map((emote, index) => (
              <button
                key={index}
                onClick={() => isPremium && handleEmoteClick(index)}
                disabled={!isPremium}
                className={`aspect-square rounded-xl flex items-center justify-center text-3xl transition-all ${
                  isPremium ? 'hover:scale-110 active:scale-95 cursor-pointer' : 'cursor-not-allowed opacity-60'
                } ${editingIndex === index ? 'ring-2 ring-player' : ''}`}
                style={{
                  background: 'rgba(139,0,255,0.1)',
                  border: '2px solid rgba(139,0,255,0.3)',
                  boxShadow: editingIndex === index 
                    ? '0 0 15px rgba(0,255,255,0.3)' 
                    : '0 0 10px rgba(139,0,255,0.1)',
                }}
              >
                {emote}
              </button>
            ))}
          </div>

          {/* Edit input - shows when editing (premium only) */}
          {editingIndex !== null && isPremium && (
            <div className="space-y-2 animate-fade-in">
              <p className="text-[10px] text-muted font-body text-center">
                Select 1-2 emojis for slot {editingIndex + 1}
              </p>
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={inputValue}
                  onChange={handleInputChange}
                  placeholder="Tap to select"
                  autoFocus
                  className="flex-1 px-2 py-1.5 bg-elevated border border-grid-line rounded-lg text-xl text-center focus:outline-none focus:border-player focus:shadow-glow-player-subtle transition-all placeholder:text-muted/50 placeholder:text-sm emote-input-placeholder"
                  style={{ caretColor: 'transparent', height: '40px' }}
                />
                <button
                  onClick={handleSaveEmote}
                  disabled={!inputValue}
                  className="px-3 py-1.5 rounded-lg font-body font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-40"
                  style={{
                    background: 'rgb(15, 10, 25)',
                    border: '2px solid #00FFFF',
                    color: '#00FFFF',
                    boxShadow: '0 0 10px rgba(0,255,255,0.2)',
                    height: '40px',
                  }}
                >
                  Save
                </button>
              </div>
              <button
                onClick={() => { setEditingIndex(null); setInputValue(''); }}
                className="w-full py-1.5 text-muted text-xs font-body hover:text-secondary transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Instruction text / Premium lock */}
          {editingIndex === null && (
            isPremium ? (
              <p className="text-xs text-muted font-body text-center pt-2">
                Tap an emote to customize it
              </p>
            ) : (
              <div className="text-center pt-4 pb-2">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-elevated border border-grid-line">
                  <span className="text-lg">🔒</span>
                  <span className="text-sm text-muted font-body">Upgrade to customize emotes</span>
                </div>
              </div>
            )
          )}

          {/* Reset button - premium only */}
          {editingIndex === null && isPremium && (
            <button
              onClick={handleResetToDefault}
              className="w-full py-2 text-muted text-sm font-body hover:text-error transition-colors"
            >
              Reset to defaults
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

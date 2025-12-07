import { useState, useEffect } from 'react';

interface EmoteCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  isPremium: boolean;
}

const DEFAULT_EMOTES = ['😂', '😢', '😍', '💩'];

export default function EmoteCustomizerModal({ isOpen, onClose, isPremium }: EmoteCustomizerModalProps) {
  const [emotes, setEmotes] = useState<string[]>(DEFAULT_EMOTES);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [inputValue, setInputValue] = useState('');

  // Load saved emotes from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('customEmotes');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 4) {
          setEmotes(parsed);
        }
      } catch (e) {
        console.error('Failed to parse saved emotes');
      }
    }
  }, []);

  const handleEmoteClick = (index: number) => {
    if (!isPremium) return;
    setEditingIndex(index);
    setInputValue(emotes[index]);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Extract emojis only - allow up to 2
    const emojiRegex = /\p{Emoji}/gu;
    const matches = value.match(emojiRegex) || [];
    const emojisOnly = matches.slice(0, 2).join('');
    setInputValue(emojisOnly);
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
          <h2 className="font-heading font-bold text-lg text-primary">Emotes</h2>
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
        <div className="p-4 space-y-4">
          {/* Premium gate message */}
          {!isPremium && (
            <div 
              className="flex items-center gap-3 p-3 rounded-lg"
              style={{
                background: 'rgba(255,215,0,0.1)',
                border: '1px solid rgba(255,215,0,0.3)',
              }}
            >
              <span className="text-2xl">👑</span>
              <div>
                <p className="text-gold font-body font-semibold text-sm">SudoDuel+ Feature</p>
                <p className="text-muted text-xs font-body">Upgrade to customize your emotes</p>
              </div>
            </div>
          )}

          {/* Emote slots */}
          <div className="grid grid-cols-4 gap-3">
            {emotes.map((emote, index) => (
              <button
                key={index}
                onClick={() => handleEmoteClick(index)}
                disabled={!isPremium}
                className={`aspect-square rounded-xl flex items-center justify-center text-3xl transition-all ${
                  isPremium 
                    ? 'hover:scale-110 active:scale-95 cursor-pointer' 
                    : 'opacity-60 cursor-not-allowed'
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

          {/* Edit input - shows when editing */}
          {editingIndex !== null && isPremium && (
            <div className="space-y-3 animate-fade-in">
              <p className="text-xs text-muted font-body text-center">
                Enter 1-2 emojis for slot {editingIndex + 1}
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={handleInputChange}
                  placeholder="😎"
                  autoFocus
                  className="flex-1 px-4 py-3 bg-elevated border border-grid-line rounded-lg text-3xl text-center focus:outline-none focus:border-player focus:shadow-glow-player-subtle transition-all"
                  style={{ caretColor: 'transparent' }}
                />
                <button
                  onClick={handleSaveEmote}
                  disabled={!inputValue}
                  className="px-4 py-3 rounded-lg font-body font-bold uppercase tracking-wider transition-all disabled:opacity-40"
                  style={{
                    background: 'rgb(15, 10, 25)',
                    border: '2px solid #00FFFF',
                    color: '#00FFFF',
                    boxShadow: '0 0 10px rgba(0,255,255,0.2)',
                  }}
                >
                  Save
                </button>
              </div>
              <button
                onClick={() => { setEditingIndex(null); setInputValue(''); }}
                className="w-full py-2 text-muted text-sm font-body hover:text-secondary transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Preview section */}
          {editingIndex === null && (
            <div className="pt-2">
              <p className="text-xs text-muted font-body text-center mb-3">
                {isPremium ? 'Tap an emote to customize it' : 'Your emotes during matches'}
              </p>
              
              {/* How it looks in game */}
              <div 
                className="flex items-center justify-center gap-2 p-3 rounded-lg"
                style={{
                  background: 'rgba(30,15,45,0.5)',
                  border: '1px solid rgba(139,0,255,0.2)',
                }}
              >
                {emotes.map((emote, i) => (
                  <span 
                    key={i} 
                    className="text-2xl p-2 rounded-lg"
                    style={{ background: 'rgba(139,0,255,0.1)' }}
                  >
                    {emote}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Reset button - premium only */}
          {isPremium && editingIndex === null && (
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

import { useState } from 'react';

interface EmoteCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  emotes: string[];
  onSave: (emotes: string[]) => void;
  isPremium?: boolean; // Kept for future use
}

export default function EmoteCustomizerModal({
  isOpen,
  onClose,
  emotes: initialEmotes,
  onSave,
  isPremium: _isPremium = false, // Kept for future use
}: EmoteCustomizerModalProps) {
  const [emotes, setEmotes] = useState<string[]>(initialEmotes);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [inputValue, setInputValue] = useState('');

  if (!isOpen) return null;

  const handleEmoteClick = (index: number) => {
    // Premium check removed for now - will add back later
    // if (!isPremium) return;
    setEditingIndex(index);
    setInputValue(emotes[index]);
  };

  const handleSave = () => {
    if (editingIndex !== null && inputValue.trim()) {
      const newEmotes = [...emotes];
      newEmotes[editingIndex] = inputValue.trim();
      setEmotes(newEmotes);
      setEditingIndex(null);
      setInputValue('');
    }
  };

  const handleCancel = () => {
    setEditingIndex(null);
    setInputValue('');
  };

  const handleReset = () => {
    setEmotes(initialEmotes);
    setEditingIndex(null);
    setInputValue('');
  };

  const handleSaveAll = () => {
    onSave(emotes);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-void/90 backdrop-blur-sm" />
      
      {/* Modal */}
      <div 
        className="relative bg-surface border-2 border-primary/50 rounded-xl p-6 max-w-sm w-full animate-scale-in"
        style={{
          boxShadow: '0 0 30px rgba(139,0,255,0.2), 0 10px 40px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted hover:text-primary transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Title */}
        <h2 
          className="font-heading font-bold text-2xl text-primary mb-4 text-center"
          style={{ textShadow: '0 0 10px rgba(139,0,255,0.4)' }}
        >
          Customize Emotes
        </h2>

        {/* Preview */}
        <div className="mb-6">
          <p className="text-xs text-muted font-body text-center mb-3">
            Tap an emote to customize it
          </p>
          
          {/* Emote slots */}
          <div className="grid grid-cols-4 gap-3">
            {emotes.map((emote, index) => (
              <button
                key={index}
                onClick={() => handleEmoteClick(index)}
                className={`aspect-square rounded-xl flex items-center justify-center text-3xl transition-all hover:scale-110 active:scale-95 cursor-pointer ${
                  editingIndex === index ? 'ring-2 ring-player' : ''
                }`}
                style={{
                  background: 'rgba(139,0,255,0.1)',
                  border: '2px solid rgba(139,0,255,0.3)',
                }}
              >
                {emote}
              </button>
            ))}
          </div>
        </div>

        {/* Edit input */}
        {editingIndex !== null && (
          <div className="mb-4 p-4 rounded-lg" style={{ background: 'rgba(139,0,255,0.1)' }}>
            <label className="block text-sm font-body text-muted mb-2">
              Enter emote for slot {editingIndex + 1}:
            </label>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Enter emoji or text"
              className="w-full px-3 py-2 bg-surface border border-primary/30 rounded-lg text-primary font-body focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
              maxLength={10}
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleSave}
                className="flex-1 py-2 bg-primary text-white font-body font-semibold rounded-lg hover:bg-primary/90 transition-colors"
              >
                Save
              </button>
              <button
                onClick={handleCancel}
                className="flex-1 py-2 bg-surface border border-primary/30 text-primary font-body font-semibold rounded-lg hover:bg-primary/10 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {editingIndex === null && (
            <button
              onClick={handleReset}
              className="flex-1 py-2 bg-surface border border-primary/30 text-primary font-body font-semibold rounded-lg hover:bg-primary/10 transition-colors"
            >
              Reset
            </button>
          )}
          <button
            onClick={handleSaveAll}
            className="flex-1 py-2 bg-primary text-white font-body font-semibold rounded-lg hover:bg-primary/90 transition-colors"
          >
            Save All
          </button>
        </div>
      </div>
    </div>
  );
}

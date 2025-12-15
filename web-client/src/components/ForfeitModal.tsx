interface ForfeitModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ForfeitModal({ isOpen, onConfirm, onCancel }: ForfeitModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-void/95 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-surface border border-error/30 rounded-xl p-6 max-w-xs w-full shadow-2xl animate-scale-in"
        style={{ boxShadow: '0 0 30px rgba(255,51,102,0.2)' }}>
        <h2 className="text-xl font-heading font-bold text-primary text-center mb-4 tracking-wide">
          FORFEIT MATCH?
        </h2>
        <p className="text-secondary text-center text-sm font-body mb-6">
          You will lose this match and your rating will decrease.
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={onConfirm}
            className="w-full py-3 bg-error/20 border-2 border-error text-error font-body font-semibold rounded-lg hover:bg-error/30 hover:shadow-glow-error transition-all"
          >
            Yes, Forfeit
          </button>
          <button
            onClick={onCancel}
            className="w-full py-3 bg-surface border border-grid-line text-secondary font-body font-semibold rounded-lg hover:border-player/50 hover:text-player transition-all"
          >
            Back to Game
          </button>
        </div>
      </div>
    </div>
  );
}

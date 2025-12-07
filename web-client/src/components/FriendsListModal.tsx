interface FriendsListModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FriendsListModal({ isOpen, onClose }: FriendsListModalProps) {
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
          <h2 className="font-heading font-bold text-lg text-primary">Friends</h2>
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
        <div className="p-6 text-center">
          <div className="text-5xl mb-4">👥</div>
          <h3 className="font-heading font-bold text-xl text-primary mb-2">Coming Soon</h3>
          <p className="text-secondary font-body text-sm mb-4">
            Add friends, see who's online, and challenge them to duels!
          </p>
          <div 
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full"
            style={{
              background: 'rgba(139,0,255,0.1)',
              border: '1px solid rgba(139,0,255,0.3)',
            }}
          >
            <span className="text-player font-mono text-sm">Friends feature in development</span>
          </div>
        </div>
      </div>
    </div>
  );
}

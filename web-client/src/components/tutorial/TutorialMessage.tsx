import { memo } from 'react';
import type { ReactNode } from 'react';

interface TutorialMessageProps {
  message: string;
  subMessage?: string;
  showNext?: boolean;
  onNext?: () => void;
  nextLabel?: string;
  children?: ReactNode;
  position?: 'top' | 'bottom' | 'center';
}

function TutorialMessage({ 
  message, 
  subMessage, 
  showNext, 
  onNext, 
  nextLabel = 'Next',
  children,
  position = 'bottom'
}: TutorialMessageProps) {
  const positionClasses = {
    top: 'top-24',
    bottom: 'bottom-32',
    center: 'top-1/2 -translate-y-1/2',
  };

  return (
    <div 
      className={`
        fixed left-4 right-4 z-[2510] flex justify-center
        ${positionClasses[position]}
        ${position === 'center' ? 'items-center' : ''}
      `}
      style={{ pointerEvents: 'none' }}
    >
      <div 
        className="bg-surface border border-grid-line rounded-xl p-4 max-w-sm w-full animate-fade-in"
        style={{ 
          boxShadow: '0 0 30px rgba(139, 0, 255, 0.3), 0 10px 40px rgba(0, 0, 0, 0.5)',
          pointerEvents: 'auto',
        }}
      >
        {/* Main message */}
        <p 
          className="font-heading font-bold text-lg text-primary text-center"
          style={{ textShadow: '0 0 15px rgba(0, 255, 255, 0.3)' }}
        >
          {message}
        </p>
        
        {/* Sub message */}
        {subMessage && (
          <p className="font-body text-secondary text-sm text-center mt-2">
            {subMessage}
          </p>
        )}

        {/* Custom children content */}
        {children}
        
        {/* Next button */}
        {showNext && onNext && (
          <button
            onClick={onNext}
            className="w-full mt-4 py-3 px-6 rounded-xl font-body font-semibold transition-all active:scale-[0.98]"
            style={{
              background: 'rgba(0, 255, 255, 0.1)',
              border: '2px solid rgba(0, 255, 255, 0.5)',
              color: '#00FFFF',
            }}
          >
            {nextLabel}
          </button>
        )}
      </div>
    </div>
  );
}

export default memo(TutorialMessage);


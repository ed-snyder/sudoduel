import { memo, useEffect, useState, useCallback } from 'react';
import type { RefObject } from 'react';

interface SpotlightProps {
  targetRef: RefObject<HTMLElement>;
  pulseColor?: 'cyan' | 'magenta';
  padding?: number;
  onClickOutside?: () => void;
  disabled?: boolean;
}

function TutorialSpotlight({ 
  targetRef, 
  pulseColor = 'cyan', 
  padding = 8,
  onClickOutside,
  disabled = false,
}: SpotlightProps) {
  const [bounds, setBounds] = useState<DOMRect | null>(null);

  // Update bounds on mount and resize
  useEffect(() => {
    const updateBounds = () => {
      if (targetRef.current) {
        setBounds(targetRef.current.getBoundingClientRect());
      }
    };

    updateBounds();
    
    // Update on resize/scroll
    window.addEventListener('resize', updateBounds);
    window.addEventListener('scroll', updateBounds);
    
    // Observe for DOM changes
    const observer = new MutationObserver(updateBounds);
    if (targetRef.current) {
      observer.observe(document.body, { subtree: true, childList: true });
    }

    return () => {
      window.removeEventListener('resize', updateBounds);
      window.removeEventListener('scroll', updateBounds);
      observer.disconnect();
    };
  }, [targetRef]);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (onClickOutside) {
      e.preventDefault();
      e.stopPropagation();
      onClickOutside();
    }
  }, [onClickOutside]);

  if (disabled || !bounds) return null;

  const glowColor = pulseColor === 'cyan' 
    ? 'rgba(0, 255, 255, 0.6)' 
    : 'rgba(255, 51, 102, 0.6)';
  
  const borderColor = pulseColor === 'cyan' ? '#00FFFF' : '#FF3366';

  // Calculate spotlight hole position with padding
  const holeLeft = bounds.left - padding;
  const holeTop = bounds.top - padding;
  const holeWidth = bounds.width + padding * 2;
  const holeHeight = bounds.height + padding * 2;

  return (
    <div 
      className="fixed inset-0 z-[2505]"
      onClick={handleOverlayClick}
      style={{ pointerEvents: 'auto' }}
    >
      {/* Dark overlay with SVG mask for hole */}
      <svg 
        className="absolute inset-0 w-full h-full"
        style={{ pointerEvents: 'none' }}
      >
        <defs>
          <mask id="spotlight-mask">
            {/* White = visible (dark overlay), black = transparent (hole) */}
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <rect 
              x={holeLeft} 
              y={holeTop} 
              width={holeWidth} 
              height={holeHeight} 
              rx="8"
              fill="black" 
            />
          </mask>
        </defs>
        <rect 
          x="0" 
          y="0" 
          width="100%" 
          height="100%" 
          fill="rgba(0, 0, 0, 0.75)" 
          mask="url(#spotlight-mask)" 
        />
      </svg>

      {/* Pulsing ring around the spotlight */}
      <div 
        className="absolute pointer-events-none tutorial-spotlight-pulse"
        style={{
          left: holeLeft,
          top: holeTop,
          width: holeWidth,
          height: holeHeight,
          border: `3px solid ${borderColor}`,
          borderRadius: '8px',
          boxShadow: `0 0 20px ${glowColor}, 0 0 40px ${glowColor}, inset 0 0 20px ${glowColor}`,
        }}
      />

      {/* Clickable transparent area over the spotlight hole */}
      <div 
        className="absolute"
        style={{
          left: holeLeft,
          top: holeTop,
          width: holeWidth,
          height: holeHeight,
          pointerEvents: 'none', // Let clicks pass through to target
        }}
      />
    </div>
  );
}

export default memo(TutorialSpotlight);


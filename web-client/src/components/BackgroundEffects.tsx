interface BackgroundEffectsProps {
  showGrid?: boolean; // Show animated grid overlay (default: true)
  performanceMode?: boolean; // Reduce effects for better performance during gameplay
}

export default function BackgroundEffects({ showGrid = true, performanceMode = false }: BackgroundEffectsProps) {
  // Detect mobile for reduced blur (expensive GPU operation)
  const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|Android/i.test(navigator.userAgent);

  // In performance mode on mobile, skip expensive effects entirely
  if (performanceMode && isMobile) {
    return (
      <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 1 }}>
        {/* Simple static gradient background - no blur, no animation */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at 30% 20%, rgba(0,255,255,0.08) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(139,0,255,0.06) 0%, transparent 50%)',
          }}
        />
      </div>
    );
  }

  // Reduced blur values for performance mode
  const blurAmount = performanceMode 
    ? (isMobile ? 0 : 20) 
    : (isMobile ? 20 : 60);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 1 }}>
      
      {/* Drifting gradient blobs - skip animation in performance mode */}
      <div className="absolute inset-0">
        {/* Cyan blob */}
        <div 
          className={`absolute w-[600px] h-[600px] ${performanceMode ? '' : 'animate-drift-1'}`}
          style={{
            background: 'radial-gradient(circle, rgba(0,255,255,0.15) 0%, rgba(0,255,255,0.05) 40%, transparent 70%)',
            filter: blurAmount > 0 ? `blur(${blurAmount}px)` : 'none',
            top: '-10%',
            left: '-10%',
            willChange: performanceMode ? 'auto' : 'transform',
          }}
        />
        
        {/* Magenta blob */}
        <div 
          className={`absolute w-[500px] h-[500px] ${performanceMode ? '' : 'animate-drift-2'}`}
          style={{
            background: 'radial-gradient(circle, rgba(255,0,255,0.12) 0%, rgba(255,0,255,0.04) 40%, transparent 70%)',
            filter: blurAmount > 0 ? `blur(${blurAmount + 10}px)` : 'none',
            top: '20%',
            right: '-15%',
            willChange: performanceMode ? 'auto' : 'transform',
          }}
        />
        
        {/* Purple blob */}
        <div 
          className={`absolute w-[450px] h-[450px] ${performanceMode ? '' : 'animate-drift-3'}`}
          style={{
            background: 'radial-gradient(circle, rgba(139,0,255,0.1) 0%, rgba(139,0,255,0.03) 40%, transparent 70%)',
            filter: blurAmount > 0 ? `blur(${blurAmount - 10}px)` : 'none',
            bottom: '10%',
            left: '20%',
            willChange: performanceMode ? 'auto' : 'transform',
          }}
        />
      </div>

      {/* Animated grid overlay - purple (only shown when showGrid is true) */}
      {showGrid && !performanceMode && (
        <>
          <div 
            className="absolute inset-0 pointer-events-none animate-breathe"
            style={{
              backgroundImage: `
                linear-gradient(rgba(139, 0, 255, 0.09) 1px, transparent 1px),
                linear-gradient(90deg, rgba(139, 0, 255, 0.09) 1px, transparent 1px)
              `,
              backgroundSize: '50px 50px',
            }}
          />
          
          {/* Secondary offset grid for depth - cyan tint */}
          <div 
            className="absolute inset-0 pointer-events-none animate-breathe"
            style={{
              backgroundImage: `
                linear-gradient(rgba(0, 255, 255, 0.045) 1px, transparent 1px),
                linear-gradient(90deg, rgba(0, 255, 255, 0.045) 1px, transparent 1px)
              `,
              backgroundSize: '50px 50px',
              transform: 'translate(25px, 25px)',
            }}
          />
        </>
      )}

    </div>
  );
}

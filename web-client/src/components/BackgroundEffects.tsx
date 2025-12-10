interface BackgroundEffectsProps {
  showGrid?: boolean; // Show animated grid overlay (default: true)
}

export default function BackgroundEffects({ showGrid = true }: BackgroundEffectsProps) {
  // Detect mobile for reduced blur (expensive GPU operation)
  const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|Android/i.test(navigator.userAgent);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 1 }}>
      
      {/* Drifting gradient blobs */}
      <div className="absolute inset-0">
        {/* Cyan blob */}
        <div 
          className="absolute w-[600px] h-[600px] animate-drift-1"
          style={{
            background: 'radial-gradient(circle, rgba(0,255,255,0.15) 0%, rgba(0,255,255,0.05) 40%, transparent 70%)',
            filter: `blur(${isMobile ? 20 : 60}px)`,
            top: '-10%',
            left: '-10%',
          }}
        />
        
        {/* Magenta blob */}
        <div 
          className="absolute w-[500px] h-[500px] animate-drift-2"
          style={{
            background: 'radial-gradient(circle, rgba(255,0,255,0.12) 0%, rgba(255,0,255,0.04) 40%, transparent 70%)',
            filter: `blur(${isMobile ? 20 : 70}px)`,
            top: '20%',
            right: '-15%',
          }}
        />
        
        {/* Purple blob */}
        <div 
          className="absolute w-[450px] h-[450px] animate-drift-3"
          style={{
            background: 'radial-gradient(circle, rgba(139,0,255,0.1) 0%, rgba(139,0,255,0.03) 40%, transparent 70%)',
            filter: `blur(${isMobile ? 20 : 50}px)`,
            bottom: '10%',
            left: '20%',
          }}
        />
      </div>

      {/* Animated grid overlay - purple (only shown when showGrid is true) */}
      {showGrid && (
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

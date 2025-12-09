import { useState, useEffect } from 'react';

export default function BackgroundEffects() {
  // Breathing animation for grid opacity
  const [gridOpacity, setGridOpacity] = useState(0.03);
  
  useEffect(() => {
    const interval = setInterval(() => {
      const time = Date.now() / 3000;
      setGridOpacity(0.035 + Math.sin(time) * 0.015);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 1 }}>
      
      {/* Drifting gradient blobs */}
      <div className="absolute inset-0">
        {/* Cyan blob */}
        <div 
          className="absolute w-[600px] h-[600px] animate-drift-1"
          style={{
            background: 'radial-gradient(circle, rgba(0,255,255,0.15) 0%, rgba(0,255,255,0.05) 40%, transparent 70%)',
            filter: 'blur(60px)',
            top: '-10%',
            left: '-10%',
          }}
        />
        
        {/* Magenta blob */}
        <div 
          className="absolute w-[500px] h-[500px] animate-drift-2"
          style={{
            background: 'radial-gradient(circle, rgba(255,0,255,0.12) 0%, rgba(255,0,255,0.04) 40%, transparent 70%)',
            filter: 'blur(70px)',
            top: '20%',
            right: '-15%',
          }}
        />
        
        {/* Purple blob */}
        <div 
          className="absolute w-[450px] h-[450px] animate-drift-3"
          style={{
            background: 'radial-gradient(circle, rgba(139,0,255,0.1) 0%, rgba(139,0,255,0.03) 40%, transparent 70%)',
            filter: 'blur(50px)',
            bottom: '10%',
            left: '20%',
          }}
        />
      </div>

      {/* Animated grid overlay - purple */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(139, 0, 255, ${gridOpacity}) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139, 0, 255, ${gridOpacity}) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
      />
      
      {/* Secondary offset grid for depth - cyan tint */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0, 255, 255, ${gridOpacity * 0.5}) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 255, 255, ${gridOpacity * 0.5}) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
          transform: 'translate(25px, 25px)',
        }}
      />

    </div>
  );
}

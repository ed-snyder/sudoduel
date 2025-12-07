import { useEffect, useState } from 'react';

export default function BackgroundEffects() {
  const [phase, setPhase] = useState(0);

  // Animate phase for grid color shifting
  useEffect(() => {
    const interval = setInterval(() => {
      setPhase(prev => (prev + 1) % 360);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  // Grid hue oscillates between purple (270) and shifts toward cyan (200) or magenta (320)
  const gridHue = 270 + Math.sin(phase * Math.PI / 180) * 50;
  const gridOpacity = 0.12 + Math.sin(phase * Math.PI / 90) * 0.04;

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

      {/* Animated grid - hue and opacity shift with phase */}
      <div 
        className="absolute inset-0 transition-all duration-500"
        style={{
          backgroundImage: `
            linear-gradient(hsla(${gridHue}, 80%, 50%, ${gridOpacity}) 1px, transparent 1px),
            linear-gradient(90deg, hsla(${gridHue}, 80%, 50%, ${gridOpacity}) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
      />

      {/* Secondary grid layer - offset timing for depth */}
      <div 
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(hsla(${(gridHue + 40) % 360}, 70%, 50%, ${gridOpacity * 0.4}) 1px, transparent 1px),
            linear-gradient(90deg, hsla(${(gridHue + 40) % 360}, 70%, 50%, ${gridOpacity * 0.4}) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
          transform: 'translate(25px, 25px)',
        }}
      />
    </div>
  );
}

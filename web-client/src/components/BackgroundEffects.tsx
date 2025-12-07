import { useEffect, useState } from 'react';

export default function BackgroundEffects() {
  const [gridPulse, setGridPulse] = useState(false);

  // Grid pulse every 4-7 seconds
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    
    const triggerPulse = () => {
      setGridPulse(true);
      setTimeout(() => setGridPulse(false), 600);
    };
    const scheduleNext = () => {
      const delay = 4000 + Math.random() * 3000;
      timeoutId = setTimeout(() => {
        triggerPulse();
        scheduleNext();
      }, delay);
    };
    // First pulse after 2 seconds
    const initialTimeout = setTimeout(() => {
      triggerPulse();
      scheduleNext();
    }, 2000);
    return () => {
      clearTimeout(initialTimeout);
      clearTimeout(timeoutId);
    };
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 1 }}>
      
      {/* Full screen 2D grid */}
      <div 
        className="absolute inset-0 transition-opacity duration-300"
        style={{
          backgroundImage: `
            linear-gradient(rgba(139,0,255,${gridPulse ? '0.4' : '0.15'}) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139,0,255,${gridPulse ? '0.4' : '0.15'}) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
          boxShadow: gridPulse ? 'inset 0 0 100px rgba(255,0,255,0.15)' : 'none',
        }}
      />
      {/* Grid pulse flash overlay */}
      {gridPulse && (
        <div 
          className="absolute inset-0 animate-grid-flash"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(255,0,255,0.1) 0%, transparent 70%)',
          }}
        />
      )}
      {/* Subtle ambient glows */}
      <div 
        className="absolute w-96 h-96 rounded-full animate-pulse-slow opacity-50"
        style={{
          top: '10%',
          left: '-10%',
          background: 'radial-gradient(circle, rgba(139,0,255,0.1) 0%, transparent 60%)',
        }}
      />
      <div 
        className="absolute w-80 h-80 rounded-full animate-pulse-slow opacity-50"
        style={{
          bottom: '20%',
          right: '-5%',
          background: 'radial-gradient(circle, rgba(0,255,255,0.08) 0%, transparent 60%)',
          animationDelay: '4s',
        }}
      />
    </div>
  );
}

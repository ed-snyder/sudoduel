import { useEffect, useState } from 'react';

export default function BackgroundEffects() {
  const [gridPulse, setGridPulse] = useState(false);

  // Grid pulse every 6-10 seconds (slower, smoother)
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    
    const triggerPulse = () => {
      setGridPulse(true);
      setTimeout(() => setGridPulse(false), 2000); // Longer pulse duration
    };
    const scheduleNext = () => {
      const delay = 6000 + Math.random() * 4000; // 6-10 seconds between pulses
      timeoutId = setTimeout(() => {
        triggerPulse();
        scheduleNext();
      }, delay);
    };
    // First pulse after 3 seconds
    const initialTimeout = setTimeout(() => {
      triggerPulse();
      scheduleNext();
    }, 3000);
    return () => {
      clearTimeout(initialTimeout);
      clearTimeout(timeoutId);
    };
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
      
      {/* Full screen 2D grid */}
      <div 
        className="absolute inset-0 transition-all duration-2000 ease-in-out"
        style={{
          backgroundImage: `
            linear-gradient(rgba(139,0,255,${gridPulse ? '0.25' : '0.12'}) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139,0,255,${gridPulse ? '0.25' : '0.12'}) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
          boxShadow: gridPulse ? 'inset 0 0 100px rgba(255,0,255,0.08)' : 'none',
          transition: 'background-image 2s ease-in-out, box-shadow 2s ease-in-out',
        }}
      />
      {/* Grid pulse flash overlay */}
      {gridPulse && (
        <div 
          className="absolute inset-0 animate-grid-flash"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(255,0,255,0.06) 0%, transparent 70%)',
            zIndex: 0,
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
          zIndex: 0,
        }}
      />
      <div 
        className="absolute w-80 h-80 rounded-full animate-pulse-slow opacity-50"
        style={{
          bottom: '20%',
          right: '-5%',
          background: 'radial-gradient(circle, rgba(0,255,255,0.08) 0%, transparent 60%)',
          animationDelay: '4s',
          zIndex: 0,
        }}
      />
    </div>
  );
}

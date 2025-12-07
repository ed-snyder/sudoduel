import { useEffect, useState } from 'react';

interface Comet {
  id: number;
  startX: number;
  startY: number;
  duration: number;
  color: 'cyan' | 'magenta';
  size: 'sm' | 'md' | 'lg';
}

export default function BackgroundEffects() {
  const [comets, setComets] = useState<Comet[]>([]);
  const [gridPulse, setGridPulse] = useState(false);

  // Spawn comets frequently
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    
    const spawnComet = () => {
      const newComet: Comet = {
        id: Date.now() + Math.random(),
        startX: -10 + Math.random() * 60, // Start from left side or middle
        startY: Math.random() * 70, // Anywhere in top 70%
        duration: 1.5 + Math.random() * 1, // 1.5-2.5s to cross screen
        color: Math.random() > 0.4 ? 'cyan' : 'magenta',
        size: Math.random() > 0.7 ? 'lg' : Math.random() > 0.4 ? 'md' : 'sm',
      };
      
      setComets(prev => [...prev, newComet]);
      
      setTimeout(() => {
        setComets(prev => prev.filter(c => c.id !== newComet.id));
      }, 3000);
    };
    const scheduleNext = () => {
      const delay = 800 + Math.random() * 1200; // Every 0.8-2 seconds
      timeoutId = setTimeout(() => {
        spawnComet();
        scheduleNext();
      }, delay);
    };
    // Start spawning immediately
    spawnComet();
    scheduleNext();
    return () => clearTimeout(timeoutId);
  }, []);

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

  const cometSizes = {
    sm: { width: 'w-24', height: 'h-[1px]', glow: 4 },
    md: { width: 'w-40', height: 'h-[2px]', glow: 6 },
    lg: { width: 'w-56', height: 'h-[2px]', glow: 8 },
  };

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
      {/* Comets streaking across */}
      {comets.map((comet) => (
        <div
          key={comet.id}
          className="absolute animate-comet-streak"
          style={{
            left: `${comet.startX}%`,
            top: `${comet.startY}%`,
            '--comet-duration': `${comet.duration}s`,
          } as React.CSSProperties}
        >
          {/* Comet head */}
          <div 
            className="absolute right-0 w-2 h-2 rounded-full"
            style={{
              background: comet.color === 'cyan' ? '#00FFFF' : '#FF00FF',
              boxShadow: `0 0 ${cometSizes[comet.size].glow}px ${cometSizes[comet.size].glow}px ${comet.color === 'cyan' ? 'rgba(0,255,255,0.9)' : 'rgba(255,0,255,0.9)'}`,
            }}
          />
          {/* Comet tail */}
          <div 
            className={`${cometSizes[comet.size].width} ${cometSizes[comet.size].height} rounded-full`}
            style={{
              background: `linear-gradient(to right, transparent, ${comet.color === 'cyan' ? 'rgba(0,255,255,0.8)' : 'rgba(255,0,255,0.8)'})`,
              boxShadow: `0 0 ${cometSizes[comet.size].glow}px ${comet.color === 'cyan' ? 'rgba(0,255,255,0.5)' : 'rgba(255,0,255,0.5)'}`,
            }}
          />
        </div>
      ))}
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

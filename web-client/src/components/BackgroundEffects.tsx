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

  // Spawn comets frequently
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    
    const spawnComet = () => {
      const newComet: Comet = {
        id: Date.now() + Math.random(),
        startX: -10 + Math.random() * 60,
        startY: Math.random() * 70,
        duration: 1.5 + Math.random() * 1,
        color: Math.random() > 0.4 ? 'cyan' : 'magenta',
        size: Math.random() > 0.7 ? 'lg' : Math.random() > 0.4 ? 'md' : 'sm',
      };
      
      setComets(prev => [...prev, newComet]);
      
      setTimeout(() => {
        setComets(prev => prev.filter(c => c.id !== newComet.id));
      }, 3000);
    };

    const scheduleNext = () => {
      const delay = 800 + Math.random() * 1200;
      timeoutId = setTimeout(() => {
        spawnComet();
        scheduleNext();
      }, delay);
    };

    spawnComet();
    scheduleNext();

    return () => clearTimeout(timeoutId);
  }, []);

  const cometSizes = {
    sm: { width: 'w-24', height: 'h-[1px]', glow: 4 },
    md: { width: 'w-40', height: 'h-[2px]', glow: 6 },
    lg: { width: 'w-56', height: 'h-[2px]', glow: 8 },
  };

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 1 }}>
      
      {/* Drifting gradient blobs - behind grid */}
      <div className="absolute inset-0">
        {/* Cyan blob - drifts upper left to lower right */}
        <div 
          className="absolute w-[600px] h-[600px] animate-drift-1"
          style={{
            background: 'radial-gradient(circle, rgba(0,255,255,0.15) 0%, rgba(0,255,255,0.05) 40%, transparent 70%)',
            filter: 'blur(40px)',
            top: '-10%',
            left: '-10%',
          }}
        />
        
        {/* Magenta blob - drifts upper right to lower left */}
        <div 
          className="absolute w-[500px] h-[500px] animate-drift-2"
          style={{
            background: 'radial-gradient(circle, rgba(255,0,255,0.12) 0%, rgba(255,0,255,0.04) 40%, transparent 70%)',
            filter: 'blur(50px)',
            top: '20%',
            right: '-15%',
          }}
        />
        
        {/* Purple blob - drifts in a circular pattern */}
        <div 
          className="absolute w-[450px] h-[450px] animate-drift-3"
          style={{
            background: 'radial-gradient(circle, rgba(139,0,255,0.1) 0%, rgba(139,0,255,0.03) 40%, transparent 70%)',
            filter: 'blur(45px)',
            bottom: '10%',
            left: '20%',
          }}
        />
      </div>

      {/* Grid with subtle base opacity */}
      <div 
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(139,0,255,0.15) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139,0,255,0.15) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
      />

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
          <div 
            className="absolute right-0 w-2 h-2 rounded-full"
            style={{
              background: comet.color === 'cyan' ? '#00FFFF' : '#FF00FF',
              boxShadow: `0 0 ${cometSizes[comet.size].glow}px ${cometSizes[comet.size].glow}px ${comet.color === 'cyan' ? 'rgba(0,255,255,0.9)' : 'rgba(255,0,255,0.9)'}`,
            }}
          />
          <div 
            className={`${cometSizes[comet.size].width} ${cometSizes[comet.size].height} rounded-full`}
            style={{
              background: `linear-gradient(to right, transparent, ${comet.color === 'cyan' ? 'rgba(0,255,255,0.8)' : 'rgba(255,0,255,0.8)'})`,
              boxShadow: `0 0 ${cometSizes[comet.size].glow}px ${comet.color === 'cyan' ? 'rgba(0,255,255,0.5)' : 'rgba(255,0,255,0.5)'}`,
            }}
          />
        </div>
      ))}
    </div>
  );
}

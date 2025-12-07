import { useEffect, useState } from 'react';

interface ShootingStar {
  id: number;
  x: number;
  y: number;
  angle: number;
  duration: number;
  color: 'cyan' | 'magenta';
}

interface GridPulse {
  id: number;
}

export default function BackgroundEffects() {
  const [shootingStars, setShootingStars] = useState<ShootingStar[]>([]);
  const [gridPulses, setGridPulses] = useState<GridPulse[]>([]);

  // Spawn shooting stars periodically
  useEffect(() => {
    const spawnStar = () => {
      const newStar: ShootingStar = {
        id: Date.now(),
        x: Math.random() * 100,
        y: Math.random() * 30,
        angle: 15 + Math.random() * 30,
        duration: 0.8 + Math.random() * 0.4,
        color: Math.random() > 0.5 ? 'cyan' : 'magenta',
      };
      
      setShootingStars(prev => [...prev, newStar]);
      
      setTimeout(() => {
        setShootingStars(prev => prev.filter(s => s.id !== newStar.id));
      }, 2000);
    };
    let timeoutId: ReturnType<typeof setTimeout>;
    
    const scheduleNext = () => {
      const delay = 4000 + Math.random() * 4000;
      timeoutId = setTimeout(() => {
        spawnStar();
        scheduleNext();
      }, delay);
    };
    const initialTimeout = setTimeout(() => {
      spawnStar();
      scheduleNext();
    }, 2000);
    return () => {
      clearTimeout(initialTimeout);
      clearTimeout(timeoutId);
    };
  }, []);

  // Grid pulses traveling toward viewer
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    
    const spawnPulse = () => {
      const newPulse: GridPulse = { id: Date.now() };
      setGridPulses(prev => [...prev, newPulse]);
      
      // Remove after animation completes
      setTimeout(() => {
        setGridPulses(prev => prev.filter(p => p.id !== newPulse.id));
      }, 4000);
    };
    const scheduleNext = () => {
      const delay = 2000 + Math.random() * 2000;
      timeoutId = setTimeout(() => {
        spawnPulse();
        scheduleNext();
      }, delay);
    };
    // First pulse after 1 second
    const initialTimeout = setTimeout(() => {
      spawnPulse();
      scheduleNext();
    }, 1000);
    return () => {
      clearTimeout(initialTimeout);
      clearTimeout(timeoutId);
    };
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 1 }}>
      
      {/* Sun/glow behind horizon */}
      <div 
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          top: '52%',
          width: '300px',
          height: '150px',
          background: 'radial-gradient(ellipse at center bottom, rgba(255,0,255,0.3) 0%, rgba(139,0,255,0.15) 40%, transparent 70%)',
          filter: 'blur(20px)',
        }}
      />
      {/* Horizon glow line */}
      <div 
        className="absolute left-0 right-0 h-[2px]"
        style={{
          top: '60%',
          background: 'linear-gradient(90deg, transparent 5%, rgba(255,0,255,0.6) 30%, rgba(0,255,255,0.8) 50%, rgba(255,0,255,0.6) 70%, transparent 95%)',
          boxShadow: '0 0 30px 10px rgba(255,0,255,0.4), 0 0 60px 20px rgba(0,255,255,0.2)',
        }}
      />
      {/* 3D Perspective Grid Floor */}
      <div 
        className="absolute left-0 right-0 bottom-0 overflow-hidden"
        style={{
          top: '60%',
          perspective: '400px',
          perspectiveOrigin: '50% 0%',
        }}
      >
        {/* Grid surface */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              repeating-linear-gradient(
                90deg,
                transparent 0px,
                transparent 58px,
                rgba(139,0,255,0.4) 58px,
                rgba(139,0,255,0.4) 60px
              ),
              repeating-linear-gradient(
                0deg,
                transparent 0px,
                transparent 38px,
                rgba(139,0,255,0.3) 38px,
                rgba(139,0,255,0.3) 40px
              )
            `,
            transform: 'rotateX(75deg)',
            transformOrigin: 'top center',
          }}
        />
        {/* Animated grid pulses traveling toward viewer */}
        {gridPulses.map((pulse) => (
          <div
            key={pulse.id}
            className="absolute left-0 right-0 h-[3px] animate-grid-pulse-3d"
            style={{
              background: 'linear-gradient(90deg, transparent 10%, rgba(0,255,255,0.8) 30%, rgba(255,255,255,0.9) 50%, rgba(0,255,255,0.8) 70%, transparent 90%)',
              boxShadow: '0 0 20px 4px rgba(0,255,255,0.6), 0 0 40px 8px rgba(0,255,255,0.3)',
              transformOrigin: 'top center',
            }}
          />
        ))}
      </div>
      {/* Vertical grid lines with perspective (overlay for extra depth) */}
      <div 
        className="absolute left-0 right-0 bottom-0 overflow-hidden opacity-30"
        style={{
          top: '60%',
        }}
      >
        {[...Array(11)].map((_, i) => {
          const position = (i - 5) * 10 + 50; // -50% to 50% from center
          const spread = Math.abs(i - 5) * 2; // Lines spread more at edges
          return (
            <div
              key={i}
              className="absolute bottom-0 w-[1px]"
              style={{
                left: `${position + spread * (i > 5 ? 1 : -1)}%`,
                height: '100%',
                background: `linear-gradient(to bottom, rgba(139,0,255,0.6) 0%, rgba(139,0,255,0.2) 100%)`,
                transform: `perspective(200px) rotateY(${(i - 5) * 3}deg)`,
              }}
            />
          );
        })}
      </div>
      {/* Shooting Stars (in the sky area) */}
      {shootingStars.map((star) => (
        <div
          key={star.id}
          className="absolute animate-shooting-star"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            '--star-angle': `${star.angle}deg`,
            '--star-duration': `${star.duration}s`,
          } as React.CSSProperties}
        >
          <div 
            className="w-1 h-1 rounded-full"
            style={{
              background: star.color === 'cyan' ? '#00FFFF' : '#FF00FF',
              boxShadow: `0 0 6px 2px ${star.color === 'cyan' ? 'rgba(0,255,255,0.8)' : 'rgba(255,0,255,0.8)'}`,
            }}
          />
          <div 
            className="absolute top-0 right-full w-20 h-[2px] origin-right"
            style={{
              background: `linear-gradient(to left, ${star.color === 'cyan' ? 'rgba(0,255,255,0.8)' : 'rgba(255,0,255,0.8)'}, transparent)`,
            }}
          />
        </div>
      ))}
      {/* Ambient glow in sky */}
      <div 
        className="absolute w-96 h-64 rounded-full animate-pulse-slow"
        style={{
          top: '5%',
          left: '5%',
          background: 'radial-gradient(circle, rgba(139,0,255,0.06) 0%, transparent 70%)',
        }}
      />
      <div 
        className="absolute w-64 h-48 rounded-full animate-pulse-slow"
        style={{
          top: '10%',
          right: '10%',
          background: 'radial-gradient(circle, rgba(0,255,255,0.05) 0%, transparent 70%)',
          animationDelay: '3s',
        }}
      />
    </div>
  );
}

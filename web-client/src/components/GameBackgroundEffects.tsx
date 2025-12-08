import { useEffect, useState } from 'react';

interface GameBackgroundEffectsProps {
  playerScored?: boolean; // Trigger cyan pulse
  opponentScored?: boolean; // Trigger magenta pulse
  mistakeMade?: boolean; // Trigger dim/contract
  timeRemaining?: number; // For intensity scaling
  criticalTime?: number; // Threshold for critical state (default 30)
}

export default function GameBackgroundEffects({ 
  playerScored, 
  opponentScored, 
  mistakeMade,
  timeRemaining = 999,
  criticalTime = 30 
}: GameBackgroundEffectsProps) {
  const [cyanPulse, setCyanPulse] = useState(false);
  const [magentaPulse, setMagentaPulse] = useState(false);
  const [dimmed, setDimmed] = useState(false);

  // Cyan pulse on player score
  useEffect(() => {
    if (playerScored) {
      setCyanPulse(true);
      setTimeout(() => setCyanPulse(false), 400);
    }
  }, [playerScored]);

  // Magenta pulse on opponent score
  useEffect(() => {
    if (opponentScored) {
      setMagentaPulse(true);
      setTimeout(() => setMagentaPulse(false), 400);
    }
  }, [opponentScored]);

  // Dim on mistake
  useEffect(() => {
    if (mistakeMade) {
      setDimmed(true);
      setTimeout(() => setDimmed(false), 300);
    }
  }, [mistakeMade]);

  const isCritical = timeRemaining < criticalTime;
  const isWarning = timeRemaining < 60;
  const vignetteIntensity = isCritical ? 0.7 : isWarning ? 0.5 : 0.3;

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: -1 }}>
      
      {/* Drifting gradient blobs - 5 total, faster than lobby */}
      <div className="absolute inset-0">
        {/* Cyan blob 1 - larger, main */}
        <div 
          className={`absolute w-[500px] h-[500px] transition-transform duration-300 ${cyanPulse ? 'scale-125' : ''} ${dimmed ? 'scale-90 opacity-50' : ''}`}
          style={{
            background: 'radial-gradient(circle, rgba(0,255,255,0.18) 0%, rgba(0,255,255,0.06) 40%, transparent 70%)',
            filter: 'blur(50px)',
            top: '-5%',
            left: '-10%',
            animation: 'drift-battle-1 16s ease-in-out infinite',
          }}
        />
        
        {/* Cyan blob 2 - smaller, different path */}
        <div 
          className={`absolute w-[350px] h-[350px] transition-transform duration-300 ${cyanPulse ? 'scale-125' : ''} ${dimmed ? 'scale-90 opacity-50' : ''}`}
          style={{
            background: 'radial-gradient(circle, rgba(0,255,255,0.14) 0%, rgba(0,255,255,0.04) 40%, transparent 70%)',
            filter: 'blur(45px)',
            bottom: '10%',
            left: '5%',
            animation: 'drift-battle-2 14s ease-in-out infinite',
            animationDelay: '-5s',
          }}
        />
        
        {/* Magenta blob 1 - larger, main */}
        <div 
          className={`absolute w-[450px] h-[450px] transition-transform duration-300 ${magentaPulse ? 'scale-125' : ''} ${dimmed ? 'scale-90 opacity-50' : ''}`}
          style={{
            background: 'radial-gradient(circle, rgba(255,0,255,0.16) 0%, rgba(255,0,255,0.05) 40%, transparent 70%)',
            filter: 'blur(55px)',
            top: '15%',
            right: '-10%',
            animation: 'drift-battle-3 18s ease-in-out infinite',
            animationDelay: '-3s',
          }}
        />
        
        {/* Magenta blob 2 - smaller, different path */}
        <div 
          className={`absolute w-[300px] h-[300px] transition-transform duration-300 ${magentaPulse ? 'scale-125' : ''} ${dimmed ? 'scale-90 opacity-50' : ''}`}
          style={{
            background: 'radial-gradient(circle, rgba(255,0,255,0.12) 0%, rgba(255,0,255,0.03) 40%, transparent 70%)',
            filter: 'blur(40px)',
            bottom: '20%',
            right: '10%',
            animation: 'drift-battle-4 12s ease-in-out infinite',
            animationDelay: '-8s',
          }}
        />
        
        {/* Purple anchor blob - center */}
        <div 
          className={`absolute w-[400px] h-[400px] transition-transform duration-300 ${dimmed ? 'scale-90 opacity-50' : ''}`}
          style={{
            background: 'radial-gradient(circle, rgba(139,0,255,0.12) 0%, rgba(139,0,255,0.04) 40%, transparent 70%)',
            filter: 'blur(50px)',
            top: '40%',
            left: '30%',
            animation: 'drift-battle-5 20s ease-in-out infinite',
            animationDelay: '-10s',
          }}
        />
        
        {/* Deep Purple - largest, slowest, deepest layer */}
        <div 
          className={`absolute transition-transform duration-300 ${dimmed ? 'scale-90 opacity-50' : ''}`}
          style={{
            top: '10%',
            left: '-20%',
            width: '80vw',
            height: '80vw',
            maxWidth: '600px',
            maxHeight: '600px',
            background: 'radial-gradient(circle, rgba(61, 21, 128, 0.2) 0%, transparent 70%)',
            borderRadius: '50%',
            filter: 'blur(60px)',
            animation: 'blob-drift-1 35s ease-in-out infinite',
            pointerEvents: 'none',
          }}
        />
        
        {/* Accent Purple - medium size, mid layer */}
        <div 
          className={`absolute transition-transform duration-300 ${dimmed ? 'scale-90 opacity-50' : ''}`}
          style={{
            bottom: '15%',
            right: '-15%',
            width: '50vw',
            height: '50vw',
            maxWidth: '400px',
            maxHeight: '400px',
            background: 'radial-gradient(circle, rgba(139, 0, 255, 0.12) 0%, transparent 70%)',
            borderRadius: '50%',
            filter: 'blur(50px)',
            animation: 'blob-drift-2 25s ease-in-out infinite',
            pointerEvents: 'none',
          }}
        />
        
        {/* Dark Magenta - smaller, adds variety */}
        <div 
          className={`absolute transition-transform duration-300 ${dimmed ? 'scale-90 opacity-50' : ''}`}
          style={{
            top: '50%',
            right: '10%',
            width: '35vw',
            height: '35vw',
            maxWidth: '300px',
            maxHeight: '300px',
            background: 'radial-gradient(circle, rgba(92, 0, 128, 0.15) 0%, transparent 70%)',
            borderRadius: '50%',
            filter: 'blur(45px)',
            animation: 'blob-drift-3 20s ease-in-out infinite',
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Remove the grid pattern - just solid color background shows through */}
      {/* Grid pattern removed per request */}

      {/* Vignette overlay - intensifies at low time */}
      <div 
        className="absolute inset-0 transition-opacity duration-500"
        style={{
          background: `radial-gradient(circle at center, transparent 30%, rgba(0,0,0,${vignetteIntensity}) 100%)`,
        }}
      />

      {/* Critical time red edge glow */}
      {isCritical && (
        <div 
          className="absolute inset-0 animate-pulse"
          style={{
            background: 'radial-gradient(circle at center, transparent 60%, rgba(255,51,102,0.15) 100%)',
          }}
        />
      )}
    </div>
  );
}

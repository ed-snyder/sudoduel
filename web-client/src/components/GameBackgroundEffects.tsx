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
      
      {/* LAYER 1: Far background (slowest, largest, most subtle) */}
      <div className="absolute inset-0">
        <div 
          className={`absolute transition-transform duration-300 ${dimmed ? 'scale-90 opacity-50' : ''}`}
          style={{
            top: '-10%',
            left: '-20%',
            width: '90vw',
            height: '90vw',
            maxWidth: 700,
            maxHeight: 700,
            background: 'radial-gradient(circle, rgba(61, 21, 128, 0.12) 0%, rgba(61, 21, 128, 0.03) 40%, transparent 70%)',
            borderRadius: '50%',
            filter: 'blur(60px)',
            animation: 'driftFar1 40s ease-in-out infinite',
          }}
        />
        <div 
          className={`absolute transition-transform duration-300 ${dimmed ? 'scale-90 opacity-50' : ''}`}
          style={{
            bottom: '-15%',
            right: '-25%',
            width: '85vw',
            height: '85vw',
            maxWidth: 650,
            maxHeight: 650,
            background: 'radial-gradient(circle, rgba(92, 0, 128, 0.1) 0%, rgba(92, 0, 128, 0.02) 40%, transparent 70%)',
            borderRadius: '50%',
            filter: 'blur(55px)',
            animation: 'driftFar2 35s ease-in-out infinite',
            animationDelay: '-15s',
          }}
        />
      </div>

      {/* LAYER 2: Mid-ground (medium speed, reactive to scoring) */}
      <div className="absolute inset-0">
        <div 
          className={`absolute transition-transform duration-300 ${cyanPulse ? 'scale-125' : ''} ${dimmed ? 'scale-90 opacity-50' : ''}`}
          style={{
            top: '-5%',
            left: '-10%',
            width: '500px',
            height: '500px',
            background: 'radial-gradient(circle, rgba(0,255,255,0.18) 0%, rgba(0,255,255,0.06) 40%, transparent 70%)',
            borderRadius: '50%',
            filter: 'blur(50px)',
            animation: 'driftMid1 20s ease-in-out infinite',
          }}
        />
        <div 
          className={`absolute transition-transform duration-300 ${magentaPulse ? 'scale-125' : ''} ${dimmed ? 'scale-90 opacity-50' : ''}`}
          style={{
            top: '15%',
            right: '-10%',
            width: '450px',
            height: '450px',
            background: 'radial-gradient(circle, rgba(255,0,255,0.16) 0%, rgba(255,0,255,0.05) 40%, transparent 70%)',
            borderRadius: '50%',
            filter: 'blur(55px)',
            animation: 'driftMid2 22s ease-in-out infinite',
            animationDelay: '-8s',
          }}
        />
      </div>

      {/* LAYER 3: Near foreground (fastest, smallest, most vibrant) */}
      <div className="absolute inset-0">
        <div 
          className={`absolute transition-transform duration-300 ${cyanPulse ? 'scale-125' : ''} ${dimmed ? 'scale-90 opacity-50' : ''}`}
          style={{
            bottom: '10%',
            left: '5%',
            width: '300px',
            height: '300px',
            background: 'radial-gradient(circle, rgba(0,255,255,0.14) 0%, rgba(0,255,255,0.04) 40%, transparent 70%)',
            borderRadius: '50%',
            filter: 'blur(40px)',
            animation: 'driftNear1 14s ease-in-out infinite',
            animationDelay: '-5s',
          }}
        />
        <div 
          className={`absolute transition-transform duration-300 ${magentaPulse ? 'scale-125' : ''} ${dimmed ? 'scale-90 opacity-50' : ''}`}
          style={{
            bottom: '20%',
            right: '10%',
            width: '280px',
            height: '280px',
            background: 'radial-gradient(circle, rgba(255,0,255,0.12) 0%, rgba(255,0,255,0.03) 40%, transparent 70%)',
            borderRadius: '50%',
            filter: 'blur(38px)',
            animation: 'driftNear2 12s ease-in-out infinite',
            animationDelay: '-3s',
          }}
        />
        <div 
          className={`absolute transition-transform duration-300 ${dimmed ? 'scale-90 opacity-50' : ''}`}
          style={{
            top: '40%',
            left: '30%',
            width: '320px',
            height: '320px',
            background: 'radial-gradient(circle, rgba(139,0,255,0.12) 0%, rgba(139,0,255,0.04) 40%, transparent 70%)',
            borderRadius: '50%',
            filter: 'blur(45px)',
            animation: 'driftNear3 16s ease-in-out infinite',
            animationDelay: '-10s',
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

      {/* Film grain / noise texture overlay */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%' height='100%' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          mixBlendMode: 'overlay',
        }}
      />
    </div>
  );
}

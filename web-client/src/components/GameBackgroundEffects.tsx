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
      
      {/* LAYER 1: Far background - slowest, largest, most subtle (deep purples) */}
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
            background: 'radial-gradient(circle, rgba(61, 21, 128, 0.15) 0%, rgba(61, 21, 128, 0.04) 40%, transparent 70%)',
            borderRadius: '50%',
            filter: 'blur(60px)',
            animation: 'driftFar1 45s ease-in-out infinite',
          }}
        />
        <div 
          className={`absolute transition-transform duration-300 ${dimmed ? 'scale-90 opacity-50' : ''}`}
          style={{
            bottom: '-15%',
            right: '-25%',
            width: '80vw',
            height: '80vw',
            maxWidth: 600,
            maxHeight: 600,
            background: 'radial-gradient(circle, rgba(92, 0, 128, 0.12) 0%, rgba(92, 0, 128, 0.03) 40%, transparent 70%)',
            borderRadius: '50%',
            filter: 'blur(55px)',
            animation: 'driftFar2 40s ease-in-out infinite',
            animationDelay: '-20s',
          }}
        />
      </div>

      {/* LAYER 2: Mid-ground - medium speed, reactive to scoring (cyan/magenta) */}
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
            animation: 'driftMid1 22s ease-in-out infinite',
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
            animation: 'driftMid2 25s ease-in-out infinite',
            animationDelay: '-10s',
          }}
        />
      </div>

      {/* LAYER 3: Near foreground - fastest, smaller, more vibrant */}
      <div className="absolute inset-0">
        <div 
          className={`absolute transition-transform duration-300 ${cyanPulse ? 'scale-125' : ''} ${dimmed ? 'scale-90 opacity-50' : ''}`}
          style={{
            bottom: '10%',
            left: '5%',
            width: '350px',
            height: '350px',
            background: 'radial-gradient(circle, rgba(0,255,255,0.14) 0%, rgba(0,255,255,0.04) 40%, transparent 70%)',
            borderRadius: '50%',
            filter: 'blur(45px)',
            animation: 'driftNear1 15s ease-in-out infinite',
            animationDelay: '-5s',
          }}
        />
        <div 
          className={`absolute transition-transform duration-300 ${magentaPulse ? 'scale-125' : ''} ${dimmed ? 'scale-90 opacity-50' : ''}`}
          style={{
            bottom: '25%',
            right: '8%',
            width: '300px',
            height: '300px',
            background: 'radial-gradient(circle, rgba(255,0,255,0.12) 0%, rgba(255,0,255,0.03) 40%, transparent 70%)',
            borderRadius: '50%',
            filter: 'blur(40px)',
            animation: 'driftNear2 13s ease-in-out infinite',
            animationDelay: '-3s',
          }}
        />
        <div 
          className={`absolute transition-transform duration-300 ${dimmed ? 'scale-90 opacity-50' : ''}`}
          style={{
            top: '45%',
            left: '25%',
            width: '320px',
            height: '320px',
            background: 'radial-gradient(circle, rgba(139,0,255,0.12) 0%, rgba(139,0,255,0.04) 40%, transparent 70%)',
            borderRadius: '50%',
            filter: 'blur(45px)',
            animation: 'driftNear3 17s ease-in-out infinite',
            animationDelay: '-8s',
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

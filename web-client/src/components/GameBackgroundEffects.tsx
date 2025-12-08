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

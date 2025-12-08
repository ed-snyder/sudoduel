interface GameBackgroundEffectsProps {
  timeRemaining?: number; // For intensity scaling
  criticalTime?: number; // Threshold for critical state (default 30)
}

export default function GameBackgroundEffects({ 
  timeRemaining = 999,
  criticalTime = 30 
}: GameBackgroundEffectsProps) {
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

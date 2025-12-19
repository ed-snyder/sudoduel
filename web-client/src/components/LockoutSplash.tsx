import './Lockout.css';

export default function LockoutSplash() {
  const displayText = "OUT OF TIME!";
  
  // Colors matching GameEndOverlay/VICTORY style (magenta with cyan glow)
  const fillColor = '#FF00FF';
  const fillColorLight = '#FF7FFF';
  const fillColorDark = '#B300B3';
  const glowColor = '#00FFFF';

  return (
    <div className="lockout-splash">
      <div className="lockout-splash-text-container">
        {/* Outer glow layer */}
        <span
          className="absolute inset-0 lockout-splash-layer"
          style={{
            fontFamily: "'Industry', 'Orbitron', sans-serif",
            fontWeight: 900,
            fontStyle: 'italic',
            letterSpacing: '-0.02em',
            color: 'transparent',
            WebkitTextStroke: `8px ${glowColor}`,
            filter: 'blur(12px)',
            opacity: 0.5,
          }}
          aria-hidden="true"
        >
          {displayText}
        </span>

        {/* Inner glow layer */}
        <span
          className="absolute inset-0 lockout-splash-layer"
          style={{
            fontFamily: "'Industry', 'Orbitron', sans-serif",
            fontWeight: 900,
            fontStyle: 'italic',
            letterSpacing: '-0.02em',
            color: 'transparent',
            WebkitTextStroke: `5px ${glowColor}`,
            filter: 'blur(4px)',
            opacity: 0.7,
          }}
          aria-hidden="true"
        >
          {displayText}
        </span>

        {/* White stroke layer */}
        <span
          className="absolute inset-0 lockout-splash-layer"
          style={{
            fontFamily: "'Industry', 'Orbitron', sans-serif",
            fontWeight: 900,
            fontStyle: 'italic',
            letterSpacing: '-0.02em',
            color: 'transparent',
            WebkitTextStroke: '3px rgba(255,255,255,0.9)',
          }}
          aria-hidden="true"
        >
          {displayText}
        </span>

        {/* Fill gradient - main visible text */}
        <span
          className="relative lockout-splash-fill"
          style={{
            fontFamily: "'Industry', 'Orbitron', sans-serif",
            fontWeight: 900,
            fontStyle: 'italic',
            letterSpacing: '-0.02em',
            background: `linear-gradient(180deg, ${fillColorLight} 0%, ${fillColor} 50%, ${fillColorDark} 100%)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          {displayText}
        </span>

        {/* Shimmer overlay - animating gradient */}
        <span
          className="absolute inset-0 lockout-splash-layer"
          style={{
            fontFamily: "'Industry', 'Orbitron', sans-serif",
            fontWeight: 900,
            fontStyle: 'italic',
            letterSpacing: '-0.02em',
            background: `linear-gradient(
              120deg, 
              transparent 0%, 
              transparent 30%, 
              rgba(255,255,255,0.4) 50%, 
              transparent 70%, 
              transparent 100%
            )`,
            backgroundSize: '200% 100%',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            animation: 'logo-shimmer 3s ease-in-out infinite',
          }}
          aria-hidden="true"
        >
          {displayText}
        </span>
      </div>
    </div>
  );
}

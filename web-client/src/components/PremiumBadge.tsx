export default function PremiumBadge() {
  return (
    <div 
      className="flex-1 py-3 px-4 rounded-xl flex items-center justify-center"
      style={{
        background: 'rgba(10, 5, 20, 0.95)',
        border: '2px solid #00FFFF',
        boxShadow: '0 0 15px rgba(0, 255, 255, 0.2)',
      }}
    >
      {/* Text container with shimmer - matches DRAW text exactly */}
      <div className="relative select-none">
        {/* Base silver gradient text - same as DRAW */}
        <span
          style={{
            fontFamily: "'Industry', 'Orbitron', sans-serif",
            fontWeight: 900,
            fontStyle: 'italic',
            letterSpacing: '-0.02em',
            fontSize: '1rem', // text-base equivalent
            background: 'linear-gradient(180deg, #FFFFFF 0%, #B8B8B8 50%, #888888 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Sudoduel+
        </span>
        
        {/* Shimmer overlay on text - same as DRAW */}
        <span
          className="absolute inset-0 pointer-events-none select-none"
          style={{
            fontFamily: "'Industry', 'Orbitron', sans-serif",
            fontWeight: 900,
            fontStyle: 'italic',
            letterSpacing: '-0.02em',
            fontSize: '1rem', // text-base equivalent
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
          Sudoduel+
        </span>
      </div>
    </div>
  );
}

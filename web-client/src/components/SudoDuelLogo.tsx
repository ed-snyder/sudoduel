import type { CSSProperties } from 'react';

interface SudoDuelLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  animated?: boolean;
}

export default function SudoDuelLogo({ className = '', size = 'lg', animated = true }: SudoDuelLogoProps) {
  const sizeMap = {
    sm: 'text-3xl',
    md: 'text-4xl',
    lg: 'text-5xl',
    xl: 'text-6xl',
  };

  const logoStyle: CSSProperties = {
    fontFamily: "'Industry', 'Orbitron', sans-serif",
    fontWeight: 900,
    fontStyle: 'italic',
    letterSpacing: '-0.02em',
    textTransform: 'uppercase',
  };

  return (
    <div className={`relative ${animated ? 'animate-float' : ''} ${className}`}>
      {/* Purple outer glow layer */}
      <span
        className={`${sizeMap[size]} absolute inset-0 select-none pointer-events-none`}
        style={{
          ...logoStyle,
          color: 'transparent',
          WebkitTextStroke: '8px #8B00FF',
          filter: 'blur(8px)',
          opacity: 0.7,
        }}
        aria-hidden="true"
      >
        SUDODUEL
      </span>

      {/* Magenta glow layer */}
      <span
        className={`${sizeMap[size]} absolute inset-0 select-none pointer-events-none`}
        style={{
          ...logoStyle,
          color: 'transparent',
          WebkitTextStroke: '6px #FF00FF',
          filter: 'blur(4px)',
          opacity: 0.8,
        }}
        aria-hidden="true"
      >
        SUDODUEL
      </span>

      {/* White stroke layer */}
      <span
        className={`${sizeMap[size]} absolute inset-0 select-none pointer-events-none`}
        style={{
          ...logoStyle,
          color: 'transparent',
          WebkitTextStroke: '3px #FFFFFF',
        }}
        aria-hidden="true"
      >
        SUDODUEL
      </span>

      {/* Cyan gradient fill - main visible text */}
      <span
        className={`${sizeMap[size]} relative select-none ${animated ? 'animate-logo-shimmer' : ''}`}
        style={{
          ...logoStyle,
          background: 'linear-gradient(135deg, #00B3B3 0%, #00CCCC 25%, #00B3B3 50%, #008080 75%, #00B3B3 100%)',
          backgroundSize: '200% 200%',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        SUDODUEL
      </span>
    </div>
  );
}

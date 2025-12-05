import { useMemo } from 'react';

interface ProgressBarProps {
  progress: number; // 0-100
  color: 'blue' | 'pink';
  className?: string;
}

export function ProgressBar({ progress, color, className }: ProgressBarProps) {
  // Clamp progress between 0-100
  const clampedProgress = Math.max(0, Math.min(100, progress));

  // Determine glow tier based on progress
  const glowStyle = useMemo(() => {
    if (clampedProgress >= 100) {
      return {
        boxShadow: '0 0 16px rgba(234, 179, 8, 0.8), 0 0 30px rgba(234, 179, 8, 0.5)',
        borderColor: '#EAB308',
        borderWidth: '2px',
      };
    } else if (clampedProgress >= 90) {
      return {
        boxShadow: '0 0 12px rgba(245, 158, 11, 0.6), 0 0 20px rgba(245, 158, 11, 0.3)',
        borderColor: '#F59E0B',
        borderWidth: '2px',
      };
    } else if (clampedProgress >= 75) {
      return {
        boxShadow: '0 0 8px rgba(245, 158, 11, 0.4)',
        borderColor: '#D97706',
        borderWidth: '1px',
      };
    } else if (clampedProgress >= 50) {
      return {
        borderColor: 'rgba(217, 119, 6, 0.3)',
        borderWidth: '1px',
      };
    }
    return {
      borderColor: 'transparent',
      borderWidth: '1px',
    };
  }, [clampedProgress]);

  const baseColor = color === 'blue' ? '#3B82F6' : '#EC4899';
  const isComplete = clampedProgress >= 100;

  return (
    <div
      className={`rounded-full overflow-hidden bg-gray-700/50 transition-all duration-300 ${
        isComplete ? 'progress-complete' : ''
      } ${className || ''}`}
      style={{
        width: className?.includes('w-full') ? '100%' : '120px',
        height: '14px',
        ...glowStyle,
      }}
    >
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{
          width: `${clampedProgress}%`,
          background: `linear-gradient(
            to bottom,
            rgba(255,255,255,0.3) 0%,
            transparent 50%,
            rgba(0,0,0,0.2) 100%
          ), ${baseColor}`,
        }}
      />
    </div>
  );
}


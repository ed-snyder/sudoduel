import { useMemo } from 'react';

interface ProgressBarProps {
  progress: number; // 0-100
  color: 'blue' | 'pink';
  className?: string;
}

export function ProgressBar({ progress, color, className }: ProgressBarProps) {
  // Clamp progress between 0-100
  const clampedProgress = Math.max(0, Math.min(100, progress));

  // Determine glow tier based on progress - stronger glows
  const glowStyle = useMemo(() => {
    if (clampedProgress >= 100) {
      return {
        boxShadow: '0 0 24px rgba(234, 179, 8, 1), 0 0 40px rgba(234, 179, 8, 0.8), 0 0 60px rgba(234, 179, 8, 0.5)',
        borderColor: '#EAB308',
        borderWidth: '2px',
      };
    } else if (clampedProgress >= 90) {
      return {
        boxShadow: '0 0 20px rgba(245, 158, 11, 0.9), 0 0 35px rgba(245, 158, 11, 0.6), 0 0 50px rgba(245, 158, 11, 0.4)',
        borderColor: '#F59E0B',
        borderWidth: '2px',
      };
    } else if (clampedProgress >= 75) {
      return {
        boxShadow: '0 0 16px rgba(245, 158, 11, 0.7), 0 0 28px rgba(245, 158, 11, 0.5)',
        borderColor: '#D97706',
        borderWidth: '2px',
      };
    } else if (clampedProgress >= 50) {
      return {
        boxShadow: '0 0 8px rgba(217, 119, 6, 0.5)',
        borderColor: 'rgba(217, 119, 6, 0.6)',
        borderWidth: '1px',
      };
    }
    return {
      borderColor: 'transparent',
      borderWidth: '1px',
    };
  }, [clampedProgress]);

  // Brighter solid colors - no gradient
  const baseColor = color === 'blue' ? '#60A5FA' : '#F472B6'; // Brighter blue-400 and pink-400
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
          backgroundColor: baseColor,
        }}
      />
    </div>
  );
}


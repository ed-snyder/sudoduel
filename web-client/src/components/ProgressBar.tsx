import { useMemo } from 'react';

interface ProgressBarProps {
  progress: number; // 0-100
  color: 'blue' | 'pink';
  className?: string;
}

export function ProgressBar({ progress, color, className }: ProgressBarProps) {
  // Clamp progress between 0-100
  const clampedProgress = Math.max(0, Math.min(100, progress));

  // Determine glow tier based on progress - stronger glows with more gold color
  const glowStyle = useMemo(() => {
    if (clampedProgress >= 100) {
      return {
        boxShadow: '0 0 40px rgba(255, 215, 0, 1), 0 0 70px rgba(255, 215, 0, 0.9), 0 0 100px rgba(255, 215, 0, 0.7), 0 0 130px rgba(255, 215, 0, 0.5)',
        borderColor: '#FFD700', // Pure gold
        borderWidth: '3px',
      };
    } else if (clampedProgress >= 90) {
      return {
        boxShadow: '0 0 35px rgba(255, 200, 0, 1), 0 0 60px rgba(255, 200, 0, 0.8), 0 0 85px rgba(255, 200, 0, 0.6)',
        borderColor: '#FFC800', // Bright gold
        borderWidth: '3px',
      };
    } else if (clampedProgress >= 75) {
      return {
        boxShadow: '0 0 28px rgba(255, 193, 7, 0.9), 0 0 50px rgba(255, 193, 7, 0.7)',
        borderColor: '#FFC107', // Amber gold
        borderWidth: '2px',
      };
    } else if (clampedProgress >= 50) {
      return {
        boxShadow: '0 0 15px rgba(255, 193, 7, 0.6)',
        borderColor: 'rgba(255, 193, 7, 0.7)',
        borderWidth: '2px',
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
      className={`rounded-full overflow-hidden bg-gray-300/40 transition-all duration-150 ${
        isComplete ? 'progress-complete' : ''
      } ${className || ''}`}
      style={{
        width: className?.includes('w-full') ? '100%' : '120px',
        height: '14px',
        ...glowStyle,
      }}
    >
      <div
        className="h-full rounded-full transition-all duration-150"
        style={{
          width: `${clampedProgress}%`,
          backgroundColor: baseColor,
        }}
      />
    </div>
  );
}


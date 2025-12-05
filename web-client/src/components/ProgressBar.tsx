import { useMemo } from 'react';

interface ProgressBarProps {
  progress: number; // 0-100
  color: 'blue' | 'pink';
  className?: string;
  cellsCompleted?: number; // Number of cells completed (0-81)
}

export function ProgressBar({ progress, color, className, cellsCompleted = 0 }: ProgressBarProps) {
  // Clamp progress between 0-100
  const clampedProgress = Math.max(0, Math.min(100, progress));

  // Calculate gold opacity proportional to cells completed (0-81)
  // Gold starts appearing at 20 cells (25%) and reaches full intensity at 81 cells
  const totalCells = 81;
  const goldStartThreshold = 20; // Start showing gold at 20 cells
  const goldOpacity = cellsCompleted >= goldStartThreshold 
    ? Math.min(1, (cellsCompleted - goldStartThreshold) / (totalCells - goldStartThreshold))
    : 0;

  // Determine glow tier based on progress - gold opacity scales with cells completed
  const glowStyle = useMemo(() => {
    if (clampedProgress >= 100) {
      const opacity = goldOpacity;
      return {
        boxShadow: `0 0 40px rgba(255, 215, 0, ${opacity}), 0 0 70px rgba(255, 215, 0, ${opacity * 0.9}), 0 0 100px rgba(255, 215, 0, ${opacity * 0.7}), 0 0 130px rgba(255, 215, 0, ${opacity * 0.5})`,
        borderColor: `rgba(255, 215, 0, ${opacity})`, // Pure gold
        borderWidth: '3px',
      };
    } else if (clampedProgress >= 90) {
      const opacity = goldOpacity * 0.95;
      return {
        boxShadow: `0 0 35px rgba(255, 200, 0, ${opacity}), 0 0 60px rgba(255, 200, 0, ${opacity * 0.8}), 0 0 85px rgba(255, 200, 0, ${opacity * 0.6})`,
        borderColor: `rgba(255, 200, 0, ${opacity})`, // Bright gold
        borderWidth: '3px',
      };
    } else if (clampedProgress >= 75) {
      const opacity = goldOpacity * 0.85;
      return {
        boxShadow: `0 0 28px rgba(255, 193, 7, ${opacity}), 0 0 50px rgba(255, 193, 7, ${opacity * 0.7})`,
        borderColor: `rgba(255, 193, 7, ${opacity})`, // Amber gold
        borderWidth: '2px',
      };
    } else if (clampedProgress >= 50) {
      const opacity = goldOpacity * 0.7;
      return {
        boxShadow: `0 0 15px rgba(255, 193, 7, ${opacity})`,
        borderColor: `rgba(255, 193, 7, ${opacity})`,
        borderWidth: '2px',
      };
    } else if (clampedProgress >= 30) {
      // Start showing gold earlier at 30% progress
      const opacity = goldOpacity * 0.5;
      return {
        boxShadow: `0 0 10px rgba(255, 193, 7, ${opacity})`,
        borderColor: `rgba(255, 193, 7, ${opacity * 0.6})`,
        borderWidth: '1px',
      };
    } else if (clampedProgress >= 20) {
      // Even earlier at 20% progress
      const opacity = goldOpacity * 0.3;
      return {
        boxShadow: `0 0 6px rgba(255, 193, 7, ${opacity})`,
        borderColor: `rgba(255, 193, 7, ${opacity * 0.4})`,
        borderWidth: '1px',
      };
    }
    return {
      borderColor: 'transparent',
      borderWidth: '1px',
    };
  }, [clampedProgress, goldOpacity]);

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


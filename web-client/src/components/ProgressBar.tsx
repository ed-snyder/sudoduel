
interface ProgressBarProps {
  progress: number; // 0-100
  color: 'blue' | 'pink';
  className?: string;
}

export function ProgressBar({ progress, color, className }: ProgressBarProps) {
  // Clamp progress between 0-100
  const clampedProgress = Math.max(0, Math.min(100, progress));

  // Brighter solid colors - no gradient
  const baseColor = color === 'blue' ? '#60A5FA' : '#F472B6'; // Brighter blue-400 and pink-400

  return (
    <div
      className={`rounded-full overflow-hidden bg-gray-300/40 transition-all duration-150 ${className || ''}`}
      style={{
        width: className?.includes('w-full') ? '100%' : '120px',
        height: '14px',
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


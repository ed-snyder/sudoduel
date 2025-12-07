
interface ProgressBarProps {
  progress: number; // 0-100
  color: 'blue' | 'pink';
  className?: string;
}

export function ProgressBar({ progress, color, className }: ProgressBarProps) {
  // Clamp progress between 0-100
  const clampedProgress = Math.max(0, Math.min(100, progress));

  // Synthwave colors - cyan for player, magenta for opponent
  const baseColor = color === 'blue' ? '#00FFFF' : '#FF00FF';
  const bgColor = color === 'blue' ? 'rgba(0, 255, 255, 0.1)' : 'rgba(255, 0, 255, 0.1)';

  return (
    <div
      className={`rounded-full overflow-hidden transition-all duration-150 ${className || ''}`}
      style={{
        width: className?.includes('w-full') ? '100%' : '120px',
        height: '14px',
        background: bgColor,
        border: `1px solid ${color === 'blue' ? 'rgba(0, 255, 255, 0.3)' : 'rgba(255, 0, 255, 0.3)'}`,
      }}
    >
      <div
        className="h-full rounded-full transition-all duration-150"
        style={{
          width: `${clampedProgress}%`,
          backgroundColor: baseColor,
          boxShadow: `0 0 8px ${baseColor}80`,
        }}
      />
    </div>
  );
}


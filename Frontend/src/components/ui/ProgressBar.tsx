import React from 'react';

interface ProgressBarProps {
  value: number;
  max?: number;
  height?: number | string;
  color?: string;
  trackColor?: string;
  className?: string;
  animated?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  height = 8,
  color = 'var(--comp-accent)',
  trackColor = 'var(--comp-border)',
  className = '',
  animated = true,
}) => {
  const safeValue = Math.min(Math.max(value, 0), max);
  const percent = max > 0 ? (safeValue / max) * 100 : 0;

  return (
    <div 
      className={`w-full overflow-hidden rounded-full ${className}`}
      style={{ height, backgroundColor: trackColor }}
      role="progressbar"
      aria-valuenow={safeValue}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <div
        className={`h-full rounded-full ${animated ? 'transition-all duration-500 ease-out' : ''}`}
        style={{ 
          width: `${percent}%`, 
          backgroundColor: color 
        }}
      />
    </div>
  );
};

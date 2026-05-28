import React from 'react';

interface RadialProgressProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  label?: string;
  sublabel?: string;
  showValue?: boolean;
}

export const RadialProgress: React.FC<RadialProgressProps> = ({
  value,
  max = 100,
  size = 80,
  strokeWidth = 8,
  color = 'var(--comp-accent)',
  trackColor = 'var(--comp-border)',
  label,
  sublabel,
  showValue = true,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const safeValue = Math.min(Math.max(value, 0), max);
  const percent = max > 0 ? safeValue / max : 0;
  const offset = circumference - percent * circumference;

  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="rotate-[-90deg]">
          {/* Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke={trackColor}
            strokeWidth={strokeWidth}
            className="transition-colors duration-300"
          />
          {/* Progress */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-[stroke-dashoffset] duration-700 ease-out"
          />
        </svg>
        
        {showValue && (
          <div className="absolute flex flex-col items-center justify-center text-center">
            <span className="text-sm font-semibold tracking-tight text-[var(--text-primary)] leading-none">
              {safeValue}
              {max === 100 && '%'}
            </span>
          </div>
        )}
      </div>
      
      {(label || sublabel) && (
        <div className="flex flex-col items-center text-center">
          {label && <span className="text-xs font-medium text-[var(--text-primary)]">{label}</span>}
          {sublabel && <span className="text-[10px] text-[var(--text-secondary)]">{sublabel}</span>}
        </div>
      )}
    </div>
  );
};

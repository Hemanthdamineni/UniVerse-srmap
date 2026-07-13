
// ── ProgressBar ─────────────────────────────────────────────────────

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


// ── RadialProgress ─────────────────────────────────────────────────────

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


// ── StarRating ─────────────────────────────────────────────────────

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  value: number;
  max?: number;
  onChange?: (value: number) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: "size-3.5",
  md: "size-5",
  lg: "size-6",
};

export function StarRating({ value, max = 5, onChange, size = "md", className }: StarRatingProps) {
  const interactive = !!onChange;

  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} role={interactive ? "radiogroup" : "img"} aria-label={`${value} out of ${max} stars`}>
      {Array.from({ length: max }, (_, i) => {
        const filled = i < value;
        return (
          <span
            key={i}
            className={cn(
              "inline-flex",
              interactive && "cursor-pointer"
            )}
            onClick={interactive ? () => onChange(i + 1) : undefined}
            onKeyDown={interactive ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onChange(i + 1); } } : undefined}
            role={interactive ? "radio" : undefined}
            aria-checked={interactive ? filled : undefined}
            aria-label={interactive ? `${i + 1} star` : undefined}
            tabIndex={interactive ? 0 : undefined}
          >
            <Star
              className={cn(
                sizeMap[size],
                "transition-colors",
                filled ? "fill-yellow-400 text-yellow-500 drop-shadow-[0_0_3px_rgba(250,204,21,0.5)]" : "fill-none text-[var(--text-secondary)]"
              )}
            />
          </span>
        );
      })}
    </span>
  );
}


// ── StatCard ─────────────────────────────────────────────────────

import type { LucideIcon } from "lucide-react";

export interface StatCardProps {
  className?: string;
  label: string;
  value: string | number;
  icon?: LucideIcon;
  delta?: {
    value: string | number;
    trend: "up" | "down" | "neutral";
  };
}

export function StatCard({ className, label, value, icon: Icon, delta }: StatCardProps) {
  return (
    <div className={cn("p-4 md:p-6 rounded-xl border border-[var(--comp-border)] bg-[var(--comp-surface)] shadow-sm", className)}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="label-text">{label}</h4>
        {Icon && <Icon className="w-5 h-5 text-[var(--comp-text-muted)]" />}
      </div>
      <div className="flex items-baseline gap-3">
        <span className="section-title font-semibold">{value}</span>
        {delta && (
          <span className={cn(
            "text-sm font-medium",
            delta.trend === "up" ? "text-[var(--success)]" :
            delta.trend === "down" ? "text-[var(--error)]" :
            "text-[var(--comp-text-muted)]"
          )}>
            {delta.trend === "up" ? "↑ " : delta.trend === "down" ? "↓ " : ""}{delta.value}
          </span>
        )}
      </div>
    </div>
  );
}



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
        className={`h-full w-full origin-left rounded-full ${animated ? 'transition-transform duration-500 ease-out' : ''}`}
        style={{
          transform: `scaleX(${percent / 100})`,
          backgroundColor: color
        }}
      />
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


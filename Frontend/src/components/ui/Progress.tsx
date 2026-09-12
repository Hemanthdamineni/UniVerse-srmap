
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
  const selectedIndex = Math.min(Math.max(value - 1, 0), max - 1);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLSpanElement>, index: number) => {
    if (!onChange) return;
    let next: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") next = Math.min(max, index + 2);
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = Math.max(1, index);
    if (event.key === "Home") next = 1;
    if (event.key === "End") next = max;
    if (event.key === " " || event.key === "Enter") next = index + 1;
    if (next === null) return;
    event.preventDefault();
    onChange(next);
    const group = event.currentTarget.parentElement;
    requestAnimationFrame(() => {
      group?.querySelector<HTMLElement>(`[data-star-rating-value="${next}"]`)?.focus();
    });
  };

  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} role={interactive ? "radiogroup" : "img"} aria-label={`${value} out of ${max} stars`}>
      {Array.from({ length: max }, (_, i) => {
        const filled = i < value;
        return (
          <span
            key={i}
            className={cn(
              "inline-flex items-center justify-center",
              // Interactive stars need a 44×44 hit area (WCAG 2.5.5) even
              // though the glyph itself stays small.
              interactive && "size-11 cursor-pointer"
            )}
            onClick={interactive ? () => onChange?.(i + 1) : undefined}
            onKeyDown={interactive ? (event) => handleKeyDown(event, i) : undefined}
            role={interactive ? "radio" : undefined}
            aria-checked={interactive ? i + 1 === value : undefined}
            aria-label={interactive ? `${i + 1} star` : undefined}
            tabIndex={interactive ? (i === selectedIndex ? 0 : -1) : undefined}
            data-star-rating-value={interactive ? i + 1 : undefined}
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

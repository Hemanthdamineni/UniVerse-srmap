import type React from "react";
import type { Tab } from "./types";

export function TabIcon({ icon, className = "w-4 h-4" }: { icon: Tab; className?: string }) {
  const icons: Record<Tab, React.ReactNode> = {
    overview: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="16" />
      </svg>
    ),
    history: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
        <path d="M3 3v18h18" />
        <path d="m19 9-5 5-4-4" />
      </svg>
    ),
    planner: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
    risks: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
    action: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  };
  return icons[icon];
}

export function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    high: { bg: "color-mix(in srgb, var(--error) 15%, transparent)", color: "var(--error)", label: "High" },
    medium: { bg: "color-mix(in srgb, var(--warning) 15%, transparent)", color: "var(--warning)", label: "Medium" },
    low: { bg: "color-mix(in srgb, var(--info) 15%, transparent)", color: "var(--info)", label: "Low" },
  };
  const style = styles[priority] || styles.medium;
  return (
    <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: style.bg, color: style.color }}>
      {style.label}
    </span>
  );
}

export function ActionButton({ label, onClick, variant = "primary", icon, className = "" }: { label: string; onClick: () => void; variant?: "primary" | "outline" | "ghost"; icon?: React.ReactNode; className?: string }) {
  const base = "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors";
  const variants = {
    primary: "bg-[var(--comp-accent)] text-[var(--comp-accent-fg)] hover:bg-[var(--comp-accent-hover)] shadow-sm",
    outline: "border border-[var(--comp-border)] bg-transparent hover:bg-[var(--comp-surface-hover)] text-[var(--comp-text-primary)]",
    ghost: "bg-transparent hover:bg-[var(--comp-surface-hover)] text-[var(--comp-text-secondary)]",
  };
  return (
    <button type="button" onClick={onClick} className={`${base} ${variants[variant]} ${className}`}>
      {icon && <span>{icon}</span>}
      {label}
    </button>
  );
}

export function SkillPill({ skill, demand, gapLevel, onClick }: { skill: string; demand: number; gapLevel: string; onClick?: () => void }) {
  const gapStyles: Record<string, { bg: string; color: string; border: string }> = {
    missing: { bg: "color-mix(in srgb, var(--error) 10%, transparent)", color: "var(--error)", border: "color-mix(in srgb, var(--error) 30%, transparent)" },
    weak: { bg: "color-mix(in srgb, var(--warning) 10%, transparent)", color: "var(--warning)", border: "color-mix(in srgb, var(--warning) 30%, transparent)" },
    growing: { bg: "color-mix(in srgb, var(--info) 10%, transparent)", color: "var(--info)", border: "color-mix(in srgb, var(--info) 30%, transparent)" },
    strong: { bg: "color-mix(in srgb, var(--success) 10%, transparent)", color: "var(--success)", border: "color-mix(in srgb, var(--success) 30%, transparent)" },
  };
  const style = gapStyles[gapLevel] || gapStyles.missing;
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1.5 rounded-full text-xs font-medium border transition-all hover:shadow-sm"
      style={{ background: style.bg, color: style.color, borderColor: style.border }}
      disabled={!onClick}
    >
      <span className="flex items-center gap-1">
        {skill}
        <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: `color-mix(in srgb, ${style.color} 20%, transparent)`, color: style.color }}>
          {demand} opps
        </span>
      </span>
    </button>
  );
}

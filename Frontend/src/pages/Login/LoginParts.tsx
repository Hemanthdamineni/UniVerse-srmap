import type { CSSProperties } from "react";

export type Tone = "neutral" | "error" | "success";

export function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      style={{ display: "block", animation: spinning ? "login-spin 0.8s linear infinite" : "none" }}>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

export function LoadingDots() {
  return (
    <span className="login-loading-dots" aria-label="Signing in">
      <span /><span /><span />
    </span>
  );
}

export function StatusMessage({ tone, message }: { tone: Tone; message: string }) {
  if (!message) return null;
  const cfg = {
    success: { bg: "color-mix(in srgb, var(--success) 10%, transparent)", border: "color-mix(in srgb, var(--success) 35%, transparent)", color: "var(--success)", icon: "✓" },
    error:   { bg: "color-mix(in srgb, var(--error) 8%, transparent)",   border: "color-mix(in srgb, var(--error) 30%, transparent)",   color: "var(--error)",   icon: "!" },
    neutral: { bg: "color-mix(in srgb, var(--accent-blue) 8%, transparent)", border: "color-mix(in srgb, var(--accent-blue) 28%, transparent)", color: "var(--info)", icon: "·" },
  }[tone];
  return (
    <div role="status" aria-live="polite" style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "11px 14px", borderRadius: "10px", border: `1px solid ${cfg.border}`, background: cfg.bg, color: cfg.color, fontSize: "0.82rem", fontWeight: 500, lineHeight: 1.5, animation: "login-fadein 0.18s ease-out" }}>
      <span style={{ fontWeight: 700, flexShrink: 0, lineHeight: 1.4 }}>{cfg.icon}</span>
      <span>{message}</span>
    </div>
  );
}

export const LABEL: CSSProperties = { display: "block", fontSize: "0.78rem", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--comp-text-secondary)", marginBottom: "7px" };
export const INPUT: CSSProperties = { width: "100%", boxSizing: "border-box", padding: "11px 14px", fontSize: "0.875rem", borderRadius: "10px", border: "1px solid color-mix(in srgb, var(--border) 90%, transparent)", background: "var(--background)", color: "var(--text-primary)", outline: "none", fontFamily: "inherit", transition: "border-color 0.2s ease, box-shadow 0.2s ease" };

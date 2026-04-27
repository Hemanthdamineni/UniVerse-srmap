import React from "react";
import { cn } from "@/lib/utils";

export interface TagProps {
  className?: string;
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "error" | "info" | "outline";
}

export function Tag({ className, children, variant = "default" }: TagProps) {
  const baseStyles = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border";
  
  const variants = {
    default: "bg-[var(--comp-surface-hover)] text-[var(--comp-text-secondary)] border-[var(--comp-border)]",
    success: "bg-[color-mix(in_srgb,var(--success)_10%,transparent)] text-[var(--success)] border-[color-mix(in_srgb,var(--success)_30%,transparent)]",
    warning: "bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] text-[var(--warning)] border-[color-mix(in_srgb,var(--warning)_30%,transparent)]",
    error: "bg-[color-mix(in_srgb,var(--error)_10%,transparent)] text-[var(--error)] border-[color-mix(in_srgb,var(--error)_30%,transparent)]",
    info: "bg-[color-mix(in_srgb,var(--info)_10%,transparent)] text-[var(--info)] border-[color-mix(in_srgb,var(--info)_30%,transparent)]",
    outline: "bg-transparent text-[var(--comp-text-secondary)] border-[var(--comp-border)]"
  };

  return (
    <span className={cn(baseStyles, variants[variant], className)}>
      {children}
    </span>
  );
}

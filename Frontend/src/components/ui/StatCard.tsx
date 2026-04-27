import { cn } from "@/lib/utils";
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

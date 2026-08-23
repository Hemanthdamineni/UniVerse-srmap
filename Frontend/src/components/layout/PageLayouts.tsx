import type { PropsWithChildren } from "react";
import { cn } from "@/lib/utils";

type PageContainerSurface = "card" | "flat";

export function PageContainer({
  children,
  className,
  maxWidth,
  surface = "card",
}: PropsWithChildren<{ className?: string; maxWidth?: string; surface?: PageContainerSurface }>) {
  const maxWidthClass =
    maxWidth ||
    className?.split(' ').find(c => c.startsWith('max-w-')) ||
    "max-w-[1600px]";
  const otherClasses = className?.split(' ').filter(c => !c.startsWith('max-w-')).join(' ');
  const surfaceClasses =
    surface === "card"
      ? "rounded-2xl border border-[color-mix(in_srgb,var(--border)_40%,transparent)] bg-[var(--surface)] p-4 shadow-sm md:p-6"
      : "";

  return (
    <div className={cn("mx-auto w-full px-4 py-4 md:px-6", maxWidthClass)}>
      <div className={cn(surfaceClasses, otherClasses)}>
        {children}
      </div>
    </div>
  );
}

export function DashboardLayout({ children, className }: PropsWithChildren<{ className?: string }>) {
  // Flat surface: the dashboard composes its own SectionCards — wrapping the
  // whole grid in PageContainer's card surface would create a card-in-card.
  return <PageContainer surface="flat" className={className}>{children}</PageContainer>;
}

export function DataPageLayout({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <PageContainer className={cn("space-y-4", className)}>{children}</PageContainer>;
}

export function DetailPageLayout({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <PageContainer className={cn("space-y-6", className)}>{children}</PageContainer>;
}

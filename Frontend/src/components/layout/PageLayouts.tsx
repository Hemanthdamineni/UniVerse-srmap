import type { PropsWithChildren } from "react";
import { cn } from "@/lib/utils";

export function PageContainer({ children, className }: PropsWithChildren<{ className?: string }>) {
  const maxWidthClass = className?.split(' ').find(c => c.startsWith('max-w-')) || "max-w-[1600px]";
  const otherClasses = className?.split(' ').filter(c => !c.startsWith('max-w-')).join(' ');

  return (
    <div className={cn("mx-auto w-full px-4 py-2 md:px-6", maxWidthClass)}>
      <div className={cn("rounded-2xl border border-[color-mix(in_srgb,var(--border)_40%,transparent)] bg-[color-mix(in_srgb,var(--surface)_85%,transparent)] p-5 shadow-sm backdrop-blur-md md:p-6", otherClasses)}>
        {children}
      </div>
    </div>
  );
}

export function DashboardLayout({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <PageContainer className={className}>{children}</PageContainer>;
}

export function DataPageLayout({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <PageContainer className={cn("space-y-4", className)}>{children}</PageContainer>;
}

export function DetailPageLayout({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <PageContainer className={cn("space-y-6", className)}>{children}</PageContainer>;
}

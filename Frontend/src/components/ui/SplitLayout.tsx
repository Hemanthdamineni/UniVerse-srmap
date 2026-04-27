import React from "react";
import { cn } from "@/lib/utils";

export interface SplitLayoutProps {
  className?: string;
  sidebar?: React.ReactNode;
  children: React.ReactNode;
}

export function SplitLayout({ className, sidebar, children }: SplitLayoutProps) {
  return (
    <div className={cn("flex flex-col md:flex-row gap-6", className)}>
      {sidebar && (
        <aside className="w-full md:w-64 shrink-0">
          {sidebar}
        </aside>
      )}
      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  );
}

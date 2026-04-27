import React from "react";
import { cn } from "@/lib/utils";

export interface FormSectionProps {
  className?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function FormSection({ className, title, description, children }: FormSectionProps) {
  return (
    <div className={cn("mb-8 last:mb-0", className)}>
      <div className="mb-4">
        <h3 className="section-title">{title}</h3>
        {description && <p className="body-text mt-1">{description}</p>}
      </div>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}

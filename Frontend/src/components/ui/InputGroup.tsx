import React from "react";
import { cn } from "@/lib/utils";

export interface InputGroupProps {
  className?: string;
  label: string;
  id?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}

export function InputGroup({ className, label, id, error, required, children }: InputGroupProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="label-text">
        {label}
        {required && <span className="text-[var(--error)] ml-1">*</span>}
      </label>
      {children}
      {error && <span className="text-xs text-[var(--error)]">{error}</span>}
    </div>
  );
}

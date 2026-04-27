import { cn } from "@/lib/utils";
import { CheckCircle, Info, X } from "lucide-react";

export interface ToastProps {
  id: string;
  type?: "success" | "info";
  message: string;
  onDismiss: (id: string) => void;
}

export function Toast({ id, type = "info", message, onDismiss }: ToastProps) {
  const isSuccess = type === "success";
  const Icon = isSuccess ? CheckCircle : Info;

  return (
    <div className={cn(
      "pointer-events-auto flex w-full max-w-md bg-[var(--comp-surface)] shadow-lg rounded-lg border border-[var(--comp-border)] py-3 px-4",
      "transition-all duration-300 ease-in-out transform"
    )}>
      <div className="flex w-full items-start gap-3">
        <Icon className={cn("w-5 h-5 shrink-0 mt-0.5", isSuccess ? "text-[var(--success)]" : "text-[var(--info)]")} />
        <div className="flex-1 text-sm font-medium text-[var(--comp-text-primary)]">
          {message}
        </div>
        <button
          onClick={() => onDismiss(id)}
          className="shrink-0 text-[var(--comp-text-muted)] hover:text-[var(--comp-text-primary)] transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

// Simple export for rendering toast containers externally
export function ToastContainer({ toasts, onDismiss }: { toasts: ToastProps[], onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => (
        <Toast key={toast.id} {...toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

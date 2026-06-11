import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  value: number;
  max?: number;
  onChange?: (value: number) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: "size-3.5",
  md: "size-5",
  lg: "size-6",
};

export function StarRating({ value, max = 5, onChange, size = "md", className }: StarRatingProps) {
  const interactive = !!onChange;

  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} role={interactive ? "radiogroup" : "img"} aria-label={`${value} out of ${max} stars`}>
      {Array.from({ length: max }, (_, i) => {
        const filled = i < value;
        return (
          <span
            key={i}
            className={cn(
              "inline-flex",
              interactive && "cursor-pointer"
            )}
            onClick={interactive ? () => onChange(i + 1) : undefined}
            onKeyDown={interactive ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onChange(i + 1); } } : undefined}
            role={interactive ? "radio" : undefined}
            aria-checked={interactive ? filled : undefined}
            aria-label={interactive ? `${i + 1} star` : undefined}
            tabIndex={interactive ? 0 : undefined}
          >
            <Star
              className={cn(
                sizeMap[size],
                "transition-colors",
                filled ? "fill-yellow-400 text-yellow-500 drop-shadow-[0_0_3px_rgba(250,204,21,0.5)]" : "fill-none text-[var(--text-secondary)]"
              )}
            />
          </span>
        );
      })}
    </span>
  );
}

// Loading placeholder uses SkeletonBlock + tokens (no indigo spinners).
import { SkeletonBlock } from "./ui/SkeletonBlock";

interface LoadingSpinnerProps {
  message: string;
  size?: "sm" | "md" | "lg";
  fullHeight?: boolean;
}

export default function LoadingSpinner({
  message,
  size = "md",
  fullHeight = true,
}: LoadingSpinnerProps) {
  const h = size === "sm" ? 32 : size === "lg" ? 64 : 48;
  const containerClasses = fullHeight
    ? "flex min-h-[400px] flex-col items-center justify-center gap-4 px-6"
    : "flex items-center justify-center gap-4 p-8";

  return (
    <div className={containerClasses}>
      <SkeletonBlock width={h * 2} height={h} className="max-w-full rounded-xl" />
      <p className="body-text font-medium">{message}</p>
    </div>
  );
}

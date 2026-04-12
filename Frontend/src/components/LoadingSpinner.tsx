interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  fullHeight?: boolean;
}

export default function LoadingSpinner({
  message = "Loading...",
  size = 'md',
  fullHeight = true
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  };

  const containerClasses = fullHeight
    ? "flex flex-col items-center justify-center min-h-[400px]"
    : "flex items-center justify-center p-8";

  return (
    <div className={containerClasses}>
      <div className={`animate-spin ${sizeClasses[size]} border-2 border-indigo-200 border-t-indigo-600 rounded-full`} />
      {message && (
        <p className="mt-3 text-gray-600 text-sm font-medium">{message}</p>
      )}
    </div>
  );
}
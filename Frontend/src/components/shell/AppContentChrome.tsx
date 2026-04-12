import { useLocation } from "react-router-dom";
import { Suspense } from "react";
import LoadingSpinner from "../LoadingSpinner";

export default function AppContentChrome({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div id="main-content" tabIndex={-1} className="outline-none">
      <Suspense
        fallback={
          <div className="flex min-h-[40vh] items-center justify-center p-8" role="status" aria-live="polite">
            <LoadingSpinner />
          </div>
        }
      >
        {children}
      </Suspense>
    </div>
  );
}

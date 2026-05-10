import { useLocation } from "react-router-dom";
import { Suspense } from "react";
import LoadingSpinner from "../LoadingSpinner";
import { getBreadcrumbs } from "@/config/navigationRegistry";
import BreadcrumbsBar from "./BreadcrumbsBar";

export default function AppContentChrome({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const breadcrumbs = getBreadcrumbs(location.pathname);

  return (
    <div id="main-content" tabIndex={-1} className="outline-none">
      <BreadcrumbsBar items={breadcrumbs} />
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

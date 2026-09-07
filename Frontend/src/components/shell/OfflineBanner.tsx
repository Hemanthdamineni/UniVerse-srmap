import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";

/**
 * Honest stale-data indicator (Batch B13 / T7.2.2). While offline the app keeps
 * showing the last data it loaded (persisted timetable / attendance / results);
 * this bar makes sure the student knows it isn't live.
 */
export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div
      role="status"
      className="z-[65] flex shrink-0 items-center justify-center gap-2 border-b border-amber-300 bg-amber-100 px-4 py-1.5 text-center text-xs font-semibold text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
    >
      <WifiOff className="h-3.5 w-3.5" />
      You're offline — showing the last data that loaded. It may be out of date.
    </div>
  );
}


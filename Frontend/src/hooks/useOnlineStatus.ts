import { useEffect, useState } from "react";

/**
 * Tracks connectivity (Batch B13 / T7.2.2). `navigator.onLine` is the coarse
 * signal; we also flip to offline when a fetch throws a network TypeError,
 * surfaced via the `erp:network-offline` / `erp:network-online` custom events
 * that the API client dispatches.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    window.addEventListener("erp:network-online", up);
    window.addEventListener("erp:network-offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
      window.removeEventListener("erp:network-online", up);
      window.removeEventListener("erp:network-offline", down);
    };
  }, []);

  return online;
}

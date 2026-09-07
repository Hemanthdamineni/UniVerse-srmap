import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { resolveUserNames } from "../lib/campus/usersApi";

/**
 * Resolve a batch of register numbers to display names (B3 / T5.4.6).
 *
 * Returns `nameFor(id)` — the resolved display name, or the raw register
 * number when the directory hasn't seen that user. One batched request per
 * distinct id set, cached for 5 minutes.
 */
export function useResolvedNames(ids: Array<string | null | undefined>): (id: string | null | undefined) => string {
  const unique = useMemo(
    () => [...new Set(ids.map((v) => String(v || "").trim()).filter(Boolean))].sort(),
    [ids],
  );

  const { data } = useQuery({
    queryKey: ["users", "resolve", unique],
    queryFn: () => resolveUserNames(unique),
    enabled: unique.length > 0,
    staleTime: 5 * 60_000,
  });

  return useMemo(() => {
    const map = data ?? {};
    return (id: string | null | undefined) => {
      const key = String(id ?? "").trim();
      return (key && map[key]) || key;
    };
  }, [data]);
}

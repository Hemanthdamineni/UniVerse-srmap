import { requestData } from "../core/apiClient";
import { isStaticPrototype } from "../core/prototype";

export type ResolvedUser = { id: string; name: string | null };

/**
 * Register-number → display-name lookup for organizer surfaces (leaderboards,
 * judge / shortlist lists, competition audit trails). B3 / T5.4.6.
 *
 * Returns a map of only the ids that resolved — callers fall back to the raw
 * register number for anyone the directory hasn't seen.
 */
export async function resolveUserNames(ids: string[]): Promise<Record<string, string>> {
  const clean = [...new Set(ids.map((v) => String(v || "").trim()).filter(Boolean))];
  if (clean.length === 0 || isStaticPrototype()) return {};
  const params = new URLSearchParams({ ids: clean.join(",") });
  const res = await requestData<{ items: ResolvedUser[] }>(`/api/users/resolve?${params.toString()}`);
  const out: Record<string, string> = {};
  for (const item of res.items || []) {
    if (item.name) out[item.id] = item.name;
  }
  return out;
}

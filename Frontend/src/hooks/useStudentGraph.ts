import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getStudentGraph, recomputeStudentGraph, type StudentGraph } from "../lib/core/studentGraph";
import { studentGraphKeys } from "../lib/core/queryKeys";
import { hasSessionAuth } from "../lib/core/session";

/**
 * The current student's composed profile (Batch B4). Every acting surface —
 * Academic Hub, opportunity ranking, event recs — should read from here rather
 * than re-deriving from raw ERP pages.
 *
 * Cached 5 min client-side on top of the server's ~60s cache; call
 * `recompute()` after an ERP refresh completes.
 */
export function useStudentGraph() {
  const queryClient = useQueryClient();
  const query = useQuery<StudentGraph>({
    queryKey: studentGraphKeys.graph,
    queryFn: () => getStudentGraph(),
    enabled: hasSessionAuth(),
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const recompute = async () => {
    const fresh = await recomputeStudentGraph();
    queryClient.setQueryData(studentGraphKeys.graph, fresh);
    return fresh;
  };

  return { query, graph: query.data ?? null, recompute };
}

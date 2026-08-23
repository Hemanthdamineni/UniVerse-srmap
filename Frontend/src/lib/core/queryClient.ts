import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { ApiError } from "../erp/index";
import { handleSessionAuthFailure } from "./session";

// Centralized session-death handling for every query/mutation that flows
// through React Query. The per-wrapper guard in requestUtils stays until the
// migration completes; this makes cache-driven callers safe on their own.
// redirectToLogin() is already idempotent on /login and in prototype mode.
function isSessionDeath(error: unknown) {
  if (!(error instanceof ApiError)) return false;
  return error.status === 401 || error.code === "SESSION_EXPIRED" || error.code === "UNAUTHORIZED";
}

function handleCacheAuthFailure(error: unknown) {
  if (!isSessionDeath(error)) return;
  handleSessionAuthFailure();
}

export function createAppQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: handleCacheAuthFailure,
    }),
    mutationCache: new MutationCache({
      onError: handleCacheAuthFailure,
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        // Only retry errors the backend flagged retryable (503 LOCK_TIMEOUT,
        // RATE_LIMITED); never burn upstream scrapes on 400s or auth deaths.
        // Unexpected non-API failures (network TypeErrors) keep one retry.
        retry: (failureCount, error) => {
          if (error instanceof ApiError) return error.retryable && failureCount < 1;
          return failureCount < 1;
        },
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

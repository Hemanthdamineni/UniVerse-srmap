import { QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { createAppQueryClient } from "./lib/core/queryClient";
import {
  AUTH_STATE_EVENT,
  createQueryPersister,
  getQueryPersistScope,
  QUERY_PERSIST_MAX_AGE,
} from "./lib/core/queryPersist";

export default function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => createAppQueryClient());
  const [persistScope, setPersistScope] = useState(() => getQueryPersistScope());
  useEffect(() => {
    const onAuthState = (event: Event) => {
      const scope = (event as CustomEvent<{ scope?: string }>).detail?.scope || "";
      queryClient.clear();
      setPersistScope(scope);
    };
    window.addEventListener(AUTH_STATE_EVENT, onAuthState);
    return () => window.removeEventListener(AUTH_STATE_EVENT, onAuthState);
  }, [queryClient]);
  // Offline-first (Batch B13): replay the last good timetable / attendance /
  // results / graph on reload. A persister exists only for one authenticated
  // student, never for an anonymous or just-expired session.
  const persister = useMemo(() => createQueryPersister(), [persistScope]);

  const devtools = import.meta.env.DEV ? <ReactQueryDevtools initialIsOpen={false} /> : null;

  if (persister) {
    return (
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          maxAge: QUERY_PERSIST_MAX_AGE,
          // Bump when the query-shape changes so a stale snapshot can't hydrate
          // into a newer client.
          buster: import.meta.env.VITE_APP_VERSION || "1",
        }}
      >
        {children}
        {devtools}
      </PersistQueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {devtools}
    </QueryClientProvider>
  );
}

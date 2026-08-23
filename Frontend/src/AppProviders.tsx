import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import type { ReactNode } from "react";
import { useState } from "react";
import { createAppQueryClient } from "./lib/core/queryClient";

export default function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => createAppQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* Vite replaces DEV with false at build time; Rollup drops this branch
          and the import from the production bundle. */}
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}

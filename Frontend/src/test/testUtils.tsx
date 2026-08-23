import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";

// Deterministic cache for component tests: no retries, no background
// refetching, nothing ever goes stale mid-assertion.
export function createTestQueryClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
        staleTime: Infinity,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
  return client;
}

export function renderWithProviders(
  ui: ReactElement,
  { queryClient = createTestQueryClient(), wrapper }: { queryClient?: QueryClient; wrapper?: (props: { children: ReactNode }) => ReactNode } = {}
) {
  function Provider({ children }: { children: ReactNode }) {
    const Outer = wrapper;
    return Outer ? (
      <Outer>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </Outer>
    ) : (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  return { queryClient, ...render(ui, { wrapper: Provider }) };
}

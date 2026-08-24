import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toErrorMessage } from "./toErrorMessage";

// docs/react-query-migration-plan.md §4 — shared mutation wrapper that owns
// the success/warning banner contract the hand-rolled runAction helpers
// duplicated four times, and invalidates the queries each action touches.
export interface ApiBanner {
  tone: "success" | "warning";
  text: string;
}

interface UseApiMutationOptions<TVariables, TData> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  /** Query keys (already-built arrays from a queryKeys factory) to invalidate after success. */
  invalidateKeys?: ReadonlyArray<readonly unknown[]>;
  /** Banner text on success; function form receives the mutation result. */
  successText?: string | ((data: TData, variables: TVariables) => string);
  /** Banner text when the error carries no usable message. */
  errorFallback?: string;
  /** Extra post-success work (form resets, local state cleanup). Runs after invalidation kicks off. */
  onSuccess?: (data: TData, variables: TVariables) => void;
}

export function useApiMutation<TVariables = void, TData = unknown>(
  options: UseApiMutationOptions<TVariables, TData>
) {
  const queryClient = useQueryClient();
  const [banner, setBanner] = useState<ApiBanner | null>(null);

  const mutation = useMutation({
    mutationFn: options.mutationFn,
    onSuccess: async (data, variables) => {
      const text =
        typeof options.successText === "function"
          ? options.successText(data, variables)
          : options.successText || "Done.";
      setBanner({ tone: "success", text });
      for (const key of options.invalidateKeys ?? []) {
        await queryClient.invalidateQueries({ queryKey: key });
      }
      options.onSuccess?.(data, variables);
    },
    onError: (error) => {
      setBanner({
        tone: "warning",
        text: toErrorMessage(error, options.errorFallback ?? "Action failed."),
      });
    },
  });

  return {
    /** Resolves after success handling; rejects are already converted to the warning banner. */
    mutate: async (variables: TVariables) => {
      try {
        await mutation.mutateAsync(variables);
      } catch {
        // Banner already reflects the failure; callers just await completion.
      }
    },
    isPending: mutation.isPending,
    banner,
    setBanner,
  };
}

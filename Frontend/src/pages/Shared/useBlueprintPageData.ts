import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { isPlaceholderBlueprint, type PageBlueprint } from "../../config/erpBlueprints";
import { fetchSessionProfile, readStoredProfileData } from "../../lib/core/session";
import { sessionKeys } from "../../lib/core/queryKeys";
import { ERP_FRESH_TTL_MS } from "../../lib/core/queryOptions";
import { erpKeys } from "../../lib/erp/queryKeys";
import { loadErpKey, loadExternalPage } from "./blueprintData/api";
import {
  normalizeErpPayloads,
  normalizeExternalPayload,
  sourceLabelForMode,
} from "./blueprintData/normalizers";
import type { BlueprintPageState } from "./blueprintData/types";

const loadingState: BlueprintPageState = {
  isLoading: true,
  error: null,
  source: "Live ERP",
  sections: [],
  statuses: [],
  kpis: [],
};

function placeholderState(blueprint: PageBlueprint): BlueprintPageState {
  const unavailableMessage = blueprint.placeholderReason || "This page is not available yet.";
  return {
    isLoading: false,
    error: null,
    source: "Placeholder",
    sections: [
      {
        title: blueprint.heading,
        summary: unavailableMessage,
        tables: [],
      },
    ],
    statuses: [
      {
        id: `${blueprint.route}-placeholder`,
        tone: "info",
        text: unavailableMessage,
      },
    ],
    kpis: [],
  };
}

function errorState(blueprint: PageBlueprint, message: string): BlueprintPageState {
  // Placeholders never reach this path; the fallback keeps the pre-migration
  // default label for any blueprint without an explicit sourceMode.
  const mode = ("sourceMode" in blueprint ? blueprint.sourceMode : undefined) ?? "erp";
  return {
    isLoading: false,
    error: message,
    source: sourceLabelForMode(mode),
    sections: [],
    statuses: [],
    kpis: [],
  };
}

export function useBlueprintPageData(blueprint: PageBlueprint, reloadToken = 0): BlueprintPageState {
  const placeholder = isPlaceholderBlueprint(blueprint);
  const isErpMode = !placeholder && blueprint.sourceMode !== "external" && blueprint.sourceMode !== "internal";
  const isExternalMode = !placeholder && blueprint.sourceMode === "external";

  // Shared ['session','profile'] cache. Seeded with the stored snapshot so
  // normalization can run before the network resolves; structural sharing
  // keeps object identity stable when the refreshed profile matches.
  const profileQuery = useQuery({
    queryKey: sessionKeys.profile,
    queryFn: fetchSessionProfile,
    initialData: () => readStoredProfileData() ?? undefined,
    staleTime: 30_000,
    enabled: !placeholder && blueprint.includeSessionProfile === true,
    retry: false,
  });

  // One query per scrape-backed key so cross-page dedup works (dashboard
  // batch and single-page views share entries). reloadToken rides in the key:
  // bumping it remounts a fresh query, which is exactly the old effect re-run.
  const erpQueries = useQueries({
    queries: (isErpMode ? blueprint.fetchKeys : []).map((key) => ({
      queryKey: [...erpKeys.page(key), reloadToken] as const,
      queryFn: () => loadErpKey(key),
      staleTime: ERP_FRESH_TTL_MS,
    })),
  });

  const externalQuery = useQuery({
    queryKey: ["external", blueprint.route, blueprint.fetchKeys[0], reloadToken] as const,
    queryFn: () => loadExternalPage(blueprint.fetchKeys[0]),
    enabled: isExternalMode,
    staleTime: ERP_FRESH_TTL_MS,
  });

  // Plain per-render derivation (no useMemo): the transform cost is small,
  // and RQ result objects are intentionally not referential-stable enough
  // for dependency arrays.
  const state = (() => {
    if (placeholder) return placeholderState(blueprint);

    if (blueprint.sourceMode === "internal") {
      return errorState(
        blueprint,
        "This internal page requires a dedicated loader instead of the generic blueprint page."
      );
    }

    if (isExternalMode) {
      if (externalQuery.isPending) return { ...loadingState };
      if (externalQuery.isError) {
        return errorState(
          blueprint,
          externalQuery.error instanceof Error ? externalQuery.error.message : "Failed to load page data"
        );
      }
      return {
        ...normalizeExternalPayload(blueprint, externalQuery.data!),
        isLoading: externalQuery.isFetching,
      };
    }

    const queries = erpQueries;
    if (queries.length === 0) return { ...loadingState };

    if (queries.some((query) => query.isPending)) return { ...loadingState };

    const errored = queries.find((query) => query.isError);
    if (errored?.error) {
      return errorState(
        blueprint,
        errored.error instanceof Error ? errored.error.message : "Failed to load page data"
      );
    }

    // During background refreshes every query still exposes its last data, so
    // sections stay on screen while isLoading below drives the shell overlay.
    const keyResults = queries.map((query) => query.data!);
    const profileSnapshot = profileQuery.data ?? null;
    const next = normalizeErpPayloads(blueprint, keyResults, profileSnapshot);

    return {
      ...next,
      isLoading: queries.some((query) => query.isFetching),
    };
  })();

  return state;
}

export function useRouteBlueprint(pathname: string) {
  return useMemo(() => pathname, [pathname]);
}

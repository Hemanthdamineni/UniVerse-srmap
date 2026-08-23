import { useEffect, useMemo, useState } from "react";
import { isPlaceholderBlueprint, type PageBlueprint } from "../../config/erpBlueprints";
import { fetchSessionProfile, readStoredProfileData } from "../../lib/core/session";
import { loadErpKey, loadExternalPage } from "./blueprintData/api";
import {
  normalizeErpPayloads,
  normalizeExternalPayload,
  sourceLabelForMode,
} from "./blueprintData/normalizers";
import type { BlueprintPageState } from "./blueprintData/types";

const initialState: BlueprintPageState = {
  isLoading: true,
  error: null,
  source: "Live ERP",
  sections: [],
  statuses: [],
  kpis: [],
};

export function useBlueprintPageData(blueprint: PageBlueprint, reloadToken = 0): BlueprintPageState {
  const [state, setState] = useState<BlueprintPageState>(initialState);
  const [sessionProfile, setSessionProfile] = useState<Record<string, unknown> | null>(() =>
    readStoredProfileData()
  );

  useEffect(() => {
    let active = true;

    if (!blueprint.includeSessionProfile) {
      return () => {
        active = false;
      };
    }

    fetchSessionProfile()
      .then((profile) => {
        if (!active) return;
        // The loading effect below depends on sessionProfile; keeping the
        // stored reference when the refreshed profile is identical prevents
        // a second full fetch of every ERP key on each page visit.
        setSessionProfile((prev) =>
          JSON.stringify(prev) === JSON.stringify(profile) ? prev : profile
        );
      })
      .catch(() => {
        if (!active) return;
        setSessionProfile(readStoredProfileData());
      });

    return () => {
      active = false;
    };
  }, [blueprint.includeSessionProfile, blueprint.route]);

  useEffect(() => {
    let active = true;

    async function load() {
      if (isPlaceholderBlueprint(blueprint)) {
        if (!active) return;
        const unavailableMessage = blueprint.placeholderReason || "This page is not available yet.";
        setState({
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
        });
        return;
      }

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        if (blueprint.sourceMode === "external") {
          const externalPayload = await loadExternalPage(blueprint.fetchKeys[0]);
          if (!active) return;
          setState(normalizeExternalPayload(blueprint, externalPayload));
          return;
        }

        if (blueprint.sourceMode === "internal") {
          throw new Error("This internal page requires a dedicated loader instead of the generic blueprint page.");
        }

        const keyResults = await Promise.all(blueprint.fetchKeys.map((key) => loadErpKey(key)));
        if (!active) return;
        setState(normalizeErpPayloads(blueprint, keyResults, sessionProfile));
      } catch (error) {
        if (!active) return;
        const message = error instanceof Error ? error.message : "Failed to load page data";
        setState({
          isLoading: false,
          error: message,
          source: sourceLabelForMode(blueprint.sourceMode),
          sections: [],
          statuses: [],
          kpis: [],
        });
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [blueprint, sessionProfile, reloadToken]);

  return state;
}

export function useRouteBlueprint(pathname: string) {
  return useMemo(() => pathname, [pathname]);
}

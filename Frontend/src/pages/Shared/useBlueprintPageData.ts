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
  isLoading: false,
  error: null,
  source: "Placeholder",
  sections: [],
  statuses: [],
  kpis: [],
};

export function useBlueprintPageData(blueprint: PageBlueprint): BlueprintPageState {
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
        setSessionProfile(profile);
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
        setState({
          isLoading: false,
          error: null,
          source: "Placeholder",
          sections: [
            {
              title: blueprint.heading,
              summary: blueprint.placeholderReason || "No university ERP source mapped.",
              tables: [],
            },
          ],
          statuses: [
            {
              id: `${blueprint.route}-placeholder`,
              tone: "info",
              text: blueprint.placeholderReason || "No university ERP source mapped.",
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
  }, [blueprint, sessionProfile]);

  return state;
}

export function useRouteBlueprint(pathname: string) {
  return useMemo(() => pathname, [pathname]);
}

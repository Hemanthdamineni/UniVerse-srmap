import type { PageBlueprint } from "../../../config/erpBlueprints";
import type { KpiItem, PageSourceLabel, StatusMessage } from "../../../components/erp/ErpPrimitives";
import { buildKpis } from "./kpis";
import {
  buildSessionProfileSection,
  collectLeafSections,
  dedupeStatusMessages,
  normalizeLeafSection,
  orderSectionsByRenderer,
  transformSectionsByRenderer,
} from "./sectionUtils";
import type { BlueprintPageState, ExternalPagePayload, KeyLoadResult } from "./types";
import { stripScriptNoise } from "./valueUtils";

const STATUS_HINTS = [
  { regex: /registration closed/i, text: "Registration is currently closed.", tone: "locked" as const },
  {
    regex: /not applicable/i,
    text: "This feature is not applicable for your current profile.",
    tone: "warning" as const,
  },
  {
    regex: /you are not registered/i,
    text: "You are currently not registered for this service.",
    tone: "info" as const,
  },
  { regex: /no events found/i, text: "No events found right now.", tone: "info" as const },
  {
    regex: /no announcements found/i,
    text: "No announcements available right now.",
    tone: "info" as const,
  },
  {
    regex: /open soon/i,
    text: "This workflow will open soon.",
    tone: "warning" as const,
  },
  {
    regex: /registered successfully/i,
    text: "Registration completed successfully.",
    tone: "success" as const,
  },
  {
    regex: /not registered with sap/i,
    text: "You are not registered with SAP.",
    tone: "info" as const,
  },
];

export function sourceLabelForMode(sourceMode: "erp" | "internal" | "external"): PageSourceLabel {
  if (sourceMode === "external") return "External SQLite";
  if (sourceMode === "internal") return "Internal API";
  return "Dump Snapshot";
}

export function normalizeExternalPayload(
  blueprint: PageBlueprint,
  payload: ExternalPagePayload
): BlueprintPageState {
  const rows: Array<Record<string, string>> = [];
  const kpis: KpiItem[] = [];

  for (const item of payload.items || []) {
    const label = String(item.label || "").trim();
    const value = String(item.value || "").trim();
    if (!label && !value) continue;
    rows.push({ Label: label || "-", Value: value || "-" });
  }

  rows.slice(0, 4).forEach((item) => {
    if (item.Label !== "-" && item.Value !== "-") {
      kpis.push({ label: item.Label, value: item.Value });
    }
  });

  return {
    isLoading: false,
    error: null,
    source: "External SQLite",
    updatedAt: payload.updatedAt,
    sections: [
      {
        title: payload.title || blueprint.heading,
        summary: payload.summary || "External source is available.",
        tables:
          rows.length > 0
            ? [
                {
                  title: "External Data",
                  columns: ["Label", "Value"],
                  rows,
                },
              ]
            : [],
      },
    ],
    statuses: [],
    kpis,
  };
}

export function normalizeErpPayloads(
  blueprint: PageBlueprint,
  results: KeyLoadResult[],
  sessionProfile: Record<string, unknown> | null
): BlueprintPageState {
  const allStatuses: StatusMessage[] = [];
  const sections = [];
  const textSamples: string[] = [];

  let anyLive = false;
  let updatedAt: string | undefined;

  for (const result of results) {
    if (result.source === "live") anyLive = true;
    if (!updatedAt && result.updatedAt) updatedAt = result.updatedAt;

    const leaves = collectLeafSections(result.payload);
    leaves.forEach((leaf) => {
      const cleanedText = stripScriptNoise(leaf.text || "");
      if (cleanedText) textSamples.push(cleanedText);

      const normalized = normalizeLeafSection(leaf, blueprint.renderer);
      normalized.statuses.forEach((status) => allStatuses.push(status));
      if (normalized.section) sections.push(normalized.section);
    });
  }

  if (blueprint.includeSessionProfile) {
    const profileSection = buildSessionProfileSection(sessionProfile);
    if (profileSection) {
      sections.unshift(profileSection);
    }
  }

  textSamples.forEach((text) => {
    for (const hint of STATUS_HINTS) {
      if (hint.regex.test(text)) {
        allStatuses.push({
          id: `${hint.text}-${allStatuses.length}`,
          tone: hint.tone,
          text: hint.text,
        });
      }
    }
  });

  const dedupedStatuses = dedupeStatusMessages(allStatuses);
  const transformedSections = transformSectionsByRenderer(sections, blueprint.renderer);
  const orderedSections = orderSectionsByRenderer(transformedSections, blueprint.renderer);
  const seenSectionKeys = new Set<string>();
  const dedupedSections = orderedSections.filter((section) => {
    const tableFingerprint = section.tables
      .slice(0, 2)
      .map((table) => table.rows.slice(0, 3).map((row) => Object.values(row).slice(0, 3).join("|")).join("~"))
      .join("::");

    const titlePrefix = section.title.toLowerCase().replace(/ details$/i, "").trim();
    const key = tableFingerprint.length > 20 ? tableFingerprint : `${titlePrefix}::${tableFingerprint}`;

    if (seenSectionKeys.has(key)) return false;
    seenSectionKeys.add(key);
    return true;
  });
  const kpis = buildKpis(blueprint.renderer, dedupedSections, textSamples);

  return {
    isLoading: false,
    error: null,
    source: anyLive ? "Live ERP" : "Dump Snapshot",
    updatedAt,
    sections: dedupedSections,
    statuses: dedupedStatuses,
    kpis,
  };
}

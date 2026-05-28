import { useEffect, useMemo, useState } from "react";
import {
  isPlaceholderBlueprint,
  type PageBlueprint,
  type PageRenderer,
} from "../../config/erpBlueprints";
import {
  type DataTableModel,
  type KpiItem,
  type PageSourceLabel,
  type SectionModel,
  type StatusMessage,
} from "../../components/erp/ErpPrimitives";
import {
  fetchSessionProfile,
  readStoredProfileData,
} from "../../lib/session";
import { loadErpKey, loadExternalPage } from "./blueprintData/api";
import type { BlueprintPageState, ExternalPagePayload, KeyLoadResult, LeafSection } from "./blueprintData/types";
import { buildKpis } from "./blueprintData/kpis";
import { parseExamMarkDetails } from "./blueprintData/examMarkParser";
import { isClearlyNoiseRow, normalizeTables } from "./blueprintData/tableUtils";
import {
  CODE_NOISE_PATTERN,
  buildSummary,
  cleanCell,
  cleanTitle,
  isNonUserFacingSummary,
  isRecord,
  normalizeCompare,
  statusToneForText,
  stripScriptNoise,
} from "./blueprintData/valueUtils";

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

const SECTION_ORDER_PATTERNS: Partial<Record<PageRenderer, string[]>> = {
  "results-current": [
    "current semester results",
    "internal mark details",
  ],
  "results-earlier": [
    "historical exam marks",
    "exam mark details",
    "earlier internal mark details",
  ],
  "finance-dues": [
    "dues",
    "fee due details",
  ],
  "finance-paid": [
    "fee paid details",
    "payment receipts",
    "payment acknowledgment",
    "online payment verification",
    "refund",
  ],
};

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

function sourceLabelForMode(sourceMode: "erp" | "internal" | "external"): PageSourceLabel {
  if (sourceMode === "external") return "External SQLite";
  if (sourceMode === "internal") return "Internal API";
  return "Dump Snapshot";
}

function normalizeExternalPayload(
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

function normalizeErpPayloads(
  blueprint: PageBlueprint,
  results: KeyLoadResult[],
  sessionProfile: Record<string, unknown> | null
): BlueprintPageState {
  const allLeaves: LeafSection[] = [];
  const allStatuses: StatusMessage[] = [];
  const sections: SectionModel[] = [];
  const textSamples: string[] = [];

  let anyLive = false;
  let updatedAt: string | undefined;

  for (const result of results) {
    if (result.source === "live") anyLive = true;
    if (!updatedAt && result.updatedAt) updatedAt = result.updatedAt;

    const leaves = collectLeafSections(result.payload);
    leaves.forEach((leaf) => {
      allLeaves.push(leaf);
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
  // Deduplicate sections with heavily overlapping content (can happen when two fetchKeys
  // return the same data under slightly different titles, e.g. "Exam Registration" vs "Exam Registration Details").
  const seenSectionKeys = new Set<string>();
  const dedupedSections = orderedSections.filter((section) => {
    // Build a fingerprint from first 3 row values of first 2 tables
    const tableFingerprint = section.tables
      .slice(0, 2)
      .map(t => t.rows.slice(0, 3).map((row) => Object.values(row).slice(0, 3).join("|")).join("~"))
      .join("::");
      
    // Use title Prefix to handle "XYZ" vs "XYZ Details"
    const titlePrefix = section.title.toLowerCase().replace(/ details$/i, "").trim();
    
    // If the table has substantial data and we've seen this exact data before under a similar title, drop it
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

function transformSectionsByRenderer(sections: SectionModel[], renderer: PageRenderer): SectionModel[] {
  if (renderer !== "timetable") {
    return sections;
  }

  return sections.map((section) => {
    if (!/time table/i.test(section.title) || section.tables.length === 0) {
      return section;
    }

    const [primaryTable, ...restTables] = section.tables;
    if (!primaryTable.columns.includes("col1")) {
      return section;
    }

    const slotColumns = primaryTable.columns.filter((column) => /^\d+$/.test(column));
    if (slotColumns.length === 0 || primaryTable.rows.length < 3) {
      return section;
    }

    const timeRow =
      primaryTable.rows.find((row) =>
        slotColumns.every((column) => /^\d{2}:\d{2}/.test((row[column] || "").trim()))
      ) || primaryTable.rows[1];

    const dayRows = primaryTable.rows.filter((row) =>
      /monday|tuesday|wednesday|thursday|friday|saturday|sunday/i.test(row.col1 || "")
    );

    if (dayRows.length === 0) {
      return section;
    }

    const mappedColumnNames = makeUniqueColumnNames(
      slotColumns.map((slot) => (timeRow[slot] || `Slot ${slot}`).trim())
    );
    const columns = ["Day", ...mappedColumnNames];

    const rows = dayRows.map((dayRow) => {
      const mappedRow: Record<string, string> = { Day: dayRow.col1 || "-" };
      slotColumns.forEach((slot, index) => {
        mappedRow[mappedColumnNames[index]] = dayRow[slot] || "-";
      });
      return mappedRow;
    });

    return {
      ...section,
      tables: [{ title: "Weekly Schedule", columns, rows }, ...restTables],
    };
  });
}

function orderSectionsByRenderer(sections: SectionModel[], renderer: PageRenderer): SectionModel[] {
  const patterns = SECTION_ORDER_PATTERNS[renderer];
  if (!patterns || patterns.length === 0) {
    return sections;
  }

  return sections
    .map((section, index) => {
      const normalizedTitle = normalizeCompare(section.title);
      const rank = patterns.findIndex((pattern) => normalizedTitle.includes(pattern));
      return {
        section,
        index,
        rank: rank >= 0 ? rank : patterns.length + 10,
      };
    })
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      return a.index - b.index;
    })
    .map((entry) => entry.section);
}

function makeUniqueColumnNames(columns: string[]): string[] {
  const seen = new Map<string, number>();
  return columns.map((column) => {
    const base = column || "Slot";
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base} (${count + 1})`;
  });
}

function normalizeLeafSection(
  leaf: LeafSection,
  renderer: PageRenderer
): { section: SectionModel | null; statuses: StatusMessage[] } {
  const statuses: StatusMessage[] = [];
  const tables: DataTableModel[] = [];

  if (leaf.tableContent) {
    const rows = Object.entries(leaf.tableContent)
      .map(([key, value]) => ({ Field: key, Value: cleanCell(value) }))
      .filter((row) => row.Field || row.Value)
      .filter((row) => !isClearlyNoiseRow({ col0: row.Field, col1: row.Value }, leaf.title));

    if (rows.length > 0) {
      tables.push({ title: "Profile Details", columns: ["Field", "Value"], rows });
    }
  }

  if (/exam mark details/i.test(leaf.title) && renderer === "results-earlier") {
    const parsedExamTable = parseExamMarkDetails(leaf.tables);
    if (parsedExamTable) {
      tables.push(parsedExamTable);
    }
  }

  if (tables.length === 0) {
    const normalized = normalizeTables(leaf.tables, leaf.title, renderer);
    normalized.statuses.forEach((status) => statuses.push(status));
    normalized.tables.forEach((table) => tables.push(table));
  }

  const cleanedText = stripScriptNoise(leaf.text || "");
  const summaryCandidate = buildSummary(cleanedText);
  // Test both the candidate AND the full cleaned source — if the raw text contained JS
  // artifacts (e.g. jQuery snippets), suppress the summary even if the extracted
  // sentences look clean.
  const summary =
    isNonUserFacingSummary(summaryCandidate || cleanedText, renderer, tables.length) ||
    isNonUserFacingSummary(cleanedText, renderer, tables.length)
      ? undefined
      : summaryCandidate;

  // Build links from externalUrl — this is set for external resource pages that
  // the ERP backend detected as requiring browser navigation
  const links: Array<{ label: string; href: string }> = [];
  if (leaf.externalUrl) {
    links.push({ label: "Open in ERP Portal", href: leaf.externalUrl });
  }

  if (!summary && tables.length === 0 && links.length === 0) {
    return { section: null, statuses };
  }

  return {
    section: {
      title: leaf.title,
      summary: summary ?? (links.length > 0 ? "This resource is available on the external ERP portal." : undefined),
      tables,
      links: links.length > 0 ? links : undefined,
    },
    statuses,
  };
}

/**
 * Detects whether an object looks like a document node tree structure
 * (i.e. { id, type, props, children }) rather than actual ERP data.
 * These nodes are handled by the V2 document renderer and must NOT
 * be fed into the blueprint table pipeline.
 */
function isDocumentNodeShape(node: unknown): boolean {
  if (!isRecord(node)) return false;
  const nodeKeys = ["id", "type", "props", "children"];
  const matchCount = nodeKeys.filter((key) => key in node).length;
  // A node-shaped record has at least 3 of the 4 canonical keys
  // and the "type" value is a known node type string.
  if (matchCount < 3) return false;
  if (typeof node.type !== "string") return false;
  const knownNodeTypes = new Set(["container", "text", "table", "form", "field", "button"]);
  return knownNodeTypes.has(node.type);
}

function collectLeafSections(payload: unknown): LeafSection[] {
  const leaves: LeafSection[] = [];

  function walk(node: unknown, path: string[]) {
    if (!isRecord(node)) return;

    // STEP 4: If the payload contains a document.root, skip it entirely.
    // The V2 Document pipeline handles this data — the blueprint pipeline
    // must NOT attempt to interpret it as flat tables.
    if (isRecord(node.document) && isRecord(node.document.root)) {
      // Do NOT walk into document.root. Remove 'document' from further
      // traversal so we only process the non-document parts of the payload.
      const withoutDocument: Record<string, unknown> = {};
      Object.entries(node).forEach(([key, value]) => {
        if (key !== "document") withoutDocument[key] = value;
      });
      walk(withoutDocument, path);
      return;
    }

    // If this node itself looks like a document node tree entry, skip it.
    if (isDocumentNodeShape(node)) {
      return;
    }

    const hasLeafKeys =
      "title" in node ||
      "text" in node ||
      "tables" in node ||
      "externalUrl" in node ||
      "TableContent" in node;

    if (hasLeafKeys) {
      leaves.push({
        title: cleanTitle(String(node.title || path[path.length - 1] || "Details")),
        text: typeof node.text === "string" ? node.text : undefined,
        tables: Array.isArray(node.tables) ? node.tables : [],
        externalUrl: typeof node.externalUrl === "string" ? node.externalUrl : undefined,
        tableContent: isRecord(node.TableContent)
          ? (node.TableContent as Record<string, unknown>)
          : undefined,
      });
      return;
    }

    Object.entries(node).forEach(([key, value]) => {
      // Skip keys that would lead us into node tree structures
      if (key === "children" && Array.isArray(value) && value.some(isDocumentNodeShape)) {
        return;
      }
      walk(value, [...path, key]);
    });
  }

  walk(payload, []);
  return leaves;
}

function buildSessionProfileSection(sessionProfile: Record<string, unknown> | null): SectionModel | null {
  if (!isRecord(sessionProfile)) return null;

  const tableContent = isRecord(sessionProfile.TableContent)
    ? (sessionProfile.TableContent as Record<string, unknown>)
    : isRecord(sessionProfile.profileData)
      ? (sessionProfile.profileData as Record<string, unknown>)
      : null;

  if (!tableContent) return null;

  const rows = Object.entries(tableContent)
    .map(([key, value]) => ({ Field: key, Value: cleanCell(value) }))
    .filter((row) => row.Field || row.Value);

  if (rows.length === 0) return null;

  return {
    title: "Session Profile",
    summary: "Profile data from your current login session.",
    tables: [
      {
        title: "Student Profile",
        columns: ["Field", "Value"],
        rows,
      },
    ],
  };
}

function dedupeStatusMessages(statuses: StatusMessage[]) {
  const seen = new Set<string>();
  const output: StatusMessage[] = [];

  statuses.forEach((status) => {
    const normalized = `${status.tone}:${normalizeCompare(status.text)}`;
    if (!normalized || seen.has(normalized)) return;

    seen.add(normalized);
    output.push({
      ...status,
      id: `${output.length}-${status.id}`,
    });
  });

  return output;
}

export function useRouteBlueprint(pathname: string) {
  return useMemo(() => pathname, [pathname]);
}

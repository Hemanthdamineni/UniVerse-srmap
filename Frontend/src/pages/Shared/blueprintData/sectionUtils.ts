import type { PageRenderer } from "../../../config/erpBlueprints";
import type { DataTableModel, SectionModel, StatusMessage } from "../../../components/erp/ErpPrimitives";
import type { LeafSection } from "./types";
import { parseExamMarkDetails } from "./examMarkParser";
import { isClearlyNoiseRow, normalizeTables } from "./tableUtils";
import {
  buildSummary,
  cleanCell,
  cleanTitle,
  isNonUserFacingSummary,
  isRecord,
  normalizeCompare,
  stripScriptNoise,
} from "./valueUtils";

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

export function transformSectionsByRenderer(sections: SectionModel[], renderer: PageRenderer): SectionModel[] {
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

export function orderSectionsByRenderer(sections: SectionModel[], renderer: PageRenderer): SectionModel[] {
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

export function normalizeLeafSection(
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
  const summary =
    isNonUserFacingSummary(summaryCandidate || cleanedText, renderer, tables.length) ||
    isNonUserFacingSummary(cleanedText, renderer, tables.length)
      ? undefined
      : summaryCandidate;

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

export function collectLeafSections(payload: unknown): LeafSection[] {
  const leaves: LeafSection[] = [];

  function walk(node: unknown, path: string[]) {
    if (!isRecord(node)) return;

    if (isRecord(node.document) && isRecord(node.document.root)) {
      const withoutDocument: Record<string, unknown> = {};
      Object.entries(node).forEach(([key, value]) => {
        if (key !== "document") withoutDocument[key] = value;
      });
      walk(withoutDocument, path);
      return;
    }

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
      if (key === "children" && Array.isArray(value) && value.some(isDocumentNodeShape)) {
        return;
      }
      walk(value, [...path, key]);
    });
  }

  walk(payload, []);
  return leaves;
}

export function buildSessionProfileSection(sessionProfile: Record<string, unknown> | null): SectionModel | null {
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

export function dedupeStatusMessages(statuses: StatusMessage[]) {
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

function makeUniqueColumnNames(columns: string[]): string[] {
  const seen = new Map<string, number>();
  return columns.map((column) => {
    const base = column || "Slot";
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base} (${count + 1})`;
  });
}

function isDocumentNodeShape(node: unknown): boolean {
  if (!isRecord(node)) return false;
  const nodeKeys = ["id", "type", "props", "children"];
  const matchCount = nodeKeys.filter((key) => key in node).length;
  if (matchCount < 3) return false;
  if (typeof node.type !== "string") return false;
  const knownNodeTypes = new Set(["container", "text", "table", "form", "field", "button"]);
  return knownNodeTypes.has(node.type);
}

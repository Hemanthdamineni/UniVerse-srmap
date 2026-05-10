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
  getSessionId,
  handleSessionAuthFailure,
  isSessionAuthFailure,
  readStoredProfileData,
} from "../../lib/session";
import { sanitizeErpDisplayText } from "../../lib/erpDisplayText";

interface BlueprintPageState {
  isLoading: boolean;
  error: string | null;
  source: PageSourceLabel;
  updatedAt?: string;
  sections: SectionModel[];
  statuses: StatusMessage[];
  kpis: KpiItem[];
}

interface KeyLoadResult {
  pageKey: string;
  source: "live" | "dump";
  payload: unknown;
  updatedAt?: string;
}

interface LeafSection {
  title: string;
  text?: string;
  tables: unknown[];
  externalUrl?: string;
  tableContent?: Record<string, unknown>;
}

const CODE_NOISE_PATTERN =
  /(function\s+[a-z0-9_]+\s*\(|\$\(|\.jsp|validationengine|ajaxparameter|e\.preventdefault|window\.open|@page|^\.[a-z0-9_-]+\s*\{|^input,select\{|^thead\{|^var\s+[a-z0-9_]+\s*=|font-size\s*:|font-family\s*:|background(?:-color)?\s*:|text-align\s*:|font-weight\s*:|padding\s*:|color\s*:|url\s*\(|\.jpg|\.png|subheader)/i;

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

const MONTH_PATTERN = /^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+\d{4}$/i;
const SUBJECT_CODE_PATTERN = /^[A-Z]{2,}\s*\d{2,3}[A-Z]?$/i;
const GRADE_PATTERN = /^(O|A\+|A|B\+|B|C|D|P|F|RA|AB)$/i;
const RESULT_PATTERN = /^(PASS|FAIL|ABSENT|RA|WH)$/i;

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

const RESULT_COLUMN_ORDER = [
  "Semester",
  "Month & Year",
  "Subject Code",
  "Subject Description",
  "Credit",
  "Grade",
  "Grade Point",
  "Result",
  "Attempt",
];

const FINANCE_COLUMN_ORDER = [
  "Sl.No.",
  "Term",
  "Fee Type",
  "Due Date",
  "Amount",
  "Receipt Date",
  "Mode",
  "Number",
  "Receipt No.",
  "Particulars",
  "Received Date",
  "Transaction No.",
  "Reference No.",
  "Payment Channel",
  "Payment Status",
  "Action",
];

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
  payload: {
    title?: string;
    summary?: string;
    items?: Array<{ label?: string; value?: string }>;
    updatedAt?: string;
  }
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

  if (!summary && tables.length === 0) {
    return { section: null, statuses };
  }

  return {
    section: {
      title: leaf.title,
      summary,
      tables,
    },
    statuses,
  };
}

function normalizeTables(
  rawTables: unknown[],
  sectionTitle: string,
  renderer: PageRenderer
): { tables: DataTableModel[]; statuses: StatusMessage[] } {
  const tables: DataTableModel[] = [];
  const statuses: StatusMessage[] = [];

  rawTables.forEach((rawTable, tableIndex) => {
    if (!Array.isArray(rawTable)) return;

    // Check for node tree structure BEFORE sanitizeRow() destroys object info.
    // If the raw rows look like a node tree, skip this table entirely.
    const rawRecords = rawTable.filter(isRecord);
    if (rawRecords.length > 0 && looksLikeNodeTreeData(rawRecords)) {
      return;
    }

    const rawRows = rawRecords.map((row) => sanitizeRow(row));
    if (rawRows.length === 0) return;

    let columns = collectColumns(rawRows);
    let rows = rawRows
      .map((row) => projectRow(row, columns))
      .filter((row) => !isEmptyRow(row, columns))
      .filter((row) => !isHeaderDuplicateRow(row, columns))
      .filter((row) => !isClearlyNoiseRow(row, sectionTitle));

    if (looksLikeObjectTreeTable(columns, rows)) {
      return;
    }

    if (columns.length > 1) {
      // Drop columns where EVERY row is either empty or the dash-only placeholder "-"
      // (which the ERP uses as a null sentinel). This removes phantom columns from tables
      // like Fee Paid Details that have trailing spacer columns with all "-" values.
      columns = columns.filter((column) =>
        rows.some((row) => {
          const v = (row[column] || "").trim();
          return v.length > 0 && v !== "-";
        })
      );
      rows = rows.map((row) => projectRow(row, columns));
    }

    if (rows.length === 0 || columns.length === 0) return;

    if (columns.length === 1 && rows.length <= 3) {
      rows.forEach((row) => {
        const value = row[columns[0]];
        if (!value) return;
        statuses.push({
          id: `${sectionTitle}-${tableIndex}-${value}`,
          tone: statusToneForText(value),
          text: value,
        });
      });
      return;
    }

    const tunedTable = tuneTableModel(
      {
        title: rawTables.length > 1 ? `${sectionTitle} (${tableIndex + 1})` : sectionTitle,
        columns,
        rows,
      },
      sectionTitle,
      renderer,
      tableIndex
    );

    tables.push(tunedTable);
  });

  return { tables, statuses };
}

function tuneTableModel(
  table: DataTableModel,
  sectionTitle: string,
  renderer: PageRenderer,
  tableIndex: number
): DataTableModel {
  let columns = [...table.columns];
  let rows = table.rows.map((row) => ({ ...row }));

  if (isFinanceLedgerSection(sectionTitle)) {
    const promoted = promoteFinanceLedgerHeader(columns, rows);
    columns = promoted.columns;
    rows = promoted.rows;
  }

  if (/payment receipts|payment acknowledgment/i.test(sectionTitle)) {
    const renamed = renameColumns(columns, rows, { col6: "Action" });
    columns = renamed.columns;
    rows = renamed.rows;
  }

  if (/online payment verification/i.test(sectionTitle)) {
    const renamed = renameColumns(columns, rows, { col1: "Action" });
    columns = renamed.columns;
    rows = renamed.rows;
  }

  columns = reorderColumnsForSection(columns, sectionTitle, renderer);
  rows = rows.map((row) => projectRow(row, columns));

  // Post-tuning phantom column pruning: drop columns
  // where every data row is effectively empty or contains no alphanumeric characters.
  if (columns.length > 1) {
    columns = columns.filter((column) =>
      rows.some((row) => {
        const v = (row[column] || "").trim();
        // Keep column if any row has a value with at least one alphanumeric character
        // In finance tables, we also consider "0", "0.00" as empty noise for pruning
        const isZero = /^0(\.0+)?$/.test(v);
        return !isZero && v.replace(/[\W_]/g, "").length > 0;
      })
    );
    rows = rows.map((row) => projectRow(row, columns));
  }

  return {
    title: resolveTableTitle(sectionTitle, renderer, tableIndex),
    columns,
    rows,
    disableInternalScroll: renderer === "finance-paid",
  };
}

function promoteFinanceLedgerHeader(columns: string[], rows: Array<Record<string, string>>) {
  const headerRowIndex = rows.findIndex((row) => {
    const rowText = Object.values(row).join(" ");
    return /term/i.test(rowText) && /fee type/i.test(rowText) && /due date/i.test(rowText);
  });

  if (headerRowIndex < 0) {
    return { columns, rows };
  }

  const headerRow = rows[headerRowIndex];
  const renameMap: Record<string, string> = {};

  columns.forEach((column) => {
    const candidate = (headerRow[column] || "").trim();
    if (!candidate) return;
    if (candidate === "-" || candidate === "0") return;
    renameMap[column] = candidate;
  });

  if (Object.keys(renameMap).length < 3) {
    return { columns, rows };
  }

  const renamed = renameColumns(columns, rows, renameMap);
  return {
    columns: renamed.columns,
    rows: renamed.rows.filter((_, index) => index !== headerRowIndex),
  };
}

function renameColumns(
  columns: string[],
  rows: Array<Record<string, string>>,
  renameMap: Record<string, string>
) {
  const nextColumns = columns.map((column) => renameMap[column] || column);
  const nextRows = rows.map((row) => {
    const mapped: Record<string, string> = {};
    columns.forEach((column, index) => {
      mapped[nextColumns[index]] = row[column] || "";
    });
    return mapped;
  });

  return {
    columns: nextColumns,
    rows: nextRows,
  };
}

function reorderColumnsForSection(
  columns: string[],
  sectionTitle: string,
  renderer: PageRenderer
) {
  if (renderer === "results-current" || renderer === "results-earlier") {
    return reorderColumns(columns, RESULT_COLUMN_ORDER);
  }

  if (renderer === "finance-paid" || renderer === "finance-dues" || /fee|payment|dues/i.test(sectionTitle)) {
    return reorderColumns(columns, FINANCE_COLUMN_ORDER);
  }

  return columns;
}

function reorderColumns(columns: string[], preferredOrder: string[]) {
  const used = new Set<string>();
  const ordered: string[] = [];

  for (const preferred of preferredOrder) {
    const match = columns.find(
      (column) =>
        !used.has(column) &&
        normalizeCompare(column) === normalizeCompare(preferred)
    );

    if (match) {
      used.add(match);
      ordered.push(match);
    }
  }

  columns.forEach((column) => {
    if (!used.has(column)) {
      used.add(column);
      ordered.push(column);
    }
  });

  return ordered;
}

function resolveTableTitle(sectionTitle: string, renderer: PageRenderer, tableIndex: number) {
  const normalized = normalizeCompare(sectionTitle);

  if (renderer === "results-current" && normalized.includes("current semester results")) {
    return "Result Sheet";
  }

  if (renderer === "results-current" && normalized.includes("internal mark details")) {
    return tableIndex === 0 ? "Internal Mark Summary" : `Internal Mark Breakdown ${tableIndex}`;
  }

  if (renderer === "results-earlier" && normalized.includes("historical exam marks")) {
    return "Historical Exam Marks";
  }

  if (renderer === "finance-paid" && normalized.includes("fee paid details")) {
    return tableIndex === 0 ? "Fee Ledger" : "Refund Summary";
  }

  if (renderer === "finance-paid" && /payment receipts|payment acknowledgment/.test(normalized)) {
    return "Receipt History";
  }

  if (renderer === "finance-paid" && normalized.includes("online payment verification")) {
    return "Verification Queue";
  }

  if (renderer === "finance-dues" && /dues|fee due details/.test(normalized)) {
    return "Due Status";
  }

  return sectionTitle;
}

function isFinanceLedgerSection(sectionTitle: string) {
  const normalized = normalizeCompare(sectionTitle);
  return normalized.includes("fee paid details") || normalized.includes("fee paid");
}

function parseExamMarkDetails(rawTables: unknown[]): DataTableModel | null {
  const rows: Array<Record<string, string>> = [];

  rawTables.forEach((rawTable) => {
    if (!Array.isArray(rawTable) || rawTable.length === 0 || !isRecord(rawTable[0])) return;

    const rawRow = rawTable[0];
    const tokens = Array.from(
      new Set(
        Object.keys(rawRow)
          .map((key) => key.replace(/_\d+$/, "").trim())
          .filter((token) => token.length > 0)
      )
    );

    const parsedRow = parseExamMarkTokenRow(tokens);
    if (parsedRow) {
      rows.push(parsedRow);
    }
  });

  // ERP API returns duplicate objects for each exam mark: one in ALL CAPS, one in Title Case.
  // We must filter out the ALL CAPS duplicates. We check if the Subject Description is all uppercase.
  const filteredRows = rows.filter((row) => {
    const desc = row["Subject Description"];
    if (desc && desc !== "-" && desc.length > 3 && desc === desc.toUpperCase()) {
      return false; // Skip ALL CAPS variant
    }
    return true;
  });

  if (filteredRows.length === 0) return null;

  return {
    title: "Historical Exam Marks",
    columns: [
      "Semester",
      "Month & Year",
      "Subject Code",
      "Subject Description",
      "Credit",
      "Grade",
      "Grade Point",
      "Result",
      "Attempt",
    ],
    rows: filteredRows,
  };
}

function parseExamMarkTokenRow(tokens: string[]): Record<string, string> | null {
  const row: Record<string, string> = {
    Semester: "-",
    "Month & Year": "-",
    "Subject Code": "-",
    "Subject Description": "-",
    Credit: "-",
    Grade: "-",
    "Grade Point": "-",
    Result: "-",
    Attempt: "-",
  };

  const numericTokens = tokens.filter((token) => /^\d+$/.test(token));
  if (numericTokens.length > 0) row.Semester = numericTokens[0];
  if (numericTokens.length > 1) row.Credit = numericTokens[1];
  if (numericTokens.length > 2) row.Attempt = numericTokens[numericTokens.length - 1];

  const monthToken = tokens.find((token) => MONTH_PATTERN.test(token));
  if (monthToken) row["Month & Year"] = monthToken;

  const subjectCode = tokens.find((token) => SUBJECT_CODE_PATTERN.test(token));
  if (subjectCode) row["Subject Code"] = subjectCode;

  const gradeToken = tokens.find((token) => GRADE_PATTERN.test(token));
  if (gradeToken) row.Grade = gradeToken;

  const gradePointToken = tokens.find((token) => /^\d+\.\d{2}$/.test(token));
  if (gradePointToken) row["Grade Point"] = gradePointToken;

  const resultToken = tokens.find((token) => RESULT_PATTERN.test(token));
  if (resultToken) row.Result = resultToken;

  const description = tokens
    .filter((token) => token.length > 3)
    .filter((token) => !MONTH_PATTERN.test(token))
    .filter((token) => !SUBJECT_CODE_PATTERN.test(token))
    .filter((token) => !GRADE_PATTERN.test(token))
    .filter((token) => !RESULT_PATTERN.test(token))
    .filter((token) => !/^\d+(\.\d+)?$/.test(token))
    .sort((a, b) => b.length - a.length)[0];

  if (description) row["Subject Description"] = description;

  if (row["Subject Code"] === "-" || row["Subject Description"] === "-") {
    return null;
  }

  return row;
}

function buildKpis(renderer: PageRenderer, sections: SectionModel[], textSamples: string[]): KpiItem[] {
  const rows = sections.flatMap((section) => section.tables.flatMap((table) => table.rows));

  if (renderer === "attendance") {
    const attendanceValues = rows
      .map((row) => parseNumericValue(row["Attendance %"] || ""))
      .filter((value): value is number => Number.isFinite(value));

    const lowAttendanceCount = attendanceValues.filter((value) => value < 75).length;
    return [
      {
        label: "Subjects Tracked",
        value: String(attendanceValues.length),
      },
      {
        label: "Average Attendance",
        value:
          attendanceValues.length > 0
            ? `${(attendanceValues.reduce((a, b) => a + b, 0) / attendanceValues.length).toFixed(2)}%`
            : "-",
      },
      {
        label: "Below 75%",
        value: String(lowAttendanceCount),
      },
    ];
  }

  if (renderer === "curriculum") {
    const totalCredits = rows
      .map((row) => parseNumericValue(row.Credit || ""))
      .filter((value): value is number => Number.isFinite(value))
      .reduce((sum, value) => sum + value, 0);

    return [
      { label: "Subjects", value: String(rows.length) },
      { label: "Total Credits", value: totalCredits > 0 ? String(totalCredits) : "-" },
    ];
  }

  if (renderer === "results-current") {
    const sgpaText = textSamples.join(" ");
    const sgpaMatch = sgpaText.match(/S\.G\.P\.A\s*([0-9.]+)/i);
    const passedCount = rows.filter((row) => /pass/i.test(row.Result || "")).length;

    return [
      { label: "SGPA", value: sgpaMatch?.[1] || "-" },
      { label: "Subjects Passed", value: String(passedCount) },
    ];
  }

  if (renderer === "results-earlier") {
    const gradePoints = rows
      .map((row) => parseNumericValue(row["Grade Point"] || row["Grade Points"] || ""))
      .filter((value): value is number => Number.isFinite(value));

    const averageGradePoint =
      gradePoints.length > 0
        ? (gradePoints.reduce((a, b) => a + b, 0) / gradePoints.length).toFixed(2)
        : "-";

    return [
      { label: "Historical Exam Marks", value: String(rows.length) },
      { label: "Average Grade Point", value: averageGradePoint },
    ];
  }

  if (renderer === "finance-paid") {
    const amounts = rows
      .map((row) => parseNumericValue(row.Amount || ""))
      .filter((value): value is number => Number.isFinite(value));
    const total = amounts.reduce((sum, value) => sum + value, 0);

    return [
      { label: "Payment Entries", value: String(amounts.length) },
      { label: "Recorded Amount", value: total > 0 ? total.toLocaleString() : "-" },
    ];
  }

  if (renderer === "finance-dues") {
    const dues = rows
      .map((row) => parseNumericValue(row.Amount || row["Due Amount"] || ""))
      .filter((value): value is number => Number.isFinite(value));

    const totalDue = dues.reduce((sum, value) => sum + value, 0);
    return [{ label: "Outstanding Due", value: totalDue > 0 ? totalDue.toLocaleString() : "-" }];
  }

  if (renderer === "dashboard") {
    return [
      { label: "Sections Loaded", value: String(sections.length) },
      {
        label: "Tables Loaded",
        value: String(sections.flatMap((section) => section.tables).length),
      },
    ];
  }

  return [];
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

async function loadErpKey(pageKey: string): Promise<KeyLoadResult> {
  const liveResponse = await fetchJson(buildApiPath("/api/scrape", pageKey));
  return {
    pageKey,
    source: "live",
    payload: liveResponse,
    updatedAt: new Date().toISOString(),
  };
}

async function loadExternalPage(pageKey: string) {
  const payload = await fetchJson(buildApiPath("/api/external", pageKey), {
    nonJsonMessage: "External service returned non-JSON response",
  });

  if (!isRecord(payload) || payload.success !== true || !isRecord(payload.data)) {
    throw new Error("Invalid external payload format");
  }

  const data = payload.data;
  const items = Array.isArray(data.items) ? data.items : [];

  return {
    title: typeof data.title === "string" ? data.title : undefined,
    summary: typeof data.summary === "string" ? data.summary : undefined,
    items: items
      .filter(isRecord)
      .map((item) => ({
        label: typeof item.label === "string" ? item.label : undefined,
        value: typeof item.value === "string" ? item.value : undefined,
      })),
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : undefined,
  };
}

async function fetchJson(
  path: string,
  options: {
    nonJsonMessage?: string;
  } = {}
): Promise<unknown> {
  const sessionId = getSessionId();
  const url = sessionId && !path.includes("/api/external") ? `${path}?sessionId=${encodeURIComponent(sessionId)}` : path;

  const response = await fetch(url, {
    credentials: "include",
  });

  const parsed = await parseJsonResponse(response, options.nonJsonMessage);

  if (!response.ok) {
    if (isSessionAuthFailure(response.status, parsed)) {
      handleSessionAuthFailure();
    }
    const errorMessage = extractErrorMessage(parsed) || `Request failed (${response.status})`;
    throw new Error(errorMessage);
  }

  if (isRecord(parsed) && parsed.success === false) {
    const errorMessage = extractErrorMessage(parsed) || "Request failed";
    throw new Error(errorMessage);
  }

  return parsed;
}

async function parseJsonResponse(response: Response, nonJsonMessage = "Service returned non-JSON response") {
  const raw = await response.text();
  const trimmed = raw.trim();
  const contentType = response.headers.get("content-type") || "";

  const isLikelyJson =
    contentType.includes("application/json") || trimmed.startsWith("{") || trimmed.startsWith("[");

  if (!isLikelyJson) {
    throw new Error(nonJsonMessage);
  }

  try {
    return trimmed ? JSON.parse(trimmed) : {};
  } catch {
    throw new Error(nonJsonMessage);
  }
}

function extractErrorMessage(value: unknown): string | null {
  if (!isRecord(value)) return null;

  const candidates = [value.error, value.message, value.details]
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);

  return candidates[0] || null;
}

function buildApiPath(basePath: string, pageKey: string) {
  const [category, page] = pageKey.split("/");
  if (!page) {
    return `${basePath}/${encodeURIComponent(category)}`;
  }
  return `${basePath}/${encodeURIComponent(category)}/${encodeURIComponent(page)}`;
}

function sanitizeRow(row: Record<string, unknown>) {
  const output: Record<string, string> = {};

  Object.entries(row).forEach(([key, value]) => {
    // Skip structural keys that are node tree artifacts
    if (key === "children" && Array.isArray(value)) return;
    if (key === "props" && isRecord(value)) return;
    const cleanedKey = cleanColumnName(key);
    output[cleanedKey] = cleanCell(value);
  });

  return output;
}

function collectColumns(rows: Array<Record<string, string>>) {
  const seen = new Set<string>();
  const columns: string[] = [];

  rows.forEach((row) => {
    Object.keys(row).forEach((column) => {
      if (!seen.has(column)) {
        seen.add(column);
        columns.push(column);
      }
    });
  });

  return columns;
}

function projectRow(row: Record<string, string>, columns: string[]) {
  const projected: Record<string, string> = {};
  columns.forEach((column) => {
    projected[column] = row[column] || "";
  });
  return projected;
}

function isEmptyRow(row: Record<string, string>, columns: string[]) {
  return columns.every((column) => !(row[column] || "").trim());
}

function isHeaderDuplicateRow(row: Record<string, string>, columns: string[]) {
  const equalCount = columns.filter((column) => {
    const value = normalizeCompare(row[column]);
    return value.length > 0 && value === normalizeCompare(column);
  }).length;

  const combined = columns.map((column) => row[column]).join(" ").toLowerCase();
  if (combined.includes("name mark secured(conducted)")) return true;
  if (combined.includes("present(p)") && combined.includes("absent(a)")) return true;

  // Detect ALL CAPS echo rows: the ERP exports grouped header rows in full uppercase
  // Detect ALL CAPS echo rows: the ERP exports grouped header rows in full uppercase
  // before the actual data row with the same values in Title Case. These are visual
  // dividers — not distinct data records — and must be filtered.
  const nonEmptyValues = columns
    .map((c) => (row[c] || "").trim())
    .filter((v) => v.length > 0 && v !== "-");

  // Only test values that actually contain alphabetic characters — skip purely numeric
  // values like "1", "9.00" which are case-insensitive and always pass toUpperCase().
  const alphaValues = nonEmptyValues.filter((v) => /[a-zA-Z]/.test(v));
  if (alphaValues.length >= 1) {
    const isAllCaps = alphaValues.every((v) => v === v.toUpperCase());
    if (isAllCaps) {
      return true;
    }
  }

  return equalCount >= Math.max(2, columns.length - 1);
}

function isClearlyNoiseRow(row: Record<string, string>, sectionTitle: string) {
  const joined = Object.values(row).join(" ").trim();
  if (!joined) return true;

  if (CODE_NOISE_PATTERN.test(joined)) return true;

  if (/internal mark details/i.test(sectionTitle) && row["Subject Code"]) {
    const code = row["Subject Code"].trim();
    if (code && !/^[A-Z]{2,}\s*\d+/i.test(code)) {
      return true;
    }
  }

  if (/internal mark details/i.test(sectionTitle) && row.Name) {
    const conducted = (row["Mark Secured(Conducted)"] || "").trim();
    const converted = (row["Mark Secured(Converted)"] || "").trim();
    if (!conducted && !converted) {
      return true;
    }
  }

  // Filter rows that are ERP UI controls (buttons, print links, form actions) leaked
  // into data tables. These are often single-column rows containing a UI action label.
  const firstVal = Object.values(row)[0]?.trim() ?? "";
  if (/^(print|i agree|i agree, proceed|proceed|submit|save|cancel|reset|back|close|info)$/i.test(firstVal)) {
    return true;
  }
  
  // If the entire row joined together is just one of these keywords, filter it.
  const strippedJoined = joined.replace(/[-.\s]/g, '').toLowerCase();
  if (/^(print|iagree|proceed|submit|save|cancel|reset|back|close|info|action|actions)$/i.test(strippedJoined)) {
    return true;
  }

  // Filter rows where the only value is a long concatenated list of dropdown options
  // (e.g. "[SELECT EXAM MONTH AND YEAR] DECEMBER 2023 MAY 2024...") — these are form
  // select elements rendered as text, not data.
  if (
    Object.values(row).filter((v) => v && v.trim() && v.trim() !== "-").length === 1 &&
    /\[select\b/i.test(firstVal)
  ) {
    return true;
  }

  // Filter bank details specific noise
  if (joined.toLowerCase().includes("please enter your bank details")) return true;
  if (/^(save\s*-?|submit\s*-?)$/i.test(joined.trim())) return true;

  return false;
}

function stripScriptNoise(text: string) {
  if (!text) return "";

  const expanded = text.replace(/([;{}])/g, "$1\n");
  const lines = expanded
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !CODE_NOISE_PATTERN.test(line))
    .filter((line) => !/^[$@.#]/.test(line))
    .filter((line) => !/^\w+\([^)]*\)$/.test(line));

  return sanitizeErpDisplayText(lines.join(" "), "");
}

function buildSummary(text: string) {
  if (!text) return undefined;

  if (text.length <= 240) return text;

  const sentences = text.split(/(?<=[.!?])\s+/).map((sentence) => sentence.trim()).filter(Boolean);
  const interesting = sentences.filter((sentence) =>
    /note|registration|allowed|closed|disclaimer|period|please|verification|announcement/i.test(sentence)
  );

  const selected = (interesting.length > 0 ? interesting : sentences).slice(0, 2).join(" ");
  if (!selected) return undefined;
  if (selected.length <= 360) return selected;

  return `${selected.slice(0, 357)}...`;
}

function isNonUserFacingSummary(text: string, renderer: PageRenderer, tableCount: number) {
  const normalized = normalizeCompare(text);
  if (!normalized) return true;

  // When structured tables are present, suppress textual dumps above them.
  if (tableCount > 0) {
    return true;
  }

  // Ignore CSS/script residue and similar payload artifacts.
  if (CODE_NOISE_PATTERN.test(normalized)) {
    return true;
  }

  // Raw table dump patterns (e.g. "} } } TIME TABLE ... 09:00 ... Monday ... CSE 306 ...").
  const hasTimetableMarker = normalized.includes("time table");
  const timeHits = (normalized.match(/\b\d{2}:\d{2}\b/g) || []).length;
  const dayHits = (normalized.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/g) || []).length;
  const courseHits = (normalized.match(/\b[a-z]{2,5}\s*\d{2,3}[a-z]?\b/gi) || []).length;
  const headingHits = (normalized.match(/\b(subjects description|faculty name|class room name|l-t-p-c)\b/g) || []).length;
  const colHits = (normalized.match(/\bcol\d+\b/g) || []).length;
  const tokenCount = normalized.split(/\s+/).filter(Boolean).length;
  const sentencePunctuationHits = (text.match(/[.!?]/g) || []).length;

  if (hasTimetableMarker && (timeHits >= 4 || dayHits >= 2) && (courseHits >= 3 || headingHits >= 1)) {
    return true;
  }

  // Generic ERP dump blob: long token stream with tabular hints and no sentence structure.
  if ((colHits >= 2 || courseHits >= 6 || headingHits >= 2) && tokenCount >= 40 && sentencePunctuationHits === 0) {
    return true;
  }

  // Very long unstructured text lines are usually backend dumps, not user-facing summary.
  if (tokenCount >= 110 && sentencePunctuationHits <= 1) {
    return true;
  }

  // For generic renderer, require explicitly meaningful prose for summary.
  if (renderer === "generic") {
    const meaningfulHint =
      /note|registration|allowed|closed|disclaimer|period|please|verification|announcement|deadline|schedule|important|policy/i;
    if (!meaningfulHint.test(normalized)) {
      return true;
    }
  }

  // Stray brace-prefixed content is not useful to end users.
  if (/^[\][}{)(\s.,;:'"`-]+/.test(text.trim())) {
    return true;
  }

  return false;
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

function cleanColumnName(name: string) {
  const trimmed = String(name || "").trim();
  if (/^col\d+$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  return trimmed || "Column";
}

function cleanCell(value: unknown): string {
  // Safety: extract a primitive from objects instead of String() which
  // produces "[object Object]". This mirrors backend normalizeValue().
  const primitive = extractCellPrimitive(value);
  const raw = sanitizeErpDisplayText(
    String(primitive ?? "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    // Strip inline JS artifacts that leak as plain text from ERP scraping
    .replace(/\$\(document\)\.ready\([\s\S]*?\}\);?/g, " ")
    .replace(/\$\(['"][^'"]*['"]\)[\s\S]*?;/g, " ")
    .replace(/<\/?[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim(),
    ""
  );
  if (raw.length <= 220) return raw;
  return `${raw.slice(0, 217)}...`;
}

/**
 * Safely extract a renderable primitive from a value that may be an object.
 * Mirrors the backend normalizeValue() logic: recursively extracts
 * .text, .label, or .value from nested objects. Returns "" for
 * unrecognized objects instead of letting String() produce "[object Object]".
 */
function extractCellPrimitive(value: unknown): string | number | boolean {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return "";

  if (isRecord(value)) {
    if ("text" in value) return extractCellPrimitive(value.text);
    if ("label" in value) return extractCellPrimitive(value.label);
    if ("value" in value) return extractCellPrimitive(value.value);
    if ("props" in value && isRecord(value.props)) {
      if ("text" in value.props) return extractCellPrimitive(value.props.text);
      if ("label" in value.props) return extractCellPrimitive(value.props.label);
      if ("value" in value.props) return extractCellPrimitive(value.props.value);
    }
    // Unrecognized object — return empty, never String()
    return "";
  }

  return "";
}

function cleanTitle(title: string) {
  return sanitizeErpDisplayText(
    title
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim(),
    "Details"
  );
}

function looksLikeObjectTreeTable(columns: string[], rows: Array<Record<string, string>>) {
  if (columns.length === 0 || rows.length === 0) return false;

  const normalizedColumns = columns.map((column) => normalizeCompare(column));
  const treeColumnSet = new Set(["id", "type", "props", "children"]);
  const treeColumnHits = normalizedColumns.filter((column) => treeColumnSet.has(column)).length;

  // Strong signal: columns match the node schema shape
  if (treeColumnHits >= 3 && normalizedColumns.length <= 6) {
    return true;
  }

  // Check if "type" column values are known node type names
  const knownNodeTypes = new Set(["container", "text", "table", "form", "field", "button"]);
  const typeColumnIdx = normalizedColumns.indexOf("type");
  if (typeColumnIdx >= 0) {
    const typeColumn = columns[typeColumnIdx];
    const nodeTypeHits = rows.filter((row) => knownNodeTypes.has(normalizeCompare(row[typeColumn]))).length;
    if (nodeTypeHits >= Math.ceil(rows.length * 0.5)) {
      return true;
    }
  }

  const sampleValues = rows
    .flatMap((row) => Object.values(row))
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 20);

  if (sampleValues.length === 0) return false;

  const objectLikeCount = sampleValues.filter((value) => {
    return value === "[object object]" || value === "[object]" || /^\{.*\}$/.test(value) || /^\[.*\]$/.test(value);
  }).length;

  // Any [object Object] in values is a strong signal
  if (objectLikeCount >= 1) return true;

  return false;
}

/**
 * Pre-sanitization check: detects node tree structures in raw (un-stringified)
 * data. This runs BEFORE cleanCell/sanitizeRow, so objects are still intact.
 */
function looksLikeNodeTreeData(rawRows: Array<Record<string, unknown>>): boolean {
  if (rawRows.length === 0) return false;

  const knownNodeTypes = new Set(["container", "text", "table", "form", "field", "button"]);

  // Check if rows have the canonical node shape: { id, type, props, children }
  const nodeShapedCount = rawRows.filter((row) => {
    const hasId = "id" in row;
    const hasType = "type" in row && typeof row.type === "string" && knownNodeTypes.has(row.type);
    const hasProps = "props" in row && isRecord(row.props);
    const hasChildren = "children" in row && Array.isArray(row.children);
    return hasType && (hasId || hasProps || hasChildren);
  }).length;

  // If more than half the rows look like nodes, it's a tree table
  return nodeShapedCount >= Math.ceil(rawRows.length * 0.5);
}

function parseNumericValue(value: string) {
  const normalized = String(value || "").replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  if (!normalized) return NaN;
  return Number.parseFloat(normalized[0]);
}

function statusToneForText(text: string): StatusMessage["tone"] {
  const lowered = text.toLowerCase();
  if (/closed|not applicable|locked/.test(lowered)) return "locked";
  if (/warning|soon|pending/.test(lowered)) return "warning";
  if (/success|approved|registered successfully/.test(lowered)) return "success";
  return "info";
}

function normalizeCompare(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function useRouteBlueprint(pathname: string) {
  return useMemo(() => pathname, [pathname]);
}

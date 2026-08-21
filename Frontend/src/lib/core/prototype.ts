// ── staticPrototypeEnv.ts ───────────────────────────────────────────────
/**
 * When true, the app is built for static hosting with fixtures (no backend).
 * Set via `VITE_STATIC_PROTOTYPE=true` for `npm run build:static`.
 */
export function isStaticPrototype(): boolean {
  return (
    import.meta.env.VITE_STATIC_PROTOTYPE === "true" ||
    import.meta.env.VITE_STATIC_PROTOTYPE === "1"
  );
}

// ── staticPrototypeSession.ts ───────────────────────────────────────────────
import { hasSessionAuth, storeSessionAuth } from "./session";

/**
 * Call once before rendering so `hasSessionAuth()` and dashboard session checks work.
 */
export function bootstrapStaticPrototypeSession() {
  if (!isStaticPrototype() || typeof window === "undefined") return;
  if (hasSessionAuth()) return;

  storeSessionAuth({
    profileData: { ...STATIC_PROTOTYPE_PROFILE },
  });
}

// ── staticPrototypeProfileData.ts ───────────────────────────────────────────────
/** Profile used for static prototype builds (no `/api/profile`). */
export const STATIC_PROTOTYPE_PROFILE = {
  name: "Prototype Student",
  registerNo: "AP23110010419",
  branch: "CSE",
  year: 3,
  TableContent: {
    "Student Name": "Prototype Student",
    "Register No.": "AP23110010419",
    "D.O.B. / Gender": "01-Jan-2000 / Other",
    "Program / Section": "B.Tech Computer Science / A",
    "Student Contact Number / Email": "9000000000 / prototype@example.edu",
    "Father Name / Mother Name": "Parent One / Parent Two",
    "Semester": "6",
    "Academic Year": "2025-2026",
    "Specialization": "Computer Science and Engineering",
    Email: "prototype@example.edu",
  },
} as const;

// ── erpStaticPrototypeFixtures.ts ───────────────────────────────────────────────


const FIXTURE_URL = "fixtures/erp-batch.json";

type StaticErpNodeType = "container" | "text" | "table" | "form" | "field" | "button";

type StaticErpNode = {
  id: string;
  type: StaticErpNodeType;
  props: Record<string, unknown>;
  children: StaticErpNode[];
};

type StaticErpDocument = {
  title: string;
  root: StaticErpNode;
};

type StaticErpPageResponse = {
  success?: boolean;
  pageKey: string;
  source?: string;
  fetchedAt?: string;
  staleAt?: string | null;
  policyMode?: string;
  warnings?: string[];
  meta?: {
    normalizationRules?: string[];
    issues?: Array<{ sectionKey?: string; tableIndex?: number; message?: string }>;
    targets?: Array<{ dropdown?: string; subitem?: string }>;
  };
  data: unknown;
  document?: StaticErpDocument;
};

type StaticErpPageFailure = {
  success: false;
  pageKey: string;
  error: string;
  status: number;
  code: string;
};

type StaticErpBatchPageResult = StaticErpPageResponse | StaticErpPageFailure;
type StaticErpBatchResponse = Record<string, StaticErpBatchPageResult>;

let cachedFixtures: StaticErpBatchResponse | null = null;
let cacheFailed = false;

function findLegacySection(value: unknown, depth = 0): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value) || depth > 3) return null;
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.tables)) return record;
  for (const child of Object.values(record)) {
    const found = findLegacySection(child, depth + 1);
    if (found) return found;
  }
  return null;
}

function legacyRows(section: Record<string, unknown>, tableIndex = 0) {
  const tables = section.tables;
  if (!Array.isArray(tables) || !Array.isArray(tables[tableIndex])) return [] as Record<string, unknown>[];
  return tables[tableIndex].filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object" && !Array.isArray(row));
}

/**
 * Production APIs provide `_extracted` typed records. The checked-in static
 * snapshot predates that contract, so adapt only the three student-critical
 * record shapes that have dedicated typed screens.
 */
function addStaticExtraction(pageKey: string, result: StaticErpBatchPageResult) {
  if (!isErpPageResponse(result)) return result;
  const section = findLegacySection(result.data);
  if (!section || section._extracted) return result;

  if (pageKey === "academic/time-table") {
    const rows = legacyRows(section);
    const timeRow = rows[1] || {};
    const slotKeys = Object.keys(timeRow).filter((key) => /^\d+$/.test(key));
    const timeSlots = slotKeys.map((key) => String(timeRow[key] || "")).filter(Boolean);
    const schedule = rows
      .filter((row) => /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/i.test(String(row.col1 || "")))
      .map((row) => ({ day: String(row.col1), periods: slotKeys.map((key) => String(row[key] || "")) }));
    section._extracted = { type: "timetable", timeSlots, schedule, subjects: [] };
  }

  if (pageKey === "finance/fee-due-details") {
    const records = legacyRows(section)
      .filter((row) => String(row["Fee Category"] || "").trim())
      .map((row) => ({
        feeCategory: String(row["Fee Category"] || ""),
        feeHead: String(row["Fee Head"] || ""),
        dueAmount: String(row["Due Amount (INR)"] || ""),
        collected: String(row["Collected (INR)"] || ""),
        toBePaid: String(row["To be Paid Amount (INR)"] || ""),
      }));
    section._extracted = { type: "fee-dues", title: String(section.title || "Fee Dues"), records };
  }

  if (pageKey === "academic/attendance-details") {
    const rows = legacyRows(section, 1);
    const records = rows
      .filter((row) => /^[A-Z]{2,}\s*\d+/i.test(String(row["Subject Code"] || "")))
      .map((row) => ({
        subjectCode: String(row["Subject Code"] || ""),
        subjectDescription: String(row["Subject Description"] || ""),
        classesConducted: Number(row.ClassesConducted) || 0,
        present: Number(row["Attendance Entered (Slots)"]) || 0,
        odMlTaken: Number(row["Present % P / (P+A+OD)"]) || 0,
        attendancePercentage: String(row["Attendance %"] || "0"),
        odMlPercentage: String(row.col9 || "0"),
      }));
    section._extracted = { type: "attendance", records };
  }

  if (pageKey === "examination/current-semester-results") {
    const records = legacyRows(section)
      .filter((row) => /^[A-Z]{2,}\s*\d+/i.test(String(row["Subject Code"] || "")))
      .map((row) => ({
        subjectCode: String(row["Subject Code"] || ""),
        subjectName: String(row["Subject Description"] || ""),
        grade: "Pending",
        result: "Final grade not published",
        extras: { semester: "6", credit: "" },
      }));
    section._extracted = {
      type: "current-results",
      title: "Current semester results",
      records,
      semesterSummaries: [],
    };
  }

  if (pageKey === "examination/internal-mark-details") {
    const records = legacyRows(section)
      .filter((row) => /^[A-Z]{2,}\s*\d+/i.test(String(row["Subject Code"] || "")))
      .map((row) => ({
        subjectCode: String(row["Subject Code"] || ""),
        subjectName: String(row["Subject Description"] || ""),
        marksObtained: String(row["Marks Obtained"] || "0"),
        totalMarks: String(row["Max.Marks"] || "50"),
      }));
    section._extracted = { type: "internal-marks", records };
  }

  return result;
}

function fixtureBase(): string {
  const base = import.meta.env.BASE_URL || "/";
  if (base.endsWith("/")) return base;
  return `${base}/`;
}

/** Minimal successful page used when a key has no fixture entry. */
export function minimalStaticErpPageResponse(pageKey: string): StaticErpPageResponse {
  return {
    success: true,
    pageKey,
    source: "static-prototype",
    fetchedAt: new Date().toISOString(),
    data: {
      Overview: {
        text: `No fixture for "${pageKey}". Add this key to public/fixtures/erp-batch.json (see StaticHost/README.md).`,
      },
    },
  };
}

async function loadFixtureFile(): Promise<StaticErpBatchResponse> {
  if (cachedFixtures) return cachedFixtures;
  if (cacheFailed) return {};

  try {
    const res = await fetch(`${fixtureBase()}${FIXTURE_URL}`, { credentials: "same-origin" });
    if (!res.ok) {
      cacheFailed = true;
      return {};
    }
    const body = (await res.json()) as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      cacheFailed = true;
      return {};
    }
    cachedFixtures = body as StaticErpBatchResponse;
    return cachedFixtures;
  } catch {
    cacheFailed = true;
    return {};
  }
}

function isErpPageResponse(value: unknown): value is StaticErpPageResponse {
  if (!value || typeof value !== "object") return false;
  const v = value as StaticErpPageResponse;
  return typeof v.pageKey === "string" && "data" in v;
}

function isErpPageFailure(value: unknown): value is StaticErpPageFailure {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return v.success === false && typeof v.pageKey === "string" && typeof v.error === "string";
}

/**
 * Merge batch fixture JSON with fallbacks for missing keys.
 */
export async function resolveStaticErpBatch(pageKeys: string[]): Promise<StaticErpBatchResponse> {
  if (!isStaticPrototype()) return {};

  const fromFile = await loadFixtureFile();
  const out: StaticErpBatchResponse = {};

  for (const key of pageKeys) {
    const raw = fromFile[key];
    if (isErpPageFailure(raw) || isErpPageResponse(raw)) {
      out[key] = addStaticExtraction(key, raw as StaticErpBatchPageResult);
    } else {
      out[key] = minimalStaticErpPageResponse(key);
    }
  }

  return out;
}

export async function loadStaticErpSupplementalJson<T extends Record<string, unknown>>(
  fileName: string
): Promise<T | null> {
  if (!isStaticPrototype()) return null;
  try {
    const res = await fetch(`${fixtureBase()}fixtures/${fileName}`, { credentials: "same-origin" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

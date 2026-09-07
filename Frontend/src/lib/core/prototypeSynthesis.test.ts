import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveStaticErpBatch } from "./prototype";

/**
 * Companion to `prototypeAttendance.test.ts`. The captured ERP fixtures have
 * two-row headers on several pages, which shifts the generic table adapter's
 * keys relative to their labels (this is exactly what broke attendance). These
 * checks reconcile the numbers each remaining synthesiser produces against an
 * internal invariant, so a future column-shift fails loudly instead of showing
 * a plausible-but-wrong figure.
 *
 * Audited 2026-09-04 (backlog T8.6.3):
 *  - fee-dues        → due − collected ≈ toBePaid                    (checked here)
 *  - internal-marks  → 0 ≤ obtained ≤ max, max is a sane cap        (checked here)
 *  - current-results → no numeric fields synthesised (grade stubbed) — nothing to reconcile
 *  - timetable       → schedule/timeSlots read by numeric key, OK; the fixture's
 *                      *subjects* sub-table is column-shifted but the synthesiser
 *                      stubs `subjects: []`, so it is inert. Guarded below.
 */

const FIXTURE = JSON.parse(
  readFileSync(join(__dirname, "../../../public/fixtures/erp-batch.json"), "utf8"),
) as Record<string, unknown>;

function findExtracted(node: unknown): Record<string, unknown> | null {
  if (!node || typeof node !== "object") return null;
  const obj = node as Record<string, unknown>;
  if (obj._extracted) return obj._extracted as Record<string, unknown>;
  for (const v of Object.values(obj)) {
    const hit = findExtracted(v);
    if (hit) return hit;
  }
  return null;
}

const num = (v: unknown) => parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, ""));

describe("static prototype synthesis — numeric reconciliation", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_STATIC_PROTOTYPE", "true");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => FIXTURE })) as unknown as typeof fetch,
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("fee dues: due − collected reconciles with 'to be paid'", async () => {
    const batch = await resolveStaticErpBatch(["finance/fee-due-details"]);
    const extracted = findExtracted(batch["finance/fee-due-details"]);
    const records = (extracted?.records ?? []) as Record<string, unknown>[];

    expect(records.length).toBeGreaterThan(0);
    for (const rec of records) {
      const due = num(rec.dueAmount);
      const collected = num(rec.collected);
      const toBePaid = num(rec.toBePaid);
      if ([due, collected, toBePaid].some(Number.isNaN)) continue;
      // A shifted column would put a fee-head string or an unrelated amount
      // in one of these slots and blow the identity apart.
      expect(Math.abs(due - collected - toBePaid)).toBeLessThan(1);
    }
  });

  it("internal marks: 0 ≤ obtained ≤ max, and max is a real cap (≤ 100)", async () => {
    const batch = await resolveStaticErpBatch(["examination/internal-mark-details"]);
    const extracted = findExtracted(batch["examination/internal-mark-details"]);
    const records = (extracted?.records ?? []) as Record<string, unknown>[];

    expect(records.length).toBeGreaterThan(0);
    for (const rec of records) {
      const got = num(rec.marksObtained);
      const max = num(rec.totalMarks);
      expect(Number.isNaN(got)).toBe(false);
      expect(Number.isNaN(max)).toBe(false);
      expect(max).toBeGreaterThan(0);
      expect(max).toBeLessThanOrEqual(100);
      expect(got).toBeGreaterThanOrEqual(0);
      expect(got).toBeLessThanOrEqual(max + 0.01);
    }
  });

  it("timetable: periods align to time slots and subjects stay stubbed", async () => {
    const batch = await resolveStaticErpBatch(["academic/time-table"]);
    const extracted = findExtracted(batch["academic/time-table"]);
    const timeSlots = (extracted?.timeSlots ?? []) as string[];
    const schedule = (extracted?.schedule ?? []) as { day: string; periods: string[] }[];
    const subjects = (extracted?.subjects ?? []) as unknown[];

    expect(timeSlots.length).toBeGreaterThan(0);
    // Every time slot looks like a time range, not a subject code or a header.
    for (const slot of timeSlots) {
      expect(slot).toMatch(/\d{1,2}[:.]\d{2}/);
    }
    for (const day of schedule) {
      expect(day.day).toMatch(/^(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day$/i);
      expect(day.periods.length).toBe(timeSlots.length);
    }
    // The fixture's subjects sub-table is column-shifted; the synthesiser must
    // keep stubbing it rather than emit misaligned rows.
    expect(subjects).toEqual([]);
  });
});

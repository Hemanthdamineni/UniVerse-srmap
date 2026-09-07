import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveStaticErpBatch } from "./prototype";

/**
 * The static prototype synthesises the typed `_extracted` payload that
 * production APIs return. Its attendance mapping once had the attendance
 * percentage and the OD/ML approved percentage swapped, so a student sitting at
 * 85% was shown 10%. This guards the arithmetic of whatever the checked-in
 * fixture yields: (present + OD/ML) / conducted must land near the headline
 * percentage. A swapped column is off by tens of points.
 */

const FIXTURE = JSON.parse(
  readFileSync(join(__dirname, "../../../public/fixtures/erp-batch.json"), "utf8"),
) as Record<string, unknown>;

function findExtracted(node: unknown): { records?: Record<string, unknown>[] } | null {
  if (!node || typeof node !== "object") return null;
  const obj = node as Record<string, unknown>;
  if (obj._extracted) return obj._extracted as { records?: Record<string, unknown>[] };
  for (const v of Object.values(obj)) {
    const hit = findExtracted(v);
    if (hit) return hit;
  }
  return null;
}

describe("static prototype attendance synthesis", () => {
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

  it("produces attendance percentages that reconcile with the raw counts", async () => {
    const batch = await resolveStaticErpBatch(["academic/attendance-details"]);
    const extracted = findExtracted(batch["academic/attendance-details"]);
    const records = extracted?.records ?? [];

    expect(records.length).toBeGreaterThan(0);

    for (const rec of records) {
      const conducted = Number(rec.classesConducted);
      if (!conducted) continue;
      const present = Number(rec.present);
      const odMl = Number(rec.odMlTaken);
      const pct = parseFloat(String(rec.attendancePercentage));
      const expected = ((present + odMl) / conducted) * 100;
      expect(Math.abs(pct - expected)).toBeLessThan(1.5);
    }
  });
});

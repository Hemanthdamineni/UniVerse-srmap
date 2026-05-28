import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { PAGE_BLUEPRINTS, type PageBlueprint } from "../config/erpBlueprints";
import { buildCombinedDocumentForKeys } from "./erpDocumentUtils";
import { executePipeline } from "./erpTransformers";
import type { ErpBatchResponse, ErpPageResponse } from "./erpApi";

type BundlePolicy =
  | "batch-transformer"
  | "document-combiner"
  | "page-merges-all"
  | "page-handles-each-key"
  | "intentional-primary-key";

const BUNDLE_POLICIES: Record<string, BundlePolicy> = {
  "/academic/attendance-details": "batch-transformer",
  "/academic/sap-scholarships": "page-merges-all",
  "/exams/current-semester-results": "batch-transformer",
  "/exams/earlier-semester-results": "page-handles-each-key",
  "/finance/fee-paid": "page-merges-all",
  "/transport-hostel/faqs": "page-merges-all",
  "/transport-hostel/refund-change-requests": "page-merges-all",
  "/registration/course-registration": "document-combiner",
  "/registration/exam-registration": "document-combiner",
  "/registration/transport-registration": "document-combiner",
  "/profile": "intentional-primary-key",
};

const fixturePath = path.resolve(process.cwd(), "public/fixtures/erp-batch.json");
const fixtureBatch = JSON.parse(fs.readFileSync(fixturePath, "utf8")) as ErpBatchResponse;

function successfulResponse(pageKey: string): ErpPageResponse {
  const response = fixtureBatch[pageKey];
  if (!response || ("success" in response && response.success === false)) {
    throw new Error(`Missing successful fixture for ${pageKey}`);
  }
  return response as ErpPageResponse;
}

function fixtureSubset(fetchKeys: string[]) {
  return Object.fromEntries(fetchKeys.map((key) => [key, successfulResponse(key)])) as Record<string, ErpPageResponse>;
}

function dataSubset(fetchKeys: string[]) {
  return Object.fromEntries(fetchKeys.map((key) => [key, successfulResponse(key).data]));
}

function nativeBundledBlueprints() {
  return Object.values(PAGE_BLUEPRINTS).filter(
    (blueprint): blueprint is PageBlueprint =>
      blueprint.integrationState === "native" &&
      blueprint.sourceMode === "erp" &&
      blueprint.fetchKeys.length > 1
  );
}

describe("ERP bundled page coverage", () => {
  it("requires every multi-fetch native ERP blueprint to declare a bundle handling strategy", () => {
    const uncovered = nativeBundledBlueprints()
      .filter((blueprint) => !BUNDLE_POLICIES[blueprint.route])
      .map((blueprint) => `${blueprint.route}: ${blueprint.fetchKeys.join(", ")}`);

    expect(uncovered).toEqual([]);
  });

  it("requires bundle policies to point at an existing multi-fetch blueprint", () => {
    const stalePolicies = Object.keys(BUNDLE_POLICIES).filter((route) => {
      const blueprint = PAGE_BLUEPRINTS[route];
      return !blueprint || blueprint.integrationState !== "native" || blueprint.fetchKeys.length <= 1;
    });

    expect(stalePolicies).toEqual([]);
  });

  it("keeps Attendance Details, OD/ML Details, and Student Attendance visible from the bundled fixture", () => {
    const blueprint = PAGE_BLUEPRINTS["/academic/attendance-details"];
    const batch = fixtureSubset(blueprint.fetchKeys);
    const result = executePipeline(blueprint, batch);
    const data = result.data as any;

    expect(result.isValid).toBe(true);
    expect(data.records.length).toBeGreaterThan(0);
    expect(data.odMlTables?.flatMap((table: any) => table.rows).length).toBeGreaterThan(0);

    const studentAttendanceDocument = buildCombinedDocumentForKeys(
      ["academic/student-attendance"],
      { "academic/student-attendance": successfulResponse("academic/student-attendance") },
      "Student Attendance"
    );
    const documentText = JSON.stringify(studentAttendanceDocument);
    expect(documentText).toContain("Attendance Code");
    expect(documentText).toContain("Submit");
  });

  it("keeps Current Semester Results and Internal Mark Details from the bundled fixture", () => {
    const blueprint = PAGE_BLUEPRINTS["/exams/current-semester-results"];
    const batch = fixtureSubset(blueprint.fetchKeys);
    const result = executePipeline("results-current", batch);
    const data = result.data as any;

    expect(result.isValid).toBe(true);
    expect(data.subjects.length).toBeGreaterThan(0);
    expect(data.internalMarks?.subjects.length).toBeGreaterThan(0);
    expect(
      data.internalMarks.subjects.some((subject: any) => (subject.assessments || []).length > 0)
    ).toBe(true);
  });

  it("keeps all Fees Paid companion payloads available to the finance transformer", () => {
    const blueprint = PAGE_BLUEPRINTS["/finance/fee-paid"];
    const mergedPayload = dataSubset(blueprint.fetchKeys);
    const firstOnlyPayload = successfulResponse(blueprint.fetchKeys[0]).data;
    const mergedResult = executePipeline("finance-paid", mergedPayload);
    const firstOnlyResult = executePipeline("finance-paid", firstOnlyPayload);

    expect(mergedResult.isValid).toBe(true);
    expect((mergedResult.data as any).records.length).toBeGreaterThanOrEqual(
      (firstOnlyResult.data as any)?.records?.length || 0
    );
    expect(JSON.stringify(mergedResult.data)).toContain("571438");
  });

  it("combines document-rendered bundles instead of dropping secondary ERP documents", () => {
    const documentBlueprints = nativeBundledBlueprints().filter(
      (blueprint) => BUNDLE_POLICIES[blueprint.route] === "document-combiner"
    );

    for (const blueprint of documentBlueprints) {
      const availableKeys = blueprint.fetchKeys.filter((key) => fixtureBatch[key]);
      if (availableKeys.length === 0) continue;

      const document = buildCombinedDocumentForKeys(
        availableKeys,
        fixtureSubset(availableKeys),
        blueprint.heading
      );

      expect(document, blueprint.route).not.toBeNull();
    }
  });

  it("keeps registration status-only documents visible in combined document pages", () => {
    const minorBlueprint = PAGE_BLUEPRINTS["/registration/minor-oe-registration"];
    const minorDocument = buildCombinedDocumentForKeys(
      minorBlueprint.fetchKeys,
      fixtureSubset(minorBlueprint.fetchKeys),
      minorBlueprint.heading
    );
    expect(JSON.stringify(minorDocument)).toContain("Minor Course registration is not applicable to you");

    const sapBlueprint = PAGE_BLUEPRINTS["/registration/sap-registration"];
    const sapDocument = buildCombinedDocumentForKeys(
      sapBlueprint.fetchKeys,
      fixtureSubset(sapBlueprint.fetchKeys),
      sapBlueprint.heading
    );
    const sapText = JSON.stringify(sapDocument);
    expect(sapText).toContain("SAP Process");
    expect(sapText).toContain("Students will be allowed to register one time");
    expect(sapText).not.toContain("SAP Details");
    expect(sapText).not.toContain("SAP Attachments");
    expect(sapText).not.toContain("SAP Feedback");
  });
});

import { describe, expect, it } from "vitest";
import { executePipeline } from "./erpTransformers";

// ---------------------------------------------------------------------------
// Helper: wrap typed _extracted into the envelope shape the transformers read.
// ---------------------------------------------------------------------------
function withExtracted(extracted: Record<string, unknown>): unknown {
  return { _extracted: extracted };
}

function withBundledExtracted(
  pageMap: Record<string, Record<string, unknown>>
): unknown {
  return Object.fromEntries(
    Object.entries(pageMap).map(([key, ext]) => [
      key,
      { _extracted: ext },
    ])
  );
}

describe("erpTransformers", () => {
  // -------------------------------------------------------------------------
  // FAIL-LOUD CONTRACT
  // The pipeline catches errors and returns { isValid: false, errors: [...] }.
  // These tests verify the error message contains the expected sentinel.
  // -------------------------------------------------------------------------

  it("emits MISSING_EXTRACTED_PAYLOAD when _extracted is absent from internal-marks payload", () => {
    const result = executePipeline("internal-marks", {
      Examination: {
        "Internal Mark Details": {
          tables: [[{ "Course Code": "CSE 304" }]],
        },
      },
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.join(" ")).toContain("MISSING_EXTRACTED_PAYLOAD");
  });

  it("emits UNEXPECTED_PAYLOAD_TYPE when internal-marks payload has wrong type", () => {
    const result = executePipeline(
      "internal-marks",
      withExtracted({ type: "generic-table", tables: [] })
    );

    expect(result.isValid).toBe(false);
    expect(result.errors.join(" ")).toContain("UNEXPECTED_PAYLOAD_TYPE");
  });

  it("transforms internal-marks payload from _extracted correctly", () => {
    const result = executePipeline(
      "internal-marks",
      withExtracted({
        type: "internal-marks",
        title: "Internal Mark Details",
        records: [
          {
            subjectCode: "CSE 304",
            subjectName: "Operating Systems",
            marksObtained: 42,
            totalMarks: 50,
          },
        ],
      })
    );

    expect(result.isValid).toBe(true);
    expect((result.data as any)?.subjects).toEqual([
      expect.objectContaining({
        code: "CSE 304",
        description: "Operating Systems",
        marksObtained: 42,
        maxMarks: 50,
      }),
    ]);
  });

  it("emits MISSING_EXTRACTED_PAYLOAD when results-current payload lacks _extracted", () => {
    const result = executePipeline("results-current", {
      "examination/current-semester-results": {
        data: {
          Examination: {
            "Current Semester Results": {
              tables: [[{ Semester: "6", "Subject Code": "CSE 304" }]],
            },
          },
        },
      },
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.join(" ")).toContain("MISSING_EXTRACTED_PAYLOAD");
  });

  it("transforms results-current from _extracted correctly (with bundled internal marks)", () => {
    const result = executePipeline(
      "results-current",
      withBundledExtracted({
        "examination/current-semester-results": {
          type: "current-results",
          title: "Current Semester Results",
          records: [
            {
              subjectCode: "CSE 304",
              subjectName: "Operating Systems",
              grade: "A",
              result: "PASS",
              extras: { semester: "6", credit: "3" },
            },
          ],
          semesterSummaries: [{ label: "SGPA", value: "8.5" }],
        },
        "examination/internal-mark-details": {
          type: "internal-marks",
          title: "Internal Marks",
          records: [
            {
              subjectCode: "CSE 304",
              subjectName: "Operating Systems",
              marksObtained: 42,
              totalMarks: 50,
            },
          ],
        },
      })
    );

    expect(result.isValid).toBe(true);
    expect((result.data as any)?.subjects).toHaveLength(1);
    expect((result.data as any)?.subjects[0]).toMatchObject({
      subjectCode: "CSE 304",
    });
    expect((result.data as any)?.internalMarks?.subjects).toEqual([
      expect.objectContaining({
        code: "CSE 304",
        marksObtained: 42,
        maxMarks: 50,
      }),
    ]);
  });

  it("emits MISSING_EXTRACTED_PAYLOAD when attendance payload lacks _extracted", () => {
    const result = executePipeline("attendance", {
      "academic/attendance-details": {
        data: {
          Academic: {
            "Attendance Details": {
              tables: [[{ "Subject Code": "CSE 304" }]],
            },
          },
        },
      },
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.join(" ")).toContain("MISSING_EXTRACTED_PAYLOAD");
  });

  it("transforms attendance from _extracted correctly (with OD/ML details)", () => {
    const result = executePipeline(
      "attendance",
      withBundledExtracted({
        "academic/attendance-details": {
          type: "attendance",
          title: "Attendance Details",
          records: [
            {
              subjectCode: "CSE 304",
              subjectDescription: "Operating Systems",
              classesConducted: "20",
              present: "17",
              odMlTaken: "1",
              presentPercentage: "85",
              odMlPercentage: "5",
              attendancePercentage: "90",
            },
          ],
        },
        "academic/od-ml-details": {
          type: "od-ml-details",
          title: "OD/ML Details",
          records: [
            {
              fromDate: "12-May-2026",
              toDate: "12-May-2026",
              activityType: "Sports",
              days: "1",
              description: "Inter-college Sports Meet",
            },
          ],
        },
      })
    );

    expect(result.isValid).toBe(true);
    expect((result.data as any)?.records).toHaveLength(1);
    expect((result.data as any)?.odMlTables?.[0]?.rows).toEqual([
      expect.objectContaining({
        "From Date": "12-May-2026",
        "Activity Type": "Sports",
      }),
    ]);
  });

  // -------------------------------------------------------------------------
  // FINANCE-PAID TESTS
  // -------------------------------------------------------------------------

  it("emits UNEXPECTED_PAYLOAD_TYPE when fee-paid source has wrong type", () => {
    const result = executePipeline(
      "finance-paid",
      withBundledExtracted({
        "finance/fee-paid-details": {
          type: "generic-table", // Wrong! Should be "fee-paid"
          tables: [],
        },
      })
    );

    expect(result.isValid).toBe(false);
    expect(result.errors.join(" ")).toContain("UNEXPECTED_PAYLOAD_TYPE");
  });

  it("transforms fee-paid from _extracted correctly across all sources", () => {
    const result = executePipeline(
      "finance-paid",
      withBundledExtracted({
        "finance/fee-paid-details": {
          type: "fee-paid",
          title: "Fee Paid Details",
          columns: [
            "term", "feeType", "dueDate", "dueAmount",
            "receiptDate", "mode", "receiptNumber", "paidAmount", "balance",
          ],
          records: [
            {
              term: "2024-25",
              feeType: "Tuition Fee",
              dueDate: "01-Jun-2024",
              dueAmount: "50000",
              receiptDate: "10-May-2024",
              mode: "Online",
              receiptNumber: "7788",
              paidAmount: "50000",
              balance: "0",
            },
          ],
          refundRecords: [],
        },
        "finance/payment-acknowledgment": {
          type: "payment-acknowledgment",
          title: "Payment Acknowledgment",
          records: [
            {
              slNo: "1",
              receiptDate: "10-May-2024",
              receiptNo: "8899",
              particulars: "Tuition Fee",
              amount: "50000",
            },
          ],
        },
      })
    );

    const data = result.data as any;
    expect(result.isValid).toBe(true);
    expect(data.sections).toHaveLength(2);

    const fpdSection = data.sections.find((s: any) => s.sourceLabel === "Fee Paid Details");
    expect(fpdSection).toBeDefined();
    expect(fpdSection.rows).toHaveLength(1);
    expect(fpdSection.rows[0].cells).toMatchObject({
      receiptNumber: "7788",
      paidAmount: "50000",
    });
    // Numeric receipt number → should have print IDs
    expect(fpdSection.rows[0].printReceiptId).toBe("7788");

    const ackSection = data.sections.find((s: any) => s.sourceLabel === "Payment Acknowledgment");
    expect(ackSection).toBeDefined();
    expect(ackSection.rows).toHaveLength(1);
    expect(ackSection.rows[0].cells).toMatchObject({
      receiptNo: "8899",
      particulars: "Tuition Fee",
    });
  });

  it("marks missing source as absent (not failed) when page not in batch", () => {
    const result = executePipeline(
      "finance-paid",
      withBundledExtracted({
        "finance/fee-paid-details": {
          type: "fee-paid",
          title: "Fee Paid Details",
          columns: [
            "term", "feeType", "dueDate", "dueAmount",
            "receiptDate", "mode", "receiptNumber", "paidAmount", "balance",
          ],
          records: [
            {
              term: "2024-25",
              feeType: "Tuition Fee",
              dueDate: "01-Jun-2024",
              dueAmount: "50000",
              receiptDate: "10-May-2024",
              mode: "Online",
              receiptNumber: "9900",
              paidAmount: "50000",
              balance: "0",
            },
          ],
          refundRecords: [],
        },
        // payment-acknowledgment and online-payment-verification not present
      })
    );

    const data = result.data as any;
    expect(result.isValid).toBe(true);
    expect(data.sections).toHaveLength(1);

    const missing = data.sources.find((s: any) => s.sourceLabel === "Payment Acknowledgment");
    expect(missing?.status).toBe("missing");
  });

  it("keeps typical three-source fee-paid transform under 150ms", () => {
    const makeRecords = (prefix: string, count: number) =>
      Array.from({ length: count }, (_, i) => ({
        term: "2024-25",
        feeType: i % 2 === 0 ? "Tuition Fee" : "Hostel Fee",
        dueDate: "01-Jun-2024",
        dueAmount: String(1000 + i),
        receiptDate: "10-May-2024",
        mode: "Online",
        receiptNumber: `${prefix}-${String(i + 1).padStart(4, "0")}`,
        paidAmount: String(1000 + i),
        balance: "0",
      }));

    const makeAckRecords = (prefix: string, count: number) =>
      Array.from({ length: count }, (_, i) => ({
        slNo: String(i + 1),
        receiptDate: "10-May-2024",
        receiptNo: `${prefix}-${String(i + 1).padStart(4, "0")}`,
        particulars: "Tuition Fee",
        amount: String(1000 + i),
      }));

    const makeGenericRows = (prefix: string, count: number) =>
      Array.from({ length: count }, (_, i) => ({
        "Reference No.": `${prefix}-${String(i + 1).padStart(4, "0")}`,
        "Transaction Date": "10-May-2024",
        Mode: "Online",
        "Transaction Amount": String(1000 + i),
      }));

    const payload = withBundledExtracted({
      "finance/fee-paid-details": {
        type: "fee-paid",
        title: "Fee Paid Details",
        columns: [
          "term", "feeType", "dueDate", "dueAmount",
          "receiptDate", "mode", "receiptNumber", "paidAmount", "balance",
        ],
        records: makeRecords("FPD", 60),
        refundRecords: [],
      },
      "finance/payment-acknowledgment": {
        type: "payment-acknowledgment",
        title: "Payment Acknowledgment",
        records: makeAckRecords("ACK", 60),
      },
      "finance/online-payment-verification": {
        type: "generic-table",
        title: "Online Payment Verification",
        tables: [
          {
            columns: ["Reference No.", "Transaction Date", "Mode", "Transaction Amount"],
            rows: makeGenericRows("OPV", 60),
          },
        ],
      },
    });

    const startedAt = performance.now();
    const result = executePipeline("finance-paid", payload);
    const durationMs = performance.now() - startedAt;

    const data = result.data as any;
    expect(result.isValid).toBe(true);
    expect(data.sections).toHaveLength(3);
    expect(data.sections[0].rows).toHaveLength(60);
    expect(data.sections[1].rows).toHaveLength(60);
    expect(data.sections[2].rows).toHaveLength(60);
    expect(durationMs).toBeLessThan(150);
  });
});

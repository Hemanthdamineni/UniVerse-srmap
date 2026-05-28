import { describe, expect, it } from "vitest";
import { executePipeline } from "./erpTransformers";

describe("erpTransformers", () => {
  it("keeps internal mark rows when ERP uses alternate converted/max mark headers", () => {
    const result = executePipeline("internal-marks", {
      Examination: {
        "Internal Mark Details": {
          tables: [
            [
              {
                "Course Code": "CSE 304",
                "Course Name": "Operating Systems",
                "Mark Secured(Converted)": "42",
                "Maximum Marks": "50",
              },
              {
                Name: "Mid Semester Exam I",
                "Mark Secured(Conducted)": "16.00 / 25",
                "Mark Secured(Converted)": "9.60 / 15",
              },
            ],
          ],
        },
      },
    });

    expect(result.isValid).toBe(true);
    expect((result.data as any)?.subjects).toEqual([
      expect.objectContaining({
        code: "CSE 304",
        description: "Operating Systems",
        marksObtained: 42,
        maxMarks: 50,
        assessments: [
          {
            name: "Mid Semester Exam I",
            conducted: "16.00 / 25",
            converted: "9.60 / 15",
          },
        ],
      }),
    ]);
  });

  it("keeps current result internal marks from a bundled ERP batch", () => {
    const result = executePipeline("results-current", {
      "examination/current-semester-results": {
        data: {
          Examination: {
            "Current Semester Results": {
              tables: [
                [
                  {
                    Semester: "6",
                    "Subject Code": "CSE 304",
                    "Subject Description": "Operating Systems",
                    Credit: "3",
                    Grade: "A",
                    Result: "Pass",
                  },
                ],
              ],
            },
          },
        },
      },
      "examination/internal-mark-details": {
        data: {
          Examination: {
            "Internal Mark Details": {
              tables: [
                [
                  {
                    "Subject Code": "CSE 304",
                    "Subject Description": "Operating Systems",
                    "Marks Obtained": "42",
                    "Max.Marks": "50",
                  },
                ],
              ],
            },
          },
        },
      },
    });

    expect(result.isValid).toBe(true);
    expect((result.data as any)?.subjects).toHaveLength(1);
    expect((result.data as any)?.internalMarks?.subjects).toEqual([
      expect.objectContaining({
        code: "CSE 304",
        marksObtained: 42,
        maxMarks: 50,
      }),
    ]);
  });

  it("keeps OD/ML tables from a bundled attendance batch", () => {
    const result = executePipeline("attendance", {
      "academic/attendance-details": {
        data: {
          Academic: {
            "Attendance Details": {
              tables: [
                [
                  { "Subject Code": "Subject Code" },
                  {
                    "Subject Code": "CSE 304",
                    "Subject Description": "Operating Systems",
                    "Classes Conducted": "20",
                    "Attendance Entered (Slots)": "20",
                    "OD/ML Taken": "1",
                    "Present(P)": "17",
                    "OD ML % approved": "5",
                    "Attendance %": "90",
                  },
                  { "Subject Code": "Attendance data is provisional" },
                ],
              ],
            },
          },
        },
      },
      "academic/od-ml-details": {
        data: {
          Academic: {
            "OD/ML Details": {
              tables: [
                [
                  {
                    Date: "12-May-2026",
                    "Subject Code": "CSE 304",
                    Status: "Approved",
                  },
                ],
              ],
            },
          },
        },
      },
    });

    expect(result.isValid).toBe(true);
    expect((result.data as any)?.records).toHaveLength(1);
    expect((result.data as any)?.odMlTables?.[0]?.rows).toEqual([
      expect.objectContaining({
        Date: "12-May-2026",
        Status: "Approved",
      }),
    ]);
  });

  it("keeps fee paid rows from all fetched finance payloads with alternate receipt headers", () => {
    const result = executePipeline("finance-paid", {
      "finance/payment-acknowledgment": {
        title: "Payment Acknowledgment",
        tables: [
          [
            {
              "Transaction No.": "TXN-123",
              "Paid Amount": "12,500.00",
              "Payment Date": "10-May-2026",
              "Fee Type": "Tuition Fee",
            },
          ],
        ],
      },
      "finance/online-payment-verification": {
        title: "Online Payment Verification",
        tables: [
          [
            {
              "Reference No.": "REF-456",
              "Transaction Amount": "1,000",
              "Transaction Date": "11-May-2026",
              Mode: "Online",
            },
          ],
        ],
      },
    });

    const data = result.data as any;
    expect(result.isValid).toBe(true);

    expect(data.sections).toHaveLength(2);

    expect(data.sections[0].sourceLabel).toBe("Payment Acknowledgment");
    expect(data.sections[0].rows).toHaveLength(1);
    expect(data.sections[0].rows[0].cells).toMatchObject({
      "Transaction No.": "TXN-123",
      "Paid Amount": "12,500.00",
      "Payment Date": "10-May-2026",
      "Fee Type": "Tuition Fee",
    });

    expect(data.sections[1].sourceLabel).toBe("Online Payment Verification");
    expect(data.sections[1].rows).toHaveLength(1);
    expect(data.sections[1].rows[0].cells).toMatchObject({
      "Reference No.": "REF-456",
      "Transaction Amount": "1,000",
      "Transaction Date": "11-May-2026",
      Mode: "Online",
    });

    expect(data.sections[0].columns.map((c: any) => c.label)).toEqual([
      "Transaction No.", "Paid Amount", "Payment Date", "Fee Type",
    ]);
    expect(data.sections[1].columns.map((c: any) => c.label)).toEqual([
      "Reference No.", "Transaction Amount", "Transaction Date", "Mode",
    ]);
  });

  it("keeps fee-paid rows grouped per source section instead of cross-source merging", () => {
    const result = executePipeline("finance-paid", {
      "finance/fee-paid-details": {
        success: true,
        pageKey: "finance/fee-paid-details",
        data: {
          Finance: {
            "Fee Paid Details": {
              tables: [
                [
                  {
                    "Sl.No.": "1",
                    "Receipt Date": "10-May-2026",
                    "Receipt No.": "R-100",
                    Particulars: "Tuition Fee",
                    Amount: "500",
                  },
                  {
                    "Sl.No.": "2",
                    "Receipt Date": "11-May-2026",
                    "Receipt No.": "R-200",
                    Particulars: "Hostel Fee",
                    Amount: "700",
                  },
                ],
              ],
            },
          },
        },
      },
      "finance/payment-acknowledgment": {
        success: true,
        pageKey: "finance/payment-acknowledgment",
        data: {
          Finance: {
            "Payment Acknowledgment": {
              tables: [
                [
                  {
                    "Receipt Date": "10-May-2026",
                    "Receipt No.": "R-100",
                    Particulars: "Tuition Fee",
                    Amount: "600",
                    Print: {
                      id: "act-print-r100",
                      props: {
                        action: {
                          target: "/srmapstudentcorner/students/report/receiptgenerationprint.jsp?receiptid=8899",
                        },
                      },
                    },
                  },
                ],
              ],
            },
          },
        },
      },
      "finance/online-payment-verification": {
        success: true,
        pageKey: "finance/online-payment-verification",
        data: {
          Finance: {
            "Online Payment Verification": {
              tables: [
                [
                  {
                    "Reference No.": "REF-300",
                    "Transaction Date": "12-May-2026",
                    Mode: "Online",
                    "Transaction Amount": "100",
                  },
                ],
              ],
            },
          },
        },
      },
    });

    const data = result.data as any;
    expect(result.isValid).toBe(true);

    // Records are kept per-section, not merged across sources
    expect(data.sections).toHaveLength(3);

    // Fee Paid Details section — 2 rows, native columns preserved
    const fpdSection = data.sections.find((s: any) => s.sourceLabel === "Fee Paid Details");
    expect(fpdSection).toBeDefined();
    expect(fpdSection.rows).toHaveLength(2);
    expect(fpdSection.rows[0].cells).toMatchObject({
      "Sl.No.": "1",
      "Receipt Date": "10-May-2026",
      "Receipt No.": "R-100",
      Particulars: "Tuition Fee",
      Amount: "500",
    });
    expect(fpdSection.rows[1].cells).toMatchObject({
      "Sl.No.": "2",
      "Receipt Date": "11-May-2026",
      "Receipt No.": "R-200",
      Particulars: "Hostel Fee",
      Amount: "700",
    });

    // Payment Acknowledgment section — 1 row with print action
    const ackSection = data.sections.find((s: any) => s.sourceLabel === "Payment Acknowledgment");
    expect(ackSection).toBeDefined();
    expect(ackSection.rows).toHaveLength(1);
    expect(ackSection.rows[0].cells).toMatchObject({
      "Receipt Date": "10-May-2026",
      "Receipt No.": "R-100",
      Particulars: "Tuition Fee",
      Amount: "600",
    });
    expect(ackSection.rows[0].printActionId).toBe("act-print-r100");
    expect(ackSection.rows[0].printReceiptId).toBe("8899");

    // Online Payment Verification section — 1 row
    const opvSection = data.sections.find((s: any) => s.sourceLabel === "Online Payment Verification");
    expect(opvSection).toBeDefined();
    expect(opvSection.rows).toHaveLength(1);
    expect(opvSection.rows[0].cells).toMatchObject({
      "Reference No.": "REF-300",
      "Transaction Date": "12-May-2026",
      Mode: "Online",
      "Transaction Amount": "100",
    });

    // All raw rows preserved (no dedup, no filtering)
    expect(data.integrity).toEqual(
      expect.objectContaining({
        rawRowCount: 4,
        extractedRowCount: 4,
        deduplicatedRowCount: 4,
        duplicateCount: 0,
      })
    );
    expect(data.sources.map((source: any) => [source.sourceLabel, source.extractedCount])).toEqual([
      ["Fee Paid Details", 2],
      ["Payment Acknowledgment", 1],
      ["Online Payment Verification", 1],
    ]);
  });

  it("surfaces partial fee-paid source failures while preserving loaded rows", () => {
    const result = executePipeline("finance-paid", {
      "finance/fee-paid-details": {
        success: true,
        pageKey: "finance/fee-paid-details",
        data: {
          Finance: {
            "Fee Paid Details": {
              tables: [
                [
                  {
                    "Receipt Date": "10-May-2026",
                    "Receipt No.": "R-500",
                    Particulars: "Tuition Fee",
                    Amount: "1,500",
                  },
                ],
              ],
            },
          },
        },
      },
      "finance/payment-acknowledgment": {
        success: false,
        pageKey: "finance/payment-acknowledgment",
        error: "ERP upstream timeout",
        status: 504,
        code: "TIMEOUT",
      },
      "finance/online-payment-verification": {
        success: true,
        pageKey: "finance/online-payment-verification",
        data: {
          Finance: {
            "Online Payment Verification": {
              tables: [[]],
            },
          },
        },
      },
    });

    const data = result.data as any;
    expect(result.isValid).toBe(true);
    // Only Fee Paid Details has valid rows
    expect(data.sections).toHaveLength(1);
    expect(data.sections[0].sourceLabel).toBe("Fee Paid Details");
    expect(data.sections[0].rows).toHaveLength(1);
    expect(data.sections[0].rows[0].cells).toMatchObject({
      "Receipt Date": "10-May-2026",
      "Receipt No.": "R-500",
      Particulars: "Tuition Fee",
      Amount: "1,500",
    });
    expect(data.sources.find((source: any) => source.sourceLabel === "Payment Acknowledgment")).toEqual(
      expect.objectContaining({
        status: "failed",
        warnings: ["Payment Acknowledgment failed: ERP upstream timeout"],
      })
    );
    expect(data.warnings.join(" ")).toContain("Online Payment Verification returned zero rows");
  });

  it("keeps typical three-source fee-paid transform under 150ms", () => {
    const makeRows = (prefix: string, count: number) =>
      Array.from({ length: count }, (_, index) => ({
        "Sl.No.": String(index + 1),
        "Receipt Date": `10-May-2026 ${String(index).padStart(2, "0")}:00`,
        "Receipt No.": `${prefix}-${String(index + 1).padStart(4, "0")}`,
        Particulars: index % 2 === 0 ? "Tuition Fee" : "Hostel Fee",
        Amount: String(1000 + index),
      }));

    const payload = {
      "finance/fee-paid-details": {
        success: true,
        pageKey: "finance/fee-paid-details",
        data: {
          Finance: {
            "Fee Paid Details": {
              tables: [makeRows("FPD", 60)],
            },
          },
        },
      },
      "finance/payment-acknowledgment": {
        success: true,
        pageKey: "finance/payment-acknowledgment",
        data: {
          Finance: {
            "Payment Acknowledgment": {
              tables: [makeRows("ACK", 60)],
            },
          },
        },
      },
      "finance/online-payment-verification": {
        success: true,
        pageKey: "finance/online-payment-verification",
        data: {
          Finance: {
            "Online Payment Verification": {
              tables: [makeRows("OPV", 60)],
            },
          },
        },
      },
    };

    const startedAt = performance.now();
    const result = executePipeline("finance-paid", payload);
    const durationMs = performance.now() - startedAt;

    if (process.env.ERP_TRANSFORMER_PERF_LOG === "1") {
      console.info(`finance-paid transform duration: ${durationMs.toFixed(2)}ms for 180 rows`);
    }

    const perfData = result.data as any;
    expect(result.isValid).toBe(true);
    expect(perfData.sections).toHaveLength(3);
    expect(perfData.sections[0].rows).toHaveLength(60);
    expect(perfData.sections[1].rows).toHaveLength(60);
    expect(perfData.sections[2].rows).toHaveLength(60);
    expect(perfData.integrity.rawRowCount).toBe(180);
    expect(durationMs).toBeLessThan(150);
  });
});

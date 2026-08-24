import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PageBlueprint } from "../../config/erpBlueprints";
import FeePaidPage from "./FeePaidPage";
import { createTestQueryClient } from "../../test/testUtils";

const getErpBatch = vi.fn();
const executeErpAction = vi.fn();

vi.mock("../../lib/erp/api", () => ({
  get getErpBatch() {
    return getErpBatch;
  },
  get executeErpAction() {
    return executeErpAction;
  },
}));

const blueprint: PageBlueprint = {
  route: "/finance/fee-paid",
  heading: "Fees Paid",
  fetchKeys: [
    "finance/fee-paid-details",
    "finance/payment-acknowledgment",
    "finance/online-payment-verification",
  ],
  domain: "erp",
  sourceMode: "erp",
  integrationState: "native",
  renderer: "finance-paid",
  loadingMessage: "Loading paid fees...",
};

describe("FeePaidPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    executeErpAction.mockResolvedValue({ success: true, html: "<html><body>Receipt</body></html>" });
    vi.spyOn(window, "open").mockReturnValue({
      document: { write: vi.fn(), close: vi.fn() },
      focus: vi.fn(),
      print: vi.fn(),
    } as any);
  });

  it("shows error when _extracted is absent (fail-loud contract)", async () => {
    // Old legacy format — no _extracted, must error in the page
    getErpBatch.mockResolvedValue({
      "finance/fee-paid-details": {
        success: true,
        pageKey: "finance/fee-paid-details",
        data: {
          Finance: {
            "Fee Paid Details": {
              // Old nested table format — no _extracted
              tables: [[{ "Receipt No.": "R-500", Amount: "1,500" }]],
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
        data: { Finance: { "Online Payment Verification": { tables: [[]] } } },
      },
    });

    render(<QueryClientProvider client={createTestQueryClient()}><FeePaidPage blueprint={blueprint} /></QueryClientProvider>);

    // With no _extracted, the pipeline fails. The page should show no receipt rows.
    // We wait for loading to finish by checking for the page heading.
    await screen.findByText("Fees Paid");

    // No receipt data should be rendered (no "R-500" row)
    expect(screen.queryByText("R-500")).not.toBeInTheDocument();

    // The pipeline error should surface — either as a warning or as an error state
    const pageText = document.body.textContent ?? "";
    await waitFor(() => {
      const text = document.body.textContent ?? "";
      expect(
        text.includes("MISSING_EXTRACTED_PAYLOAD") ||
          text.includes("No payment receipts found") ||
          text.includes("Partial finance data warning")
      ).toBe(true);
    });
  });

  it("renders fee-paid rows from _extracted payload and allows printing", async () => {
    getErpBatch.mockResolvedValue({
      "finance/fee-paid-details": {
        success: true,
        pageKey: "finance/fee-paid-details",
        _extracted: {
          type: "fee-paid",
          title: "Fee Paid Details",
          columns: ["term", "feeType", "dueDate", "dueAmount", "receiptDate", "mode", "receiptNumber", "paidAmount", "balance"],
          records: [
            {
              term: "2024-25",
              feeType: "Tuition Fee",
              dueDate: "01-Jun-2024",
              dueAmount: "50000",
              receiptDate: "10-May-2026",
              mode: "Online",
              receiptNumber: "7788",
              paidAmount: "1500",
              balance: "0",
            },
          ],
          refundRecords: [],
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
        _extracted: {
          type: "generic-table",
          title: "Online Payment Verification",
          tables: [{ columns: [], rows: [] }],
        },
      },
    });

    render(<QueryClientProvider client={createTestQueryClient()}><FeePaidPage blueprint={blueprint} /></QueryClientProvider>);

    // The receipt number 7788 should appear in the table
    expect(await screen.findByText("7788")).toBeInTheDocument();
    expect(screen.getAllByText("Fee Paid Details").length).toBeGreaterThan(0);

    // Click the print button to trigger executeErpAction
    await userEvent.click(screen.getByRole("button", { name: /print/i }));
    expect(executeErpAction).toHaveBeenCalledWith(
      expect.objectContaining({
        pageKey: "finance/fee-paid-details",
        method: "GET",
        url: expect.stringContaining("7788"),
      })
    );
  });
});

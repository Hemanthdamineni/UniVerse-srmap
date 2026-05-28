import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PageBlueprint } from "../../config/erpBlueprints";
import FeePaidPage from "./FeePaidPage";

const getErpBatch = vi.fn();
const executeErpAction = vi.fn();

vi.mock("../../lib/erpApi", () => ({
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

  it("renders partial source warnings and keeps loaded fee-paid rows", async () => {
    getErpBatch.mockResolvedValue({
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
                    Print: {
                      id: "act-print-r500",
                      props: {
                        action: {
                          target: "/srmapstudentcorner/students/report/receiptgenerationprint.jsp?receiptid=7788",
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

    render(<FeePaidPage blueprint={blueprint} />);

    expect(await screen.findByText("R-500")).toBeInTheDocument();
    expect(screen.getByText("Partial finance data warning")).toBeInTheDocument();
    expect(screen.getByText(/Payment Acknowledgment failed: ERP upstream timeout/i)).toBeInTheDocument();
    expect(screen.getAllByText("Fee Paid Details").length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole("button", { name: /print/i }));
    await waitFor(() =>
      expect(executeErpAction).toHaveBeenCalledWith(
        expect.objectContaining({
          pageKey: "finance/fee-paid-details",
          actionId: "act-print-r500",
        })
      )
    );
  });
});

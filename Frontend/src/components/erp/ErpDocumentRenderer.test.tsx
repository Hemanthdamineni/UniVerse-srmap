import fs from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import ErpDocumentRenderer from "./ErpDocumentRenderer";
import { PAGE_BLUEPRINTS } from "../../config/erpBlueprints";
import type { ErpBatchResponse, ErpDocument, ErpPageResponse } from "../../lib/erpApi";
import { buildCombinedDocumentForKeys } from "../../lib/erpDocumentUtils";

const fixturePath = path.resolve(process.cwd(), "public/fixtures/erp-batch.json");
const fixtureBatch = JSON.parse(fs.readFileSync(fixturePath, "utf8")) as ErpBatchResponse;

function successfulResponse(pageKey: string): ErpPageResponse {
  const response = fixtureBatch[pageKey];
  if (!response || ("success" in response && response.success === false)) {
    throw new Error(`Missing successful fixture for ${pageKey}`);
  }
  return response as ErpPageResponse;
}

function fixtureDocumentForRoute(route: string) {
  const blueprint = PAGE_BLUEPRINTS[route];
  if (!blueprint || blueprint.integrationState === "placeholder") {
    throw new Error(`Missing document blueprint for ${route}`);
  }

  const responses = Object.fromEntries(
    blueprint.fetchKeys.map((key) => [key, successfulResponse(key)])
  ) as Record<string, ErpPageResponse>;

  const document = buildCombinedDocumentForKeys(blueprint.fetchKeys, responses, blueprint.heading);
  if (!document) {
    throw new Error(`Fixture document was empty for ${route}`);
  }

  return document;
}

describe("ErpDocumentRenderer", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined,
        clear: () => undefined,
      },
    });
  });

  it("does not render an untitled container as a fallback Section card", () => {
    const document: ErpDocument = {
      title: "SAP Registration",
      root: {
        id: "root",
        type: "container",
        props: {},
        children: [
          {
            id: "note",
            type: "text",
            props: {
              text: "SAP Registration Note: Students will be allowed to register one time.",
            },
            children: [],
          },
        ],
      },
    };

    render(
      <MemoryRouter>
        <ErpDocumentRenderer document={document} />
      </MemoryRouter>
    );

    expect(screen.queryByRole("heading", { name: "Section" })).not.toBeInTheDocument();
    expect(screen.getByText("Note")).toBeInTheDocument();
    expect(screen.getByText(/Students will be allowed to register one time/i)).toBeInTheDocument();
  });

  it("does not render an untitled form as a fallback Section card", () => {
    const document: ErpDocument = {
      title: "SAP Details",
      root: {
        id: "root",
        type: "container",
        props: {},
        children: [
          {
            id: "print-form",
            type: "form",
            props: {
              title: "frmsapregistrationapplicationprint",
            },
            children: [
              {
                id: "sap-status",
                type: "text",
                props: {
                  text: "SAP DETAILS You are not registered with SAP.",
                },
                children: [],
              },
            ],
          },
        ],
      },
    };

    render(
      <MemoryRouter>
        <ErpDocumentRenderer document={document} />
      </MemoryRouter>
    );

    expect(screen.queryByRole("heading", { name: "Section" })).not.toBeInTheDocument();
    expect(screen.getByText(/You are not registered with SAP/i)).toBeInTheDocument();
  });

  it("renders row values whose keys are missing from the declared column list", () => {
    const document: ErpDocument = {
      title: "Fee Paid Details",
      root: {
        id: "root",
        type: "container",
        props: {},
        children: [
          {
            id: "fee-ledger",
            type: "table",
            props: {
              columns: [
                { key: "fixed-advances", label: "Fixed/Advances" },
                { key: "receipts-payments", label: "Receipts/Payments" },
                { key: "due", label: "Due" },
              ],
              rows: [
                {
                  key: "ledger-header",
                  values: {
                    "fixed-advances": "Term",
                    "receipts-payments": "Fee Type",
                    due: "Due Date",
                    col4: "Amount",
                    col5: "Receipt Date",
                  },
                },
                {
                  key: "ledger-row",
                  values: {
                    "fixed-advances": "2025-2026",
                    "receipts-payments": "Exam Fees",
                    due: "06/04/2026",
                    col4: "3100.00",
                    col5: "06/04/2026",
                  },
                },
              ],
            },
            children: [],
          },
        ],
      },
    };

    render(
      <MemoryRouter>
        <ErpDocumentRenderer document={document} />
      </MemoryRouter>
    );

    expect(screen.getByText("Amount")).toBeInTheDocument();
    expect(screen.getByText("Receipt Date")).toBeInTheDocument();
    expect(screen.getByText("3100.00")).toBeInTheDocument();
  });

  it("salvages user-facing status text from ERP implementation dumps", () => {
    const document: ErpDocument = {
      title: "SAP Registration",
      root: {
        id: "root",
        type: "container",
        props: {},
        children: [
          {
            id: "sap-status",
            type: "text",
            props: {
              text: ".alert-danger { color: red; } var url = \"students/registrations/sapregistrationresource.jsp\"; $(function () { $(\".divmsg\").hide(); }); function funWithdraw() { return false; } SAP WITHDRAW You are not registered with SAP.",
            },
            children: [],
          },
        ],
      },
    };

    render(
      <MemoryRouter>
        <ErpDocumentRenderer document={document} />
      </MemoryRouter>
    );

    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText(/You are not registered with SAP/i)).toBeInTheDocument();
  });

  it("does not render low-value titles recovered from ERP code dumps", () => {
    const document: ErpDocument = {
      title: "Exam Registration",
      root: {
        id: "root",
        type: "container",
        props: {},
        children: [
          {
            id: "exam-code",
            type: "text",
            props: {
              text: "thead{ position: sticky; top: 0; } function funPrintApplication() { window.open(url, \"Exam Application\", \"width=950,height=650\"); } Exam Application Details",
            },
            children: [],
          },
        ],
      },
    };

    render(
      <MemoryRouter>
        <ErpDocumentRenderer document={document} />
      </MemoryRouter>
    );

    expect(screen.queryByText("Exam Application Details")).not.toBeInTheDocument();
  });

  it("renders selection tables as a usable selection control", async () => {
    const user = userEvent.setup();
    const document: ErpDocument = {
      title: "Exam Registration",
      root: {
        id: "root",
        type: "container",
        props: {},
        children: [
          {
            id: "exam-select",
            type: "table",
            props: {
              columns: [
                { key: "exam-month-and-year", label: "Exam Month And Year" },
                {
                  key: "select-exam-month-and-year",
                  label: "[Select Exam Month And Year] DECEMBER 2023 MAY 2024 DECEMBER 2024 MAY 2025 DECEMBER 2025 MAY 2026",
                },
              ],
              rows: [
                {
                  key: "month-row",
                  values: {
                    "exam-month-and-year": "Exam Month And Year",
                    "select-exam-month-and-year": "cmbExamMonth",
                  },
                },
                {
                  key: "print-row",
                  values: {
                    "exam-month-and-year": "Print",
                  },
                },
              ],
            },
            children: [],
          },
        ],
      },
    };

    render(
      <MemoryRouter>
        <ErpDocumentRenderer document={document} />
      </MemoryRouter>
    );

    expect(screen.getByText("Selection")).toBeInTheDocument();
    const select = screen.getByRole("combobox", { name: "Exam Month And Year" });
    expect(select).toBeInTheDocument();
    await user.selectOptions(select, "December 2025");
    expect(select).toHaveValue("December 2025");
    expect(screen.getByRole("button", { name: "Print" })).toBeEnabled();
  });

  it("renders recovered checkbox fields as accessible choices", async () => {
    const user = userEvent.setup();
    const document: ErpDocument = {
      title: "SAP Registration",
      root: {
        id: "root",
        type: "container",
        props: {},
        children: [
          {
            id: "sap-form",
            type: "form",
            props: {},
            children: [
              {
                id: "host-usm",
                type: "field",
                props: {
                  inputType: "checkbox",
                  name: "hostUniversity",
                  value: "usm",
                  label: "Universiti Sains Malaysia (USM), Malaysia",
                },
                children: [],
              },
            ],
          },
        ],
      },
    };

    render(
      <MemoryRouter>
        <ErpDocumentRenderer document={document} />
      </MemoryRouter>
    );

    const checkbox = screen.getByRole("checkbox", {
      name: "Universiti Sains Malaysia (USM), Malaysia",
    });
    expect(checkbox).not.toBeChecked();
    await user.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  it("renders scraped SAP process step text as a stepper", () => {
    const document: ErpDocument = {
      title: "SAP Process",
      root: {
        id: "root",
        type: "container",
        props: {},
        children: [
          {
            id: "sap-steps",
            type: "text",
            props: {
              text: "SEMESTER ABROAD PROGRAM (SAP) PROCESS 1 Registration 2 CV 3 Confirmation 4 Completion",
            },
            children: [],
          },
        ],
      },
    };

    const { container } = render(
      <MemoryRouter>
        <ErpDocumentRenderer document={document} />
      </MemoryRouter>
    );

    expect(screen.getByText("Semester Abroad Program (SAP) Process")).toBeInTheDocument();
    expect(screen.getByText("Registration")).toBeInTheDocument();
    expect(screen.getByText("CV")).toBeInTheDocument();
    expect(container.textContent).not.toContain("1 Registration 2 CV 3 Confirmation 4 Completion");
  });

  it("renders SAP registration as the process page without academic companion pages", () => {
    render(
      <MemoryRouter>
        <ErpDocumentRenderer document={fixtureDocumentForRoute("/registration/sap-registration")} />
      </MemoryRouter>
    );

    expect(screen.queryByRole("heading", { name: "SAP Withdraw" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "SAP Details" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "SAP Attachments" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "SAP Feedback" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Section" })).not.toBeInTheDocument();
    expect(screen.getByText(/Students will be allowed to register one time/i)).toBeInTheDocument();
  });

  it("renders minor and exam registration fixture text without hiding status or leaking scripts", () => {
    const { unmount } = render(
      <MemoryRouter>
        <ErpDocumentRenderer document={fixtureDocumentForRoute("/registration/minor-oe-registration")} />
      </MemoryRouter>
    );

    expect(screen.getByText(/Minor Course registration is not applicable to you/i)).toBeInTheDocument();
    unmount();

    const examRender = render(
      <MemoryRouter>
        <ErpDocumentRenderer document={fixtureDocumentForRoute("/registration/exam-registration")} />
      </MemoryRouter>
    );

    expect(screen.getByText("Selection")).toBeInTheDocument();
    expect(screen.getByText("December 2025")).toBeInTheDocument();
    expect(screen.getByText("May 2026")).toBeInTheDocument();
    expect(examRender.container.textContent).not.toMatch(/thead\{|window\.open|superAlert/);
  });

  it("renders course registration fixture completion and cancellation messages", () => {
    render(
      <MemoryRouter>
        <ErpDocumentRenderer document={fixtureDocumentForRoute("/registration/course-registration")} />
      </MemoryRouter>
    );

    expect(screen.getByText(/Registration completed successfully/i)).toBeInTheDocument();
    expect(screen.getByText(/Registration closed/i)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Section" })).not.toBeInTheDocument();
  });

  it("renders hostel and transport registration fixture status messages", () => {
    const { unmount } = render(
      <MemoryRouter>
        <ErpDocumentRenderer document={fixtureDocumentForRoute("/registration/hostel-registration")} />
      </MemoryRouter>
    );

    expect(screen.getByText(/Students will be allowed to register for one facility only/i)).toBeInTheDocument();
    expect(screen.getByText(/hostel\.helpdesk@srmap\.edu\.in/i)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Section" })).not.toBeInTheDocument();
    unmount();

    render(
      <MemoryRouter>
        <ErpDocumentRenderer document={fixtureDocumentForRoute("/registration/transport-registration")} />
      </MemoryRouter>
    );

    expect(screen.getByText(/Transport booking will be open soon/i)).toBeInTheDocument();
    expect(screen.getAllByText(/You are not registered to Transport/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole("heading", { name: "Section" })).not.toBeInTheDocument();
  });
});

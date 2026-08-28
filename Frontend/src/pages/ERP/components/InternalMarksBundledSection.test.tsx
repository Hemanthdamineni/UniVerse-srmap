import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InternalMarksBundledSection } from "./InternalMarksBundledSection";
import type { InternalMarksModel } from "../../../lib/erp/erpTransformers";

const modelWithBreakdown: InternalMarksModel = {
  averagePercentage: 76.2,
  subjects: [
    {
      code: "CSE 304",
      description: "Automata and Compiler Design",
      marksObtained: 38.1,
      maxMarks: 50,
      percentage: 76.2,
      status: "good",
      detailTableIndex: 1,
      assessments: [
        { name: "Mid Semester Exam I", conducted: "16.00 / 25", converted: "9.60 / 15" },
        { name: "CLA 1", conducted: "6.50 / 10", converted: "6.50 / 10" },
      ],
    },
    {
      code: "CSE 306",
      description: "Software Engineering",
      marksObtained: 0,
      maxMarks: 50,
      percentage: 0,
      status: "needs-improvement",
      detailTableIndex: 2,
      assessments: [],
    },
  ],
};

describe("InternalMarksBundledSection", () => {
  it("renders every subject card with marks and percentage on it", () => {
    render(<InternalMarksBundledSection model={modelWithBreakdown} />);

    expect(screen.getByText("CSE 304")).toBeInTheDocument();
    expect(screen.getByText("CSE 306")).toBeInTheDocument();
    expect(screen.getByText("38.10")).toBeInTheDocument();
    expect(screen.getAllByText("/")).toHaveLength(2);
    expect(screen.getByText("76.2%")).toBeInTheDocument();
    expect(screen.getByText("0.0%")).toBeInTheDocument();
    expect(screen.getByText("76.20% average")).toBeInTheDocument();
  });

  it("expands a subject with assessments to show the component breakdown", async () => {
    const user = userEvent.setup();
    render(<InternalMarksBundledSection model={modelWithBreakdown} />);

    expect(screen.queryByText("Assessment")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Expand CSE 304/ }));

    expect(screen.getByRole("table", { name: /CSE 304 internal assessment breakdown/ }))
      .toBeInTheDocument();
    expect(screen.getByText("Mid Semester Exam I")).toBeInTheDocument();
    expect(screen.getByText("16.00 / 25")).toBeInTheDocument();
    expect(screen.getByText("9.60 / 15")).toBeInTheDocument();
    expect(screen.getByText("Total: 38.10 / 50")).toBeInTheDocument();
  });

  it("does not expose an expand affordance for subjects without assessments", () => {
    render(<InternalMarksBundledSection model={modelWithBreakdown} />);

    const expandable = screen.getByRole("button", { name: /Expand CSE 304/ });
    expect(expandable).toHaveAttribute("aria-expanded", "false");

    const staticCard = screen.getByText("CSE 306").closest("button");
    expect(staticCard).not.toHaveAttribute("aria-expanded");
  });

  it("shows the empty state when no subjects are present", () => {
    render(
      <InternalMarksBundledSection
        model={{ averagePercentage: 0, subjects: [] }}
      />
    );

    expect(screen.getByText("No internal mark details found.")).toBeInTheDocument();
  });
});

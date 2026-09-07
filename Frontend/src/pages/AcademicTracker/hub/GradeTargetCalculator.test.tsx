import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { GradeTargetCalculator } from "./GradeTargetCalculator";
import type { InternalMarkSubject, InternalMarksModel } from "../../../lib/erp/types";

function subject(overrides: Partial<InternalMarkSubject>): InternalMarkSubject {
  return {
    code: "CSE304",
    description: "Operating Systems",
    marksObtained: 40,
    maxMarks: 60,
    percentage: 66.7,
    status: "good",
    detailTableIndex: 1,
    assessments: [],
    ...overrides,
  };
}

function model(subjects: InternalMarkSubject[]): InternalMarksModel {
  return { subjects, averagePercentage: 0 };
}

describe("GradeTargetCalculator", () => {
  it("shows a fallback when there are no usable internal marks", () => {
    render(<GradeTargetCalculator internalMarks={null} />);
    expect(screen.getByText(/Live internal marks aren't available/i)).toBeInTheDocument();
  });

  it("states the end-term mark needed for the target grade", () => {
    // internal 40/60 → end-term worth 40. Target A = 71. need 31/40 → 78/100.
    render(<GradeTargetCalculator internalMarks={model([subject({})])} />);
    expect(screen.getByText("Need 78/100 on the CSE304 end-term for A.")).toBeInTheDocument();
    expect(screen.getByText("Internal 40/60")).toBeInTheDocument();
  });

  it("recognises a grade that is already locked in", async () => {
    const user = userEvent.setup();
    // internal 55/60, end-term worth 40. Target P = 45 → need -10 → locked in.
    render(<GradeTargetCalculator internalMarks={model([subject({ marksObtained: 55 })])} />);
    await user.selectOptions(screen.getByLabelText("Target grade"), "P");
    expect(screen.getByText(/Locked in — even 0 on the end-term keeps you at P\./)).toBeInTheDocument();
  });

  it("flags an out-of-reach target", async () => {
    const user = userEvent.setup();
    // internal 20/60, end-term worth 40 → max total 60. Target O = 91 → out of reach.
    render(<GradeTargetCalculator internalMarks={model([subject({ marksObtained: 20 })])} />);
    await user.selectOptions(screen.getByLabelText("Target grade"), "O");
    expect(screen.getByText(/Out of reach — a perfect end-term caps you at 60\/100 \(B\)\./)).toBeInTheDocument();
  });

  it("honours a custom target percentage", async () => {
    const user = userEvent.setup();
    // internal 40/60, end-term 40. custom 80 → need 40/40 → 100/100.
    render(<GradeTargetCalculator internalMarks={model([subject({})])} />);
    await user.type(screen.getByLabelText("Or custom total %"), "80");
    expect(screen.getByText("Need 100/100 on the CSE304 end-term for 80/100.")).toBeInTheDocument();
  });

  it("skips subjects whose marks are already finalized on the 100 scale", () => {
    render(
      <GradeTargetCalculator internalMarks={model([subject({ code: "DONE", maxMarks: 100, marksObtained: 82 })])} />,
    );
    expect(screen.getByText(/Live internal marks aren't available/i)).toBeInTheDocument();
  });
});

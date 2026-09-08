import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BunkAdvicePanel } from "./BunkAdvicePanel";
import type { AttendanceSubject, StudentGraph, TermProgress } from "../../../lib/core/studentGraph";

function graphWith(subjects: AttendanceSubject[], termProgress: TermProgress | null = null): StudentGraph {
  return {
    contractVersion: "student-graph-v1",
    generatedAt: "2026-09-06T00:00:00.000Z",
    userId: "AP1",
    warm: false,
    identity: { name: "T", registerNo: "AP1", program: "", branch: "CSE", semester: 6, section: "", email: "" },
    intent: { status: "none", targetRoles: [], interestAreas: [], skills: [], graduationYear: null, placementIntent: "" },
    consent: { derivedSignals: false, leaderboards: false, publicProfile: false },
    academic: {
      curriculum: null,
      attendance: { asOf: "2026-09-01", overallPct: 80, subjects },
      results: null,
    },
    skills: [],
    activity: { events: { registered: 0, organized: 0 }, lms: { resourcesCompleted: 0, masteryTopics: 0, contributions: 0 }, achievements: 0 },
    derived: { atRiskSubjects: [], borderlineSubjects: [], skillGaps: [], readinessScore: 0, readinessBreakdown: { academic: 0, skills: 0, activity: 0, profile: 0 }, termProgress },
    sources: { identity: "session", curriculum: "unavailable", attendance: "snapshot", results: "unavailable", skills: "unavailable", activity: "unavailable" },
  };
}

describe("BunkAdvicePanel", () => {
  it("renders nothing without an attendance snapshot", () => {
    const { container } = render(<BunkAdvicePanel graph={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("states a concrete skip count for a comfortable subject", () => {
    // 40 conducted, 38 present = 95%. required = ceil(30) = 30. slack = 8.
    const graph = graphWith([
      { code: "CSE101", name: "DSA", conducted: 40, present: 38, pct: 95, status: "safe" },
    ]);
    render(<BunkAdvicePanel graph={graph} />);
    expect(screen.getByText("You can miss 8 more")).toBeInTheDocument();
    expect(screen.getByText("Safe")).toBeInTheDocument();
  });

  it("tells a below-75% student how many to attend to recover", () => {
    // 40 conducted, 27 present = 67.5%. required 30. need 3.
    const graph = graphWith([
      { code: "CSE102", name: "OS", conducted: 40, present: 27, pct: 68, status: "breach" },
    ]);
    render(<BunkAdvicePanel graph={graph} />);
    expect(screen.getByText(/Attend the next 3 to get back to 75%/)).toBeInTheDocument();
  });

  it("flags a subject where 75% is mathematically out of reach", () => {
    // 40 conducted, 10 present = 25%. need 30 attended; assumed remaining ~16.
    const graph = graphWith([
      { code: "MAT101", name: "Maths", conducted: 40, present: 10, pct: 25, status: "breach" },
    ]);
    render(<BunkAdvicePanel graph={graph} />);
    expect(screen.getByText("75% is out of reach this term")).toBeInTheDocument();
    expect(screen.getByText("Detention risk")).toBeInTheDocument();
  });

  it("summarises total slack and count below threshold", () => {
    const graph = graphWith([
      { code: "A", name: "A", conducted: 40, present: 38, pct: 95, status: "safe" },
      { code: "B", name: "B", conducted: 40, present: 27, pct: 68, status: "breach" },
    ]);
    render(<BunkAdvicePanel graph={graph} />);
    expect(screen.getByText(/1 subject is below 75%/)).toBeInTheDocument();
  });

  const halfTerm: TermProgress = {
    inTerm: true,
    label: "Odd semester",
    startAt: "2026-08-03T00:00:00.000Z",
    lastTeachingDay: "2026-11-30T23:59:00.000Z",
    elapsedFraction: 0.5,
    daysRemaining: 56,
    weeksRemaining: 8,
  };

  it("projects to the last teaching day when the academic calendar is available", () => {
    // Half-term, 8 weeks left ⇒ ~8 more weeks ⇒ ~30 more classes at the pace so
    // far (30 conducted over 8 weeks elapsed). 21/30 = 70%; best case
    // (21+30)/(30+30) = 85% — recoverable, so it asks for a real number.
    const graph = graphWith(
      [{ code: "CSE101", name: "DSA", conducted: 30, present: 21, pct: 70, status: "breach" }],
      halfTerm,
    );
    render(<BunkAdvicePanel graph={graph} />);
    expect(screen.getByText(/Attend \d+ of the ~\d+ classes left/)).toBeInTheDocument();
    expect(screen.getByText(/About 8 weeks of teaching left\./)).toBeInTheDocument();
  });

  it("calls 75% unreachable when even a perfect record from here falls short", () => {
    // 30 conducted, 6 present = 20%. ~30 more classes ⇒ best case
    // (6+30)/(30+30) = 60% < 75%.
    const graph = graphWith(
      [{ code: "MAT101", name: "Maths", conducted: 30, present: 6, pct: 20, status: "breach" }],
      halfTerm,
    );
    render(<BunkAdvicePanel graph={graph} />);
    expect(screen.getByText("75% is out of reach this term")).toBeInTheDocument();
    expect(screen.getByText(/even a perfect record from here lands you near \d+%/)).toBeInTheDocument();
  });

  it("does not project before the term is 2 weeks in", () => {
    const graph = graphWith(
      [{ code: "CSE101", name: "DSA", conducted: 4, present: 2, pct: 50, status: "breach" }],
      { ...halfTerm, elapsedFraction: 0.05, weeksRemaining: 15, daysRemaining: 105 },
    );
    render(<BunkAdvicePanel graph={graph} />);
    // Falls back to the heuristic wording, not the calendar projection.
    expect(screen.queryByText(/classes left/)).toBeNull();
  });
});

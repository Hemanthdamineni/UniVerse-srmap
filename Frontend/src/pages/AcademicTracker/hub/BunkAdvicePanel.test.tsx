import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BunkAdvicePanel } from "./BunkAdvicePanel";
import type { AttendanceSubject, StudentGraph } from "../../../lib/core/studentGraph";

function graphWith(subjects: AttendanceSubject[]): StudentGraph {
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
    derived: { atRiskSubjects: [], borderlineSubjects: [], skillGaps: [], readinessScore: 0, readinessBreakdown: { academic: 0, skills: 0, activity: 0, profile: 0 } },
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
});

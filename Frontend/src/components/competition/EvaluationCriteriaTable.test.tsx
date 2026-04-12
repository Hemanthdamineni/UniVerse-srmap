import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EvaluationCriteriaTable } from "./EvaluationCriteriaTable";

describe("EvaluationCriteriaTable", () => {
  const mockCriteria = [
    { label: "Technical", maxScore: 50 },
    { label: "Innovation", maxScore: 30 },
    { label: "Presentation", maxScore: 20 },
  ];

  it("renders all criteria with correct maximums", () => {
    render(<EvaluationCriteriaTable criteria={mockCriteria} readOnly={true} scores={{ "Technical": 45 }} />);
    
    expect(screen.getByText("Technical")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
    expect(screen.getAllByText("45").length).toBeGreaterThan(0);
  });

  it("renders empty state correctly in edit mode when criteria are empty", () => {
    render(<EvaluationCriteriaTable criteria={[]} readOnly={false} />);
    expect(screen.getByText(/No evaluation criteria defined for this round/i)).toBeInTheDocument();
  });

  it("calculates the correct total score", () => {
    const scores = { "Technical": 40, "Innovation": 25, "Presentation": 18 };
    const { container } = render(<EvaluationCriteriaTable criteria={mockCriteria} readOnly={true} scores={scores} />);
    
    // Total should be 83 / 100
    expect(screen.getByText("83")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
  });

  it("fires onChange with numeric value when in edit mode", () => {
    const handleChange = vi.fn();
    render(<EvaluationCriteriaTable criteria={mockCriteria} scores={{}} readOnly={false} onChange={handleChange} />);
    
    const technicalInput = screen.getByLabelText("Technical score");
    fireEvent.change(technicalInput, { target: { value: "35" } });
    
    expect(handleChange).toHaveBeenCalledWith("Technical", 35);
  });
});

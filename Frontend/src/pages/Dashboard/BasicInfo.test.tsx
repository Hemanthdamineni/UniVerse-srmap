import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import BasicInfo from "./BasicInfo";

const mockExecutePipeline = vi.fn();

vi.mock("../../lib/erp/erpTransformers", () => ({
  executePipeline: (...args: unknown[]) => mockExecutePipeline(...args),
}));

const validProfileModel = {
  studentName: "Alice Johnson",
  registerNo: "AP23110010419",
  currentSemester: "4",
  academicYear: "2024-2025",
  program: "B.Tech Computer Science and Engineering",
  specialization: "Artificial Intelligence",
  section: "A",
  fatherName: "Robert Johnson",
  motherName: "Susan Johnson",
  contactNumber: "+91-9876543210",
  email: "alice.johnson@srmap.edu.in",
};

function makeProfileData(tableContent: Record<string, string>) {
  return { TableContent: tableContent };
}

describe("BasicInfo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows empty state when profileData is null", () => {
    render(<BasicInfo profileData={null} />);
    expect(screen.getByText("No profile data")).toBeInTheDocument();
  });

  it("shows empty state when profileData is undefined", () => {
    render(<BasicInfo profileData={undefined} />);
    expect(screen.getByText("No profile data")).toBeInTheDocument();
  });

  it("shows loading state when TableContent is missing", () => {
    render(<BasicInfo profileData={{}} />);
    expect(screen.getByText("Loading profile data...")).toBeInTheDocument();
  });

  it("shows pipeline error state when executePipeline returns invalid result", () => {
    mockExecutePipeline.mockReturnValue({ isValid: false, data: null });
    render(
      <BasicInfo profileData={makeProfileData({ "Student Name": "Alice" })} />,
    );
    expect(
      screen.getByText("No valid profile data"),
    ).toBeInTheDocument();
  });

  it("shows pipeline error state when executePipeline returns null", () => {
    mockExecutePipeline.mockReturnValue(null);
    render(
      <BasicInfo profileData={makeProfileData({ "Student Name": "Alice" })} />,
    );
    expect(
      screen.getByText("No valid profile data"),
    ).toBeInTheDocument();
  });

  it("renders student name in success state", () => {
    mockExecutePipeline.mockReturnValue({
      isValid: true,
      data: validProfileModel,
    });

    render(
      <BasicInfo profileData={makeProfileData({ "Student Name": "Alice Johnson" })} />,
    );

    expect(screen.getByText("Alice Johnson")).toBeInTheDocument();
  });

  it("renders all field labels", () => {
    mockExecutePipeline.mockReturnValue({
      isValid: true,
      data: validProfileModel,
    });

    render(
      <BasicInfo profileData={makeProfileData({ "Student Name": "Alice Johnson" })} />,
    );

    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Register No")).toBeInTheDocument();
    expect(screen.getByText("Semester")).toBeInTheDocument();
    expect(screen.getByText("Academic Year")).toBeInTheDocument();
    expect(screen.getByText("Program")).toBeInTheDocument();
    expect(screen.getByText("Specialization")).toBeInTheDocument();
    expect(screen.getByText("Section")).toBeInTheDocument();
    expect(screen.getByText("Father Name")).toBeInTheDocument();
    expect(screen.getByText("Mother Name")).toBeInTheDocument();
    expect(screen.getByText("Student Contact Number")).toBeInTheDocument();
    expect(screen.getByText("Email")).toBeInTheDocument();
  });

  it("renders all profile field values (case-insensitive for sanitized all-caps)", () => {
    mockExecutePipeline.mockReturnValue({
      isValid: true,
      data: validProfileModel,
    });

    render(
      <BasicInfo profileData={makeProfileData({ "Student Name": "Alice Johnson" })} />,
    );

    // sanitizeErpDisplayText title-cases all-caps values, so use case-insensitive match
    expect(screen.getByText(/Alice Johnson/)).toBeInTheDocument();
    expect(screen.getByText(/Ap23110010419/i)).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("2024-2025")).toBeInTheDocument();
    expect(
      screen.getByText(/B\.Tech Computer Science and Engineering/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Artificial Intelligence/)).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("Robert Johnson")).toBeInTheDocument();
    expect(screen.getByText("Susan Johnson")).toBeInTheDocument();
    expect(screen.getByText("+91-9876543210")).toBeInTheDocument();
    expect(screen.getByText(/alice\.johnson@srmap\.edu\.in/)).toBeInTheDocument();
  });

  it("displays N/A for empty field values", () => {
    mockExecutePipeline.mockReturnValue({
      isValid: true,
      data: {
        studentName: "Bob",
        registerNo: "",
        currentSemester: "",
        academicYear: "",
        program: "",
        specialization: "",
        section: "",
        fatherName: "",
        motherName: "",
        contactNumber: null,
        email: undefined,
      },
    });

    render(
      <BasicInfo profileData={makeProfileData({ "Student Name": "Bob" })} />,
    );

    // sanitizeErpDisplayText title-cases all-caps "N/A" to "N/a"
    const naElements = screen.getAllByText(/N\/a/i);
    expect(naElements.length).toBeGreaterThanOrEqual(8);
  });

  it("passes TableContent to executePipeline", () => {
    const tableContent = { "Student Name": "Alice Johnson" };
    mockExecutePipeline.mockReturnValue({
      isValid: true,
      data: validProfileModel,
    });

    render(<BasicInfo profileData={makeProfileData(tableContent)} />);

    expect(mockExecutePipeline).toHaveBeenCalledWith("profile", tableContent);
  });
});

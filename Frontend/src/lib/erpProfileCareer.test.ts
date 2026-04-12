import { describe, it, expect } from "vitest";
import { parseCareerBranchFromProfile, parseCareerYearFromProfile } from "./erpProfileCareer";

describe("erpProfileCareer", () => {
  it("parses branch from B.Tech CSE program line", () => {
    const branch = parseCareerBranchFromProfile({
      TableContent: { "Program / Section": "B.Tech CSE / A" },
    });
    expect(branch).toBe("CSE");
  });

  it("parses III Year", () => {
    const y = parseCareerYearFromProfile({
      TableContent: { "Academic Year": "III Year" },
    });
    expect(y).toBe(3);
  });

  it("returns null year when missing", () => {
    expect(parseCareerYearFromProfile({ TableContent: {} })).toBeNull();
  });
});

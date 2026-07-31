import { describe, it, expect } from "vitest";
import { calculateBunkCapacity } from "./BunkCalculator";

describe("calculateBunkCapacity", () => {
  it("returns Required when attendance is below 75%", () => {
    const result = calculateBunkCapacity(100, 70);
    expect(result.status).toBe("required");
    expect(result.safeToSkip).toBe(0);
    expect(result.classesNeededToAttend).toBe(5);
  });

  it("returns Safe when attendance has a small buffer above 75%", () => {
    const result = calculateBunkCapacity(40, 31, 75, 1);
    expect(result.status).toBe("safe");
    expect(result.safeToSkip).toBeGreaterThan(0);
    expect(result.classesNeededToAttend).toBe(0);
  });

  it("returns Caution when attendance has a large buffer above 75%", () => {
    const result = calculateBunkCapacity(80, 70, 75, 5);
    expect(result.status).toBe("caution");
    expect(result.safeToSkip).toBeGreaterThanOrEqual(3);
    expect(result.classesNeededToAttend).toBe(0);
  });

  it("returns Caution for 100% attendance (large buffer)", () => {
    const result = calculateBunkCapacity(50, 50);
    expect(result.status).toBe("caution");
    expect(result.safeToSkip).toBeGreaterThan(0);
    expect(result.classesNeededToAttend).toBe(0);
  });

  it("returns Required for exactly 75% attendance with no buffer", () => {
    const result = calculateBunkCapacity(40, 30, 75, 0);
    expect(result.status).toBe("required");
    expect(result.safeToSkip).toBe(0);
    expect(result.classesNeededToAttend).toBe(0);
  });

  it("accounts for OD/ML in safe skip calculations", () => {
    const result = calculateBunkCapacity(100, 90, 75, 10);
    expect(result.currentAttendance).toBe(100);
    expect(result.safeToSkip).toBe(25);
    expect(result.classesNeededToAttend).toBe(0);
  });

  it("returns a number for caution offset from safeToSkip", () => {
    const result = calculateBunkCapacity(50, 50);
    expect(typeof result.caution).toBe("number");
    expect(result.caution).toBeGreaterThanOrEqual(0);
  });

  it("calculates classes needed to attend when below target", () => {
    const result = calculateBunkCapacity(40, 29);
    expect(result.status).toBe("required");
    expect(result.classesNeededToAttend).toBe(1); // 75% of 40 = 30, needs 1 more
  });

  it("calculates classes needed to attend when below target by more", () => {
    const result = calculateBunkCapacity(40, 28);
    expect(result.classesNeededToAttend).toBe(2); // 75% of 40 = 30, needs 2 more
  });
});
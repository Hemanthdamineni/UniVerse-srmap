import { describe, expect, it } from "vitest";
import {
  buildCabinLookup,
  findFacultyCabin,
  normalizeFacultyName,
} from "./facultyApi";
import type { FacultyCabin, TimetableSubject } from "./types";

const CABINS: FacultyCabin[] = [
  { faculty: "Dr. Abhaya Kumar Pradhan", location: "S15, 7th Floor, S Radhakrishnan Block" },
  { faculty: "Dr Janmejaya Panda", location: "Homi J Bhabha Block, Level 4, Cubicle No: 1" },
  { faculty: "Sangeeta Saha", location: "CV Raman Block, Level 3, Room: 310" },
];

describe("normalizeFacultyName", () => {
  it("strips honorifics, punctuation, and extra spaces", () => {
    expect(normalizeFacultyName("Dr. Abhaya Kumar Pradhan")).toBe("abhaya kumar pradhan");
    expect(normalizeFacultyName("Prof. Sangeeta Saha")).toBe("sangeeta saha");
    expect(normalizeFacultyName("Mr Nilin Prabhaker")).toBe("nilin prabhaker");
  });

  it("removes parenthetical qualifiers and registration numbers", () => {
    expect(normalizeFacultyName("Dr John Doe (Temporary)")).toBe("john doe");
    expect(normalizeFacultyName("ap23110010419 john doe")).toContain("john doe");
  });

  it("returns empty string for blank input", () => {
    expect(normalizeFacultyName("   ")).toBe("");
  });
});

describe("findFacultyCabin", () => {
  it("matches exactly after normalization", () => {
    expect(findFacultyCabin("Dr. JANMEJAYA PANDA", CABINS)?.location).toContain("Cubicle No: 1");
  });

  it("falls back to strong token overlap for partial names", () => {
    // Timetable may render a shortened form of the directory name.
    const cabin = findFacultyCabin("Janmejaya Panda", CABINS);
    expect(cabin?.location).toContain("Homi J Bhabha");
  });

  it("returns null for unknown faculty", () => {
    expect(findFacultyCabin("Dr Nobody Knows", CABINS)).toBeNull();
    expect(findFacultyCabin("", CABINS)).toBeNull();
  });
});

describe("buildCabinLookup", () => {
  const subjects: TimetableSubject[] = [
    { code: "CSE301", name: "OS", ltpc: "3-0-0-3", faculty: "Dr Janmejaya Panda", room: "AB-1" },
    { code: "CSE302", name: "DBMS", ltpc: "3-0-0-3", faculty: "Faculty TBA", room: "AB-2" },
  ];

  it("maps resolvable faculty names and skips TBA entries", () => {
    const lookup = buildCabinLookup(subjects, CABINS);
    expect(lookup.size).toBe(1);
    expect(lookup.get("Dr Janmejaya Panda")).toContain("Homi J Bhabha");
    expect(lookup.has("Faculty TBA")).toBe(false);
  });

  it("returns an empty lookup when cabins are unavailable", () => {
    expect(buildCabinLookup(subjects, []).size).toBe(0);
  });
});

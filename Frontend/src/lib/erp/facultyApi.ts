import { requestData } from "../core/apiClient";
import { isStaticPrototype } from "../core/prototype";
import type { FacultyCabin, TimetableSubject } from "./types";

/**
 * Normalizes a faculty name for matching: strips honorifics, parenthetical
 * qualifiers, registration numbers, and punctuation. Ported from the
 * Srmap-Api reference implementation.
 */
export function normalizeFacultyName(name: string): string {
  return String(name || "")
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/\b(dr|mr|mrs|ms|prof)\b/g, "")
    .replace(/\b[a-z]{2,}\d{2,}\b/g, "")
    .replace(/\./g, "")
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenOverlapScore(a: string, b: string): number {
  const tokensA = new Set(a.split(" ").filter(Boolean));
  const tokensB = new Set(b.split(" ").filter(Boolean));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let shared = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) shared += 1;
  }
  return shared / Math.min(tokensA.size, tokensB.size);
}

export function findFacultyCabin(
  facultyName: string,
  cabins: FacultyCabin[],
): FacultyCabin | null {
  const normalized = normalizeFacultyName(facultyName);
  if (!normalized) return null;

  const exact = cabins.find((cabin) => normalizeFacultyName(cabin.faculty) === normalized);
  if (exact) return exact;

  // Timetable strings often append extra context ("(Temporary)") or drop
  // middle names; accept a strong token overlap as a fallback.
  let best: { cabin: FacultyCabin; score: number } | null = null;
  for (const cabin of cabins) {
    const score = tokenOverlapScore(normalized, normalizeFacultyName(cabin.faculty));
    if (score >= 0.75 && (!best || score > best.score)) {
      best = { cabin, score };
    }
  }
  return best?.cabin ?? null;
}

/** Builds a faculty-code → cabin lookup ready for timetable rendering. */
export function buildCabinLookup(
  subjects: TimetableSubject[],
  cabins: FacultyCabin[],
): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const subject of subjects) {
    const name = String(subject.faculty || "").trim();
    if (!name || name.toLowerCase().includes("tba")) continue;
    if (lookup.has(name)) continue;
    const cabin = findFacultyCabin(name, cabins);
    if (cabin) lookup.set(name, cabin.location);
  }
  return lookup;
}

export async function getFacultyCabins(): Promise<FacultyCabin[]> {
  if (isStaticPrototype()) {
    return STATIC_FACULTY_CABIN_FIXTURE;
  }
  return requestData<FacultyCabin[]>("/api/faculty-cabins");
}

export const STATIC_FACULTY_CABIN_FIXTURE: FacultyCabin[] = [
  { faculty: "Dr. Abhaya Kumar Pradhan", location: "S15, 7th Floor, S Radhakrishnan Block" },
  { faculty: "Dr Janmejaya Panda", location: "Homi J Bhabha Block, Level 4, Cubicle No: 1" },
];

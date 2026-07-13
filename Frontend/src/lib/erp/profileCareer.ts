/**
 * Mirrors Backend/src/utils/eventsAuth.js parsing so eligibility on the
 * career detail page matches server-side filtering and the plan's ERP contract.
 */
export function parseCareerBranchFromProfile(profileData: { TableContent?: Record<string, string> } | null | undefined): string {
  const table = profileData?.TableContent || {};
  const program = String(table["Program / Section"] || "").trim();
  if (!program) return "";
  const match = program.match(/B\.Tech\s+([^/]+)/i);
  return match ? match[1].trim() : program.split("/")[0].trim();
}

export function parseCareerYearFromProfile(profileData: { TableContent?: Record<string, string> } | null | undefined): number | null {
  const table = profileData?.TableContent || {};
  const academicYear = String(table["Academic Year"] || "").trim();
  if (!academicYear) return null;
  const romanMap: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5 };
  const firstWord = academicYear.split(" ")[0].toUpperCase();
  if (romanMap[firstWord] !== undefined) return romanMap[firstWord];
  const digitMatch = academicYear.match(/(\d+)/);
  return digitMatch ? parseInt(digitMatch[1], 10) : null;
}

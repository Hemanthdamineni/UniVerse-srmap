import { readStoredProfileData } from "./session";

export const PLATFORM_ADMIN_REG_NO = "AP23110010419";

type ProfileRecord = Record<string, unknown>;

function getTableContent(profile: ProfileRecord | null): ProfileRecord {
  const table = profile?.TableContent;
  return table && typeof table === "object" && !Array.isArray(table)
    ? (table as ProfileRecord)
    : {};
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

export function getCurrentRegNo(profile = readStoredProfileData()) {
  const table = getTableContent(profile);
  return firstString(
    table["Register No."],
    table["Register No"],
    table.registerNo,
    table.registerNumber,
    profile?.registerNo,
    profile?.registerNumber,
    profile?.regNo,
    profile?.id,
  ).toUpperCase();
}

export function getCurrentProfileName(profile = readStoredProfileData()) {
  const table = getTableContent(profile);
  return firstString(
    table["Student Name"],
    table.Name,
    table.name,
    profile?.name,
    profile?.studentName,
    getCurrentRegNo(profile),
    "Student",
  );
}

export function getCurrentProfileSummary(profile = readStoredProfileData()) {
  return {
    name: getCurrentProfileName(profile),
    regNo: getCurrentRegNo(profile),
    isPlatformAdmin: isPlatformAdmin(profile),
  };
}

export function isPlatformAdmin(profileOrRegNo: ProfileRecord | string | null = readStoredProfileData()) {
  const regNo =
    typeof profileOrRegNo === "string"
      ? profileOrRegNo.trim().toUpperCase()
      : getCurrentRegNo(profileOrRegNo);

  return regNo === PLATFORM_ADMIN_REG_NO;
}

import { readStoredProfileData } from "./session";

/**
 * Admin register numbers sourced from VITE_ADMIN_REGISTER_NUMBERS env var
 * (comma-separated string, e.g. "AP23110010419,AP23110010420").
 * Falls back to an empty array. Configure via .env in production.
 */
const RAW_ENV = import.meta.env.VITE_ADMIN_REGISTER_NUMBERS as string | undefined;
const ADMIN_REGISTER_NUMBERS: string[] = (RAW_ENV || "")
  .split(",")
  .map((s) => s.trim().toUpperCase())
  .filter(Boolean);

if (!RAW_ENV && import.meta.env.DEV) {
  console.warn(
    "[identity] VITE_ADMIN_REGISTER_NUMBERS is not set. No platform admins defined.",
  );
}

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

  return ADMIN_REGISTER_NUMBERS.length > 0 && ADMIN_REGISTER_NUMBERS.includes(regNo);
}

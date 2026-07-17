/**
 * Admin register numbers.
 *
 * Read from the ADMIN_REGISTER_NUMBERS environment variable as a comma-separated
 * string (e.g. "AP23110010419,AP23110010420"). Falls back to a hardcoded list
 * when the env var is not set. Prefer configuring via env in production.
 */
const FALLBACK_ADMIN_REGISTER_NUMBERS = ["AP23110010419"];

const ENV_VAL = (process.env.ADMIN_REGISTER_NUMBERS || "").trim();
const ADMIN_REGISTER_NUMBERS = new Set(
  ENV_VAL
    ? ENV_VAL.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
    : FALLBACK_ADMIN_REGISTER_NUMBERS,
);

function normalizeRegisterNo(value) {
  return String(value || "").trim().toUpperCase();
}

function extractRegisterNoFromProfile(profileData, fallbackUsername = "") {
  const table =
    profileData && typeof profileData === "object" && profileData.TableContent && typeof profileData.TableContent === "object"
      ? profileData.TableContent
      : null;
  const candidates = [
    profileData && typeof profileData === "object" ? profileData.registerNo : "",
    table && typeof table === "object" ? table["Register No."] : "",
    table && typeof table === "object" ? table.registerNo : "",
    fallbackUsername,
  ];
  for (const candidate of candidates) {
    const normalized = normalizeRegisterNo(candidate);
    if (normalized) return normalized;
  }
  return "";
}

function isPotentialAdminRegisterNo(registerNo) {
  const normalized = normalizeRegisterNo(registerNo);
  return normalized ? ADMIN_REGISTER_NUMBERS.has(normalized) : false;
}

module.exports = {
  ADMIN_REGISTER_NUMBERS,
  normalizeRegisterNo,
  extractRegisterNoFromProfile,
  isPotentialAdminRegisterNo,
};

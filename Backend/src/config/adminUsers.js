const ADMIN_REGISTER_NUMBERS = new Set([
  "AP23110010419",
]);

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

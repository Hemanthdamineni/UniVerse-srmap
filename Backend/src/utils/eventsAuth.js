const { resolveSessionId } = require("./cookies");
const { hasAdminAccess } = require("./adminAccess");
const { extractRegisterNoFromProfile, isPotentialAdminRegisterNo } = require("../config/adminUsers");

function parseDepartmentFromProfile(profileData) {
  const table = profileData?.TableContent || {};
  const candidates = ["Program / Section", "Department", "School", "Program"];
  for (const key of candidates) {
    if (table[key]) {
      return String(table[key]).split("/")[0].trim() || "General";
    }
  }
  return "General";
}

function parseNameFromProfile(profileData) {
  const table = profileData?.TableContent || {};
  return String(table["Student Name"] || table["Name"] || "ERP User");
}

function parseEmailFromProfile(profileData) {
  const table = profileData?.TableContent || {};
  return String(table["Student E-Mail"] || table["Email"] || "user@example.edu");
}

function parseBranchFromProfile(profileData) {
  const table = profileData?.TableContent || {};
  const program = String(table["Program / Section"] || "").trim();
  // Example: "B.Tech Computer Science and Engineering / A" -> "Computer Science and Engineering"
  // Example: "B.Tech CSE / B" -> "CSE"
  if (!program) return "General";
  const match = program.match(/B\.Tech\s+([^/]+)/i);
  return match ? match[1].trim() : program.split("/")[0].trim();
}

function parseYearFromProfile(profileData) {
  const table = profileData?.TableContent || {};
  const academicYear = String(table["Academic Year"] || "").trim();
  // Example: "III Year" -> 3
  // Example: "1st Year" -> 1
  if (!academicYear) return null;
  const romanMap = { "I": 1, "II": 2, "III": 3, "IV": 4, "V": 5 };
  const firstWord = academicYear.split(" ")[0].toUpperCase();
  if (romanMap[firstWord]) return romanMap[firstWord];
  const digitMatch = academicYear.match(/(\d+)/);
  return digitMatch ? parseInt(digitMatch[1]) : null;
}

function parseUserIdFromProfile(profileData) {
  const table = profileData?.TableContent || {};
  return String(table["Register No."] || table["Student ID"] || "erp-user");
}

function resolveRole(req, sessionStore, adminPassword = "") {
  return resolveRoleAsync(req, sessionStore, adminPassword);
}

async function resolveRoleAsync(req, sessionStore, adminPassword = "") {
  const sessionId = resolveSessionId(req);
  if (!sessionId) return "guest";

  try {
    const session = await sessionStore.getOrThrow(sessionId);
    if (!session?.loggedIn) return "guest";

    const profile = session.profileData || {};
    const registerNo = extractRegisterNoFromProfile(profile);
    if (isPotentialAdminRegisterNo(registerNo)) return "admin";

    const program = String(profile?.TableContent?.["Program / Section"] || "").toLowerCase();

    if (program.includes("faculty")) return "faculty";
    return "student";
  } catch {
    return "guest";
  }
}

function createUserContextMiddleware({ sessionStore, adminPassword = "" }) {
  return async function userContext(req, _res, next) {
    const role = await resolveRole(req, sessionStore, adminPassword);
    const sessionId = resolveSessionId(req);

    let session = null;
    if (sessionId) {
      try {
        session = await sessionStore.getOrThrow(sessionId);
      } catch {
        session = null;
      }
    }

    const profile = session?.profileData || {};

    req.userContext = {
      role,
      userId: parseUserIdFromProfile(profile),
      name: parseNameFromProfile(profile),
      email: parseEmailFromProfile(profile),
      department: parseDepartmentFromProfile(profile),
      branch: parseBranchFromProfile(profile),
      year: parseYearFromProfile(profile),
      sessionId,
      isAuthenticated: Boolean(session && session.loggedIn),
      hasAdminAccess: role === "admin",
    };

    if (role === "admin") {
      req.userContext.userId = req.userContext.userId || "admin-user";
      req.userContext.name = req.userContext.name || "Admin";
      req.userContext.email = req.userContext.email || "admin@example.edu";
      req.userContext.department = req.userContext.department || "General";
    } else if (role === "guest" && !req.userContext.userId) {
      req.userContext.userId = "guest-user";
    }

    return next();
  };
}

module.exports = {
  createUserContextMiddleware,
};

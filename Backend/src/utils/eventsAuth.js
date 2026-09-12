const { resolveSessionId } = require("./cookies");
const { extractRegisterNoFromProfile, isPotentialAdminRegisterNo } = require("../config/adminUsers");
const erpProfileFields = require("./erpProfileFields");

// Thin wrappers over the shared, unit-tested ERP-profile parsers. They keep the
// non-empty fallbacks the events/career routers have always relied on.
function parseNameFromProfile(profileData) {
  return erpProfileFields.parseName(profileData) || "ERP User";
}

function parseEmailFromProfile(profileData) {
  return erpProfileFields.parseEmail(profileData) || "user@example.edu";
}

function parseBranchFromProfile(profileData) {
  return erpProfileFields.parseBranch(profileData) || "General";
}

function parseDepartmentFromProfile(profileData) {
  // The live ERP profile has no distinct "department" — the branch is the unit
  // students identify with. Kept as a separate accessor for call-site clarity.
  return (
    erpProfileFields.parseInstitution(profileData) ||
    erpProfileFields.parseBranch(profileData) ||
    "General"
  );
}

function parseYearFromProfile(profileData) {
  return erpProfileFields.parseYear(profileData);
}

function parseUserIdFromProfile(profileData) {
  return erpProfileFields.parseRegisterNo(profileData) || "erp-user";
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
    if (isPotentialAdminRegisterNo(registerNo) && session.adminElevated) return "admin";

    const program = String(profile?.TableContent?.["Program / Section"] || "").toLowerCase();

    if (program.includes("faculty")) return "faculty";
    return "student";
  } catch {
    return "guest";
  }
}

function createUserContextMiddleware({ sessionStore, adminPassword = "", userDirectory = null }) {
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
      programme: erpProfileFields.parseDegree(profile),
      specialization: erpProfileFields.parseSpecialization(profile),
      section: erpProfileFields.parseSection(profile),
      year: parseYearFromProfile(profile),
      sessionId,
      isAuthenticated: Boolean(session && session.loggedIn),
      // Some routers are exercised standalone, without app-level
      // adminContext middleware. `role === admin` already requires both the
      // configured allowlist and the server-side session elevation flag.
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

    // Remember this register-number → display-name so organizer surfaces
    // (leaderboards, judge lists, audit trails) can show names, not IDs.
    // Best-effort: never let a directory write break the request (B3 / T5.4.6).
    if (userDirectory && req.userContext.isAuthenticated) {
      try {
        userDirectory.record(req.userContext.userId, req.userContext.name);
      } catch {
        /* nicety only */
      }
    }

    return next();
  };
}

module.exports = {
  createUserContextMiddleware,
};

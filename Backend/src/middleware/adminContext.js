const { resolveSessionId } = require("../utils/cookies");
const { extractRegisterNoFromProfile, isPotentialAdminRegisterNo } = require("../config/adminUsers");

function createAdminContextMiddleware({ sessionStore }) {
  return async (req, _res, next) => {
    req.adminContext = {
      registerNo: "",
      potentialAdmin: false,
      isElevated: false,
    };

    try {
      const sessionId = resolveSessionId(req);
      if (!sessionId) return next();
      const session = await sessionStore.getOrThrow(sessionId);
      if (!session) return next();

      const registerNo = extractRegisterNoFromProfile(session.profileData, session.username);
      const potentialAdmin = isPotentialAdminRegisterNo(registerNo);
      // A stale or forged elevation flag cannot grant access after an account
      // is removed from the configured allowlist.
      const isElevated = potentialAdmin && Boolean(session.adminElevated);

      req.adminContext = {
        registerNo,
        potentialAdmin,
        isElevated,
      };
    } catch {
      // Best-effort context enrichment only.
    }
    return next();
  };
}

module.exports = {
  createAdminContextMiddleware,
};

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
      const isElevated = Boolean(session.adminElevated);

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

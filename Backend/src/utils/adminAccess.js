function getProvidedAdminPassword(req) {
  const fromHeader = String(req.get("x-admin-password") || "").trim();
  if (fromHeader) return fromHeader;

  if (req.body && typeof req.body.adminPassword === "string") {
    const fromBody = req.body.adminPassword.trim();
    if (fromBody) return fromBody;
  }

  if (typeof req.query.adminPassword === "string") {
    const fromQuery = req.query.adminPassword.trim();
    if (fromQuery) return fromQuery;
  }

  return "";
}

function hasAdminAccess(req, adminPassword = "") {
  if (req?.adminContext?.isElevated) return true;
  const requiredPassword = String(adminPassword || "").trim();
  if (!requiredPassword) return true;
  return getProvidedAdminPassword(req) === requiredPassword;
}

function assertAdminAccess(req, adminPassword = "") {
  if (hasAdminAccess(req, adminPassword)) return;
  const error = new Error("Admin authentication failed");
  error.status = 403;
  throw error;
}

module.exports = {
  getProvidedAdminPassword,
  hasAdminAccess,
  assertAdminAccess,
};

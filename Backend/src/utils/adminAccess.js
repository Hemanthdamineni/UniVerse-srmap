function getProvidedAdminPassword(req) {
  const fromHeader = String(req.get("x-admin-password") || "").trim();
  if (fromHeader) return fromHeader;

  if (req.body && typeof req.body.adminPassword === "string") {
    const fromBody = req.body.adminPassword.trim();
    if (fromBody) return fromBody;
  }

  return "";
}

function hasAdminAccess(req, adminPassword = "") {
  if (req?.adminContext?.isElevated) return true;
  const requiredPassword = String(adminPassword || "").trim();
  if (!requiredPassword) return false;
  return getProvidedAdminPassword(req) === requiredPassword;
}

function assertAdminAccess(req, adminPassword = "") {
  if (hasAdminAccess(req, adminPassword)) return;
  const requiredPassword = String(adminPassword || "").trim();
  const error = new Error(
    requiredPassword
      ? "Admin authentication failed"
      : "Admin authentication is not configured"
  );
  error.status = requiredPassword ? 403 : 503;
  throw error;
}

module.exports = {
  getProvidedAdminPassword,
  hasAdminAccess,
  assertAdminAccess,
};

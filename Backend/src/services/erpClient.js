const { createApiContext } = require("./erpClient/apiContext");
const {
  setCaptureDir,
  callEndpointViaApi,
  fetchProfileViaApi,
  submitAttendanceCodeViaApi,
} = require("./erpClient/endpointApi");
const {
  resolveLoginUrl,
  parseLoginBootstrap,
  extractLoginFieldTargets,
  buildFieldSelector,
  buildLoginPayload,
} = require("./erpClient/loginForm");
const { fetchCaptcha } = require("./erpClient/captcha");
const { loginWithCaptcha } = require("./erpClient/loginFlow");
const {
  initiatePasswordReset,
  completePasswordReset,
  validatePasswordResetPassword,
} = require("./erpClient/passwordReset");
const {
  isUsableProfileData,
  classifyLoginResponse,
  buildFallbackProfileData,
  makeSessionExpiredError,
  isErpSessionExpiredResponse,
} = require("./erpClient/sessionState");

module.exports = {
  createApiContext,
  fetchCaptcha,
  loginWithCaptcha,
  initiatePasswordReset,
  completePasswordReset,
  validatePasswordResetPassword,
  callEndpointViaApi,
  fetchProfileViaApi,
  submitAttendanceCodeViaApi,
  isUsableProfileData,
  buildFallbackProfileData,
  extractLoginFieldTargets,
  parseLoginBootstrap,
  buildLoginPayload,
  classifyLoginResponse,
  isErpSessionExpiredResponse,
  makeSessionExpiredError,
  setCaptureDir,
  redactSensitiveText: require("./loginDiagnostics").redactSensitiveText,
  sanitizeArtifactPayload: require("./loginDiagnostics").sanitizeArtifactPayload,
};

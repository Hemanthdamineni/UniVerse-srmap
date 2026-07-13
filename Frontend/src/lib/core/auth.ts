export function normalizeRegistrationNumber(value: string) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 13);
}

export function validateRegistrationNumber(value: string) {
  const normalized = normalizeRegistrationNumber(value);
  if (!normalized) return "Registration number is required.";
  if (!/^AP\d{11}$/i.test(normalized)) {
    return "Registration number must look like AP24110000000.";
  }
  return "";
}

export function validatePasswordReset(value: string) {
  const password = String(value || "");
  if (password.length < 8) return "Password must be at least 8 characters long.";
  if (!/[A-Z]/.test(password)) return "Password must include at least one uppercase letter.";
  if (!/[a-z]/.test(password)) return "Password must include at least one lowercase letter.";
  if (!/\d/.test(password)) return "Password must include at least one number.";
  return "";
}

export function normalizeCaptchaImageSource(value: unknown) {
  const source = String(value || "").trim();
  if (!source) return "";
  if (source.startsWith("data:image/")) return source;
  return `data:image/png;base64,${source}`;
}

export function extractApiErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;

  const body = payload as Record<string, unknown>;
  if (typeof body.message === "string" && body.message.trim()) {
    return body.message;
  }

  if (body.error && typeof body.error === "object") {
    const errorBody = body.error as Record<string, unknown>;
    if (typeof errorBody.message === "string" && errorBody.message.trim()) {
      return errorBody.message;
    }
  }

  if (typeof body.error === "string" && body.error.trim()) {
    return body.error;
  }

  return fallback;
}

export function extractApiErrorCode(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";

  const body = payload as Record<string, unknown>;
  if (typeof body.code === "string" && body.code.trim()) {
    return body.code.trim().toUpperCase();
  }

  if (body.error && typeof body.error === "object") {
    const errorBody = body.error as Record<string, unknown>;
    if (typeof errorBody.code === "string" && errorBody.code.trim()) {
      return errorBody.code.trim().toUpperCase();
    }
  }

  return "";
}

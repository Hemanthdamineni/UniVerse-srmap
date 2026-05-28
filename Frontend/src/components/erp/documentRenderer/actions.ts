import { ApiError } from "../../../lib/erpApi";
import { readString, type ButtonAction, type FormValues } from "./model";

const DEBUG_RENDER = false;

export function resolveDebugFlag(debug?: boolean) {
  if (typeof debug === "boolean") return debug;
  if (DEBUG_RENDER) return true;
  if (typeof window === "undefined") return false;

  const params = new URLSearchParams(window.location.search);
  return params.get("erpDebug") === "1" || params.get("erpDocumentDebug") === "1" || window.localStorage.getItem("erpDocumentDebug") === "1";
}

export function isAbsoluteExternalUrl(value: string) {
  return /^[a-z]+:\/\//i.test(value) || value.startsWith("//");
}

export function isTrustedApiTarget(value: string) {
  return value.startsWith("/api/");
}

export function isTrustedRelativeTarget(value: string) {
  return value.startsWith("/") && !isAbsoluteExternalUrl(value);
}

export function parseExamMonthSelection(rawValue: string) {
  if (rawValue.includes(",")) {
    const parts = rawValue
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length >= 3) {
      const [examMonth, examYear, sid] = parts;
      if (examMonth !== "0" && examYear !== "0" && sid !== "0") {
        return { examMonth, examYear, sid };
      }
    }
  }

  const normalized = rawValue.toUpperCase().trim();
  const months: Record<string, string> = {
    JANUARY: "1", FEBRUARY: "2", MARCH: "3", APRIL: "4",
    MAY: "5", JUNE: "6", JULY: "7", AUGUST: "8",
    SEPTEMBER: "9", OCTOBER: "10", NOVEMBER: "11", DECEMBER: "12"
  };

  const match = normalized.match(/^([A-Z]+)\s+(\d{4})$/);
  if (match) {
    const monthStr = match[1];
    const yearStr = match[2];
    const monthNum = months[monthStr || ""];
    if (monthNum && yearStr) {
      return { examMonth: monthNum, examYear: yearStr, sid: "0" };
    }
  }

  return null;
}

export function buildExamApplicationPrintTarget(action: ButtonAction, formState?: FormValues) {
  const selectedRaw =
    readString(formState?.cmbExamMonth) ||
    readString(formState?.examMonthValue) ||
    readString(formState?.examSelection);
  const selected = parseExamMonthSelection(selectedRaw);

  if (!selected) {
    throw new ApiError("Select Exam Month and Year before printing application.", 400, "BAD_REQUEST");
  }

  const target = readString(action.target, "/srmapstudentcorner/students/report/PrintStudentExamApplication.jsp");
  if (!isTrustedRelativeTarget(target)) {
    throw new ApiError("External print targets are blocked.", 400, "UNTRUSTED_TARGET");
  }

  const params = new URLSearchParams({
    ExamMonth: selected.examMonth,
    ExamYear: selected.examYear,
    sid: selected.sid,
    fnd: "0",
  });

  const queryParams = params.toString();
  const fullPath = `${target}${target.includes("?") ? "&" : "?"}${queryParams}`;
  return `https://student.srmap.edu.in${fullPath}`;
}

export function normalizeActionMethod(value: string) {
  const method = readString(value, "GET").toUpperCase();
  if (method === "GET" || method === "POST") return method;
  throw new ApiError(`Unsupported action method: ${method || "unknown"}`, 400, "INVALID_ACTION_METHOD");
}

export function buildRouteTarget(action: ButtonAction) {
  const route = readString(action.targetRoute || action.target);
  if (!route) {
    throw new ApiError("Navigation target is missing.", 400, "INVALID_ACTION");
  }
  if (!isTrustedRelativeTarget(route)) {
    throw new ApiError("External navigation targets are blocked.", 400, "UNTRUSTED_ROUTE");
  }

  if (!action.queryParams || Object.keys(action.queryParams).length === 0) {
    return route;
  }

  const [pathname, existingQuery = ""] = route.split("?", 2);
  const params = new URLSearchParams(existingQuery);
  Object.entries(action.queryParams).forEach(([key, value]) => {
    if (!key) return;
    params.set(key, value);
  });

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function assertSafeAction(action: ButtonAction) {
  const method = normalizeActionMethod(action.method);

  if (action.type === "navigate") {
    buildRouteTarget(action);
    return { ...action, method };
  }

  let target = readString(action.target);
  if (!target && action.type === "print_exam_application") {
    target = "/srmapstudentcorner/students/report/PrintStudentExamApplication.jsp";
  }

  if (!target) {
    throw new ApiError("Action target is missing.", 400, "INVALID_ACTION");
  }

  if (isAbsoluteExternalUrl(target)) {
    throw new ApiError("External action targets are blocked.", 400, "UNTRUSTED_TARGET");
  }

  if (action.type === "api_call" && !isTrustedApiTarget(target)) {
    throw new ApiError("API calls must target /api/* endpoints.", 400, "UNTRUSTED_API_TARGET");
  }

  if (!isTrustedRelativeTarget(target)) {
    throw new ApiError("Only internal ERP endpoints are allowed.", 400, "UNTRUSTED_TARGET");
  }

  return {
    ...action,
    target,
    method,
  };
}

export function formatActionError(error: unknown) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "Request failed.";
}

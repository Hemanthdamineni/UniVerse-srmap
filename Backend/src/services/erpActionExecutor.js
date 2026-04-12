const { BASE_PATH } = require("../config/env");
const { normalizeMutationUrl } = require("./erpUiMapStore");

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function makeError(message, status = 400, code = "BAD_REQUEST") {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function normalizeExpectedUrl(url) {
  const normalized = normalizeMutationUrl(url);
  if (!normalized) return "";

  const basePath = cleanText(BASE_PATH).replace(/^\/+/, "").replace(/\/+$/, "");
  if (basePath && normalized.toLowerCase().startsWith(`${basePath.toLowerCase()}/`)) {
    return normalized.slice(basePath.length + 1);
  }

  return normalized;
}

function extractMessageFromResponse(raw, fallback = "Action executed") {
  const text = cleanText(raw);
  if (!text) return fallback;

  if (/otp/i.test(text) && /send|sent|verify|verification/i.test(text)) {
    return "OTP request submitted";
  }

  if (/attendance/i.test(text) && /success|accepted|marked/i.test(text)) {
    return "Attendance submitted";
  }

  if (/success|submitted|saved|updated/i.test(text)) {
    return text.slice(0, 160);
  }

  return fallback;
}

function extractStudentId(profileData) {
  const table = profileData?.TableContent || {};
  for (const [key, value] of Object.entries(table)) {
    if (!/student\s*id|\bstu\s*id\b/i.test(String(key || ""))) continue;
    const match = String(value || "").match(/\b(\d{3,})\b/);
    if (match) return match[1];
  }
  return "";
}

function parseExamMonthValue(rawValue) {
  const parts = String(rawValue || "")
    .split(",")
    .map((part) => cleanText(part))
    .filter(Boolean);
  if (parts.length < 3) return null;
  const [examMonth, examYear, sid] = parts;
  if (!examMonth || !examYear || !sid) return null;
  return { examMonth, examYear, sid };
}

function selectFieldValue(field, payload) {
  const fieldName = cleanText(field?.name);
  const fieldId = cleanText(field?.id);

  if (fieldName && Object.prototype.hasOwnProperty.call(payload, fieldName)) {
    return payload[fieldName];
  }
  if (fieldId && Object.prototype.hasOwnProperty.call(payload, fieldId)) {
    return payload[fieldId];
  }

  const explicitValue = cleanText(field?.value);
  if (explicitValue) return explicitValue;

  if (cleanText(field?.type).toLowerCase() === "select" && Array.isArray(field?.options)) {
    const selected = field.options.find((option) => option?.selected) || field.options[0];
    const value = cleanText(selected?.value);
    if (value) return value;
  }

  return "";
}

function shouldIncludeHtml(action, url, contentType) {
  const label = cleanText(action?.label).toLowerCase();
  const endpoint = normalizeExpectedUrl(url).toLowerCase();
  const normalizedType = cleanText(contentType).toLowerCase();

  if (normalizedType.includes("text/html")) return true;
  if (action?.kind === "local-print" || action?.kind === "table-row-action") return true;
  if (label.includes("print")) return true;
  if (endpoint.includes("studentsonlinepaymentresponse.jsp")) return true;
  if (endpoint.includes("printstudentexamapplication.jsp")) return true;
  return false;
}

class ErpActionExecutor {
  constructor({ uiMapStore, sessionStore, apiContextFactory, discoveryRepository = null }) {
    this.uiMapStore = uiMapStore;
    this.sessionStore = sessionStore;
    this.apiContextFactory = apiContextFactory;
    this.discoveryRepository = discoveryRepository;
  }

  buildMutationPayload(action, inputPayload) {
    const payload = inputPayload && typeof inputPayload === "object" ? inputPayload : {};
    const defaults = action?.payloadDefaults && typeof action.payloadDefaults === "object"
      ? action.payloadDefaults
      : {};
    const mergedPayload = {
      ...defaults,
      ...payload,
    };

    const endpoint = normalizeExpectedUrl(action?.execution?.url || "");

    if (endpoint === "students/transaction/mobilenumberverificationotp.jsp") {
      const rawMobile = cleanText(
        mergedPayload.optmobilenumber || mergedPayload.mobileNumber || mergedPayload.mobile
      );
      const mobile = rawMobile.replace(/\D/g, "");
      if (!mobile || mobile.length < 10) {
        throw makeError("Valid mobile number is required", 400, "BAD_REQUEST");
      }

      const referencecode =
        cleanText(mergedPayload.referencecode || mergedPayload.referenceCode || "") ||
        String(Number(mobile) * 222);

      return {
        ids: "1",
        optmobilenumber: mobile,
        referencecode,
      };
    }

    if (endpoint === "students/transaction/studentattendanceresources.jsp") {
      const acode = cleanText(
        mergedPayload.acode || mergedPayload.attendanceCode || mergedPayload.code
      ).toUpperCase();
      if (!acode) {
        throw makeError("Attendance code is required", 400, "BAD_REQUEST");
      }

      return {
        ids: cleanText(mergedPayload.ids || "1") || "1",
        acode,
        dynamiclatdata: cleanText(mergedPayload.dynamiclatdata || "0") || "0",
        dynamiclonxdata: cleanText(mergedPayload.dynamiclonxdata || "0") || "0",
      };
    }

    if (endpoint === "students/transaction/studentsonlinepaymentresponse.jsp") {
      const txnid = cleanText(mergedPayload.txnid || mergedPayload.receiptId);
      if (!txnid) {
        throw makeError("Receipt transaction id is required", 400, "BAD_REQUEST");
      }

      return {
        txnid,
        msgs: cleanText(mergedPayload.msgs || mergedPayload.message || ""),
      };
    }

    return mergedPayload;
  }

  buildFormPayload(form, inputPayload) {
    const payload = inputPayload && typeof inputPayload === "object" ? inputPayload : {};
    const nextPayload = {};
    const fields = Array.isArray(form?.fields) ? form.fields : [];

    for (const field of fields) {
      const key = cleanText(field?.name || field?.id);
      if (!key) continue;
      const value = selectFieldValue(field, payload);
      if (value === "") continue;
      nextPayload[key] = value;
    }

    for (const [key, value] of Object.entries(payload)) {
      const normalizedKey = cleanText(key);
      if (!normalizedKey) continue;
      if (value === undefined || value === null) continue;
      nextPayload[normalizedKey] = value;
    }

    return nextPayload;
  }

  resolveActionForm(resolvedActionRef) {
    const action = resolvedActionRef?.action || {};
    const forms = Array.isArray(resolvedActionRef?.forms) ? resolvedActionRef.forms : [];
    if (!forms.length) return null;

    const formRef = cleanText(action.formRef);
    if (formRef) {
      const byRef = forms.find(
        (form) =>
          cleanText(form?.id).toLowerCase() === formRef.toLowerCase() ||
          cleanText(form?.name).toLowerCase() === formRef.toLowerCase()
      );
      if (byRef) return byRef;
    }

    const functionName = cleanText(action?.controlRef?.functionName || action?.execution?.functionName).toLowerCase();
    if (functionName === "funreturnhome") {
      const returnHomeForm = forms.find((form) => /returnhome/i.test(cleanText(form?.id || form?.name)));
      if (returnHomeForm) return returnHomeForm;
    }

    const withAction = forms.find((form) => cleanText(form?.action));
    if (withAction) return withAction;

    return forms[0];
  }

  resolveLoadDetailsEndpoint(targetId) {
    const map = this.discoveryRepository?.raw?.functionMappings?.funLoadDetailsById;
    if (!map || typeof map !== "object") return null;
    const key = String(targetId);
    const endpoint = map[key];
    return endpoint && typeof endpoint === "object" ? endpoint : null;
  }

  resolveHelperFunction(functionName) {
    if (!this.discoveryRepository || typeof this.discoveryRepository.resolveHelperFunction !== "function") {
      return null;
    }
    return this.discoveryRepository.resolveHelperFunction(functionName);
  }

  buildEndpointParams(template, context) {
    const params = {};
    const source = template && typeof template === "object" ? template : {};
    for (const [key, rawValue] of Object.entries(source)) {
      const value = cleanText(rawValue);
      if (value === "{{argId}}") {
        if (context?.argId !== undefined && context?.argId !== null) {
          params[key] = String(context.argId);
        }
        continue;
      }
      if (value === "{{stuId}}") {
        if (context?.stuId) {
          params[key] = String(context.stuId);
        }
        continue;
      }
      params[key] = String(rawValue);
    }
    return params;
  }

  async executeHttp(api, method, url, payload) {
    const normalizedMethod = cleanText(method).toUpperCase() || "POST";
    const normalizedUrl = normalizeExpectedUrl(url);
    if (!normalizedUrl) {
      throw makeError("Action has no endpoint mapping", 400, "BAD_REQUEST");
    }

    let response;
    if (normalizedMethod === "GET") {
      response = await api.get(normalizedUrl, { params: payload });
    } else {
      response = await api.post(normalizedUrl, { form: payload });
    }

    const raw = await response.text();
    let contentType = "";
    if (typeof response.headers === "function") {
      const headers = response.headers() || {};
      contentType = headers["content-type"] || headers["Content-Type"] || "";
    }

    return {
      response,
      raw,
      contentType: cleanText(contentType),
      method: normalizedMethod,
      url: normalizedUrl,
    };
  }

  buildResult({
    action,
    pageKey,
    actionId,
    method,
    url,
    response,
    raw,
    contentType = "",
    defaultMessage,
    extra = {},
  }) {
    const safeRaw = String(raw || "");
    const includeHtml = shouldIncludeHtml(action, url, contentType) && safeRaw.length <= 1_000_000;
    return {
      success: response.ok(),
      pageKey: cleanText(pageKey),
      actionId: cleanText(actionId),
      status: response.status(),
      method: cleanText(method).toUpperCase() || "POST",
      url: normalizeExpectedUrl(url),
      message: extractMessageFromResponse(safeRaw, defaultMessage),
      preview: cleanText(safeRaw).slice(0, 260),
      ...(contentType ? { contentType } : {}),
      ...(includeHtml ? { html: safeRaw } : {}),
      ...(extra && typeof extra === "object" ? extra : {}),
    };
  }

  async executeMutationAction({ action, pageKey, actionId, payload, api }) {
    const execution = action.execution || {};
    const method = cleanText(execution.method || "POST").toUpperCase() || "POST";
    const url = normalizeExpectedUrl(execution.url || "");
    const mutationPayload = this.buildMutationPayload(action, payload);

    const call = await this.executeHttp(api, method, url, mutationPayload);
    return this.buildResult({
      action,
      pageKey,
      actionId,
      method: call.method,
      url: call.url,
      response: call.response,
      raw: call.raw,
      contentType: call.contentType,
      defaultMessage: call.response.ok() ? "Action executed" : "Action failed",
      extra:
        action.kind === "table-row-action" || /print/i.test(cleanText(action.label))
          ? { printReady: true }
          : {},
    });
  }

  async executeNavigationAction({ actionRef, pageKey, actionId, payload, session, api }) {
    const action = actionRef.action || {};
    const execution = action.execution || {};
    const functionName = cleanText(execution.functionName || action?.controlRef?.functionName).toLowerCase();
    const args = Array.isArray(execution.args) ? execution.args : [];
    const targetId = Number(execution.targetId);

    if (Number.isFinite(targetId)) {
      const endpoint = this.resolveLoadDetailsEndpoint(targetId);
      if (endpoint) {
        const params = this.buildEndpointParams(endpoint.paramsTemplate, {
          argId: targetId,
          stuId: extractStudentId(session?.profileData),
        });
        const call = await this.executeHttp(api, endpoint.method || "POST", endpoint.url || "", params);
        return this.buildResult({
          action,
          pageKey,
          actionId,
          method: call.method,
          url: call.url,
          response: call.response,
          raw: call.raw,
          contentType: call.contentType,
          defaultMessage: call.response.ok() ? "Navigation data loaded" : "Navigation request failed",
          extra: { targetId },
        });
      }
    }

    if (functionName === "funearlierinternalmarks") {
      const helper = this.resolveHelperFunction("funEarlierInternalMarks");
      if (helper) {
        const semesterArg = Number(args[0] || payload?.argId || payload?.semester || payload?.filter || 1);
        const semester = Number.isFinite(semesterArg) ? Math.max(1, Math.trunc(semesterArg)) : 1;
        const params = this.buildEndpointParams(helper.paramsTemplate, {
          argId: semester,
          stuId: extractStudentId(session?.profileData),
        });
        const call = await this.executeHttp(api, helper.method || "POST", helper.url || "", params);
        return this.buildResult({
          action,
          pageKey,
          actionId,
          method: call.method,
          url: call.url,
          response: call.response,
          raw: call.raw,
          contentType: call.contentType,
          defaultMessage: call.response.ok()
            ? `Loaded semester ${semester} details`
            : "Unable to load semester details",
          extra: { semester, targetRoute: "/exams/earlier-semester-results" },
        });
      }
    }

    if (functionName === "funreturnhome") {
      return {
        success: true,
        pageKey: cleanText(pageKey),
        actionId: cleanText(actionId),
        status: 200,
        method: "NAVIGATE",
        url: "",
        message: "Redirecting to login",
        targetRoute: "/login",
      };
    }

    if (functionName === "funsapapplicationhistroy") {
      return {
        success: true,
        pageKey: cleanText(pageKey),
        actionId: cleanText(actionId),
        status: 200,
        method: "NAVIGATE",
        url: "",
        message: "Opening SAP registration history",
        targetRoute: "/registration/sap-registration",
      };
    }

    if (functionName === "funprintapplication") {
      const selectedRaw =
        cleanText(payload?.cmbExamMonth) ||
        cleanText(payload?.examMonthValue) ||
        cleanText(payload?.examSelection);
      const selected = parseExamMonthValue(selectedRaw);
      if (!selected) {
        throw makeError(
          "Select Exam Month and Year before printing application",
          400,
          "BAD_REQUEST"
        );
      }
      const url =
        `students/report/PrintStudentExamApplication.jsp?ExamMonth=${encodeURIComponent(selected.examMonth)}` +
        `&ExamYear=${encodeURIComponent(selected.examYear)}` +
        `&sid=${encodeURIComponent(selected.sid)}` +
        "&fnd=0";
      const call = await this.executeHttp(api, "GET", url, {});
      return this.buildResult({
        action,
        pageKey,
        actionId,
        method: call.method,
        url: call.url,
        response: call.response,
        raw: call.raw,
        contentType: call.contentType,
        defaultMessage: call.response.ok() ? "Printable application loaded" : "Unable to load print view",
        extra: { printReady: true },
      });
    }

    const form = this.resolveActionForm(actionRef);
    if (form && cleanText(form.action)) {
      const formPayload = this.buildFormPayload(form, payload);
      const call = await this.executeHttp(api, form.method || "POST", form.action, formPayload);
      return this.buildResult({
        action,
        pageKey,
        actionId,
        method: call.method,
        url: call.url,
        response: call.response,
        raw: call.raw,
        contentType: call.contentType,
        defaultMessage: call.response.ok() ? "Action completed" : "Action request failed",
      });
    }

    if (cleanText(execution.url)) {
      const call = await this.executeHttp(
        api,
        execution.method || "POST",
        execution.url,
        this.buildMutationPayload(action, payload)
      );
      return this.buildResult({
        action,
        pageKey,
        actionId,
        method: call.method,
        url: call.url,
        response: call.response,
        raw: call.raw,
        contentType: call.contentType,
        defaultMessage: call.response.ok() ? "Navigation request completed" : "Navigation request failed",
      });
    }

    throw makeError("Action navigation target is not mapped yet", 400, "ACTION_NOT_MAPPED");
  }

  async execute({ pageKey, actionId, payload, sessionId, expectedMethod, expectedUrl }) {
    const normalizedPageKey = cleanText(pageKey);
    const normalizedActionId = cleanText(actionId);

    if (!normalizedPageKey) {
      throw makeError("pageKey is required", 400, "BAD_REQUEST");
    }

    if (!normalizedActionId) {
      throw makeError("actionId is required", 400, "BAD_REQUEST");
    }

    if (!sessionId) {
      throw makeError("sessionId is required for action execution", 401, "UNAUTHORIZED");
    }

    if (!this.uiMapStore?.getHealth?.().loaded) {
      throw makeError("UI mapping unavailable", 503, "UI_MAP_UNAVAILABLE");
    }

    const actionRef = this.uiMapStore.getAction(normalizedPageKey, normalizedActionId);
    if (!actionRef) {
      throw makeError("Unknown actionId for pageKey", 404, "NOT_FOUND");
    }

    const action = actionRef.action || {};
    const supportedKinds = new Set(["mutation", "table-row-action", "navigation", "local-print"]);
    if (!supportedKinds.has(cleanText(action.kind))) {
      throw makeError("Action is not executable", 400, "BAD_REQUEST");
    }

    const execution = action.execution || {};
    const method = cleanText(execution.method || "POST").toUpperCase() || "POST";
    const url = normalizeExpectedUrl(execution.url || "");

    const expectedMethodNormalized = cleanText(expectedMethod).toUpperCase();
    if (expectedMethodNormalized && url && expectedMethodNormalized !== method) {
      throw makeError("Action method mismatch", 400, "BAD_REQUEST");
    }

    const expectedUrlNormalized = normalizeExpectedUrl(expectedUrl);
    if (expectedUrlNormalized && url && expectedUrlNormalized !== url) {
      throw makeError("Action endpoint mismatch", 400, "BAD_REQUEST");
    }

    if (!action.enabled && (action.kind === "mutation" || action.kind === "table-row-action")) {
      throw makeError(
        action.disabledReason || "Action blocked by policy",
        403,
        "FORBIDDEN"
      );
    }

    const session = await this.sessionStore.getOrThrow(sessionId);
    const api = await this.apiContextFactory(session.storageState);

    try {
      let result;
      if (action.kind === "mutation" || action.kind === "table-row-action") {
        result = await this.executeMutationAction({
          action,
          pageKey: normalizedPageKey,
          actionId: normalizedActionId,
          payload,
          api,
        });
      } else {
        result = await this.executeNavigationAction({
          actionRef,
          pageKey: normalizedPageKey,
          actionId: normalizedActionId,
          payload,
          session,
          api,
        });
      }

      if (typeof this.sessionStore.update === "function") {
        const storageState = await api.storageState();
        await this.sessionStore.update(sessionId, { storageState });
      }

      return result;
    } finally {
      await api.dispose();
    }
  }
}

module.exports = {
  ErpActionExecutor,
  normalizeExpectedUrl,
};

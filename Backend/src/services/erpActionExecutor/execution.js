const {
  cleanText,
  makeError,
  normalizeExpectedUrl,
  extractStudentId,
  parseExamMonthValue,
} = require("./utils");

const executionMethods = {
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
  },

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
  },

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
  },
};

module.exports = { executionMethods };

const { cleanText } = require("./utils");

const actionResolutionMethods = {
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
  },

  resolveLoadDetailsEndpoint(targetId) {
    const map = this.discoveryRepository?.raw?.functionMappings?.funLoadDetailsById;
    if (!map || typeof map !== "object") return null;
    const key = String(targetId);
    const endpoint = map[key];
    return endpoint && typeof endpoint === "object" ? endpoint : null;
  },

  resolveHelperFunction(functionName) {
    if (!this.discoveryRepository || typeof this.discoveryRepository.resolveHelperFunction !== "function") {
      return null;
    }
    return this.discoveryRepository.resolveHelperFunction(functionName);
  },

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
  },
};

module.exports = { actionResolutionMethods };

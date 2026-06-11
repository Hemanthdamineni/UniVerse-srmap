const {
  cleanText,
  slugify,
  normalizeMutationUrl,
} = require("./utils");
const {
  isAllowedMutationUrl,
  mutationBlockReason,
  sanitizeForm,
  inferredFunctionName,
  inferredActionKind,
  inferredArgs,
  findMutationForControl,
} = require("./actions");

const sectionBuilderMethods = {
  buildSectionHint(rawPage) {
    const dropdown = cleanText(rawPage?.dropdown);
    const subitem = cleanText(rawPage?.subitem);
    const sectionDisplayKey = cleanText(rawPage?.key) || `${dropdown}::${subitem}`;

    const forms = Array.isArray(rawPage?.ui?.forms) ? rawPage.ui.forms.map(sanitizeForm) : [];
    const controls = Array.isArray(rawPage?.ui?.controls) ? rawPage.ui.controls : [];
    const mutations = Array.isArray(rawPage?.integration?.mutations) ? rawPage.integration.mutations : [];

    const actions = [];
    let tableRowCursor = 0;

    controls.forEach((control, index) => {
      const actionId = `act-${slugify(sectionDisplayKey)}-${index + 1}`;
      const fnName = inferredFunctionName(control);
      const inferredKind = inferredActionKind(control);
      const args = inferredArgs(control);
      const mutation = findMutationForControl(control, mutations);
      const normalizedMutationUrl = normalizeMutationUrl(mutation?.url || "");

      let kind = "navigation";
      let execution = null;
      let enabled = true;
      let disabledReason;
      let tableRowIndex;
      let payloadDefaults;

      if (mutation) {
        kind = "mutation";
        execution = {
          kind: "mutation",
          method: cleanText(mutation?.method).toUpperCase() || "POST",
          url: normalizedMutationUrl || undefined,
        };

        if (isAllowedMutationUrl(normalizedMutationUrl)) {
          enabled = true;
        } else {
          enabled = false;
          disabledReason = mutationBlockReason(normalizedMutationUrl);
        }
      } else if (inferredKind === "load-details") {
        kind = "navigation";
        execution = {
          kind: "navigation",
          targetId: control?.inferredAction?.targetId,
        };
      } else if (/^print$/i.test(cleanText(control?.label))) {
        kind = "local-print";
        execution = {
          kind: "local-print",
          functionName: fnName || undefined,
          args: args.length ? args : undefined,
        };
      } else {
        kind = "navigation";
        execution = {
          kind: "navigation",
          functionName: fnName || undefined,
          args: args.length ? args : undefined,
        };
      }

      if (fnName.toLowerCase() === "funprint" && args.length > 0 && Number.isFinite(Number(args[0]))) {
        kind = "table-row-action";
        tableRowIndex = tableRowCursor;
        tableRowCursor += 1;
        payloadDefaults = {
          txnid: String(args[0]),
        };
        if (!execution && mutation) {
          execution = {
            kind: "mutation",
            method: cleanText(mutation?.method).toUpperCase() || "POST",
            url: normalizedMutationUrl || undefined,
          };
        }
      }

      if (fnName.toLowerCase() === "funsendotp") {
        kind = mutation ? kind : "mutation";
      }

      actions.push({
        id: actionId,
        label: cleanText(control?.label) || "Action",
        kind,
        enabled,
        disabledReason,
        pageSectionKey: sectionDisplayKey,
        formRef: cleanText(control?.formRef) || undefined,
        controlRef: {
          selectorHint: cleanText(control?.selectorHint) || undefined,
          functionName: fnName || undefined,
          args: args.length ? args : undefined,
        },
        execution,
        payloadDefaults,
        tableRowIndex,
      });
    });

    const executableCount = actions.filter((action) => action.kind === "mutation" && action.enabled).length;
    const blockedCount = actions.filter((action) => action.kind === "mutation" && !action.enabled).length;

    return {
      key: sectionDisplayKey,
      dropdown,
      subitem,
      pageHeading: cleanText(rawPage?.pageHeading) || subitem,
      forms,
      actions,
      capabilities: {
        hasForms: forms.length > 0,
        hasActions: actions.length > 0,
        executableActionCount: executableCount,
        blockedActionCount: blockedCount,
      },
    };
  },
};

module.exports = { sectionBuilderMethods };

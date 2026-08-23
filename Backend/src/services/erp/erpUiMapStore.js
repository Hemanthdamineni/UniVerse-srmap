const fs = require("fs");

// --- schemaQueries.js (utility) ---

const ERP_UI_SCHEMA_VERSION = "2026-03-13";

function normalizeBlockType(value) {
  return cleanText(value).toLowerCase();
}

function makeSectionRef(section) {
  return {
    key: cleanText(section?.key) || undefined,
    dropdown: cleanText(section?.dropdown) || undefined,
    subitem: cleanText(section?.subitem) || undefined,
  };
}

function hasFormActions(section) {
  const forms = Array.isArray(section?.forms) ? section.forms : [];
  if (!forms.length) return false;

  const formRefs = new Set(forms.map((form) => cleanText(form?.id)).filter(Boolean));
  const actions = Array.isArray(section?.actions) ? section.actions : [];
  return actions.some((action) => {
    const formRef = cleanText(action?.formRef);
    if (!formRef && forms.length === 1) return true;
    return formRefs.has(formRef);
  });
}

function summarizeBlockCounts(blocks) {
  return blocks.reduce(
    (acc, block) => {
      const type = normalizeBlockType(block?.type);
      if (type === "stats") acc.stats += 1;
      if (type === "card") acc.card += 1;
      if (type === "form") acc.form += 1;
      if (type === "table") acc.table += 1;
      if (type === "list") acc.list += 1;
      return acc;
    },
    { stats: 0, card: 0, form: 0, table: 0, list: 0 }
  );
}

const schemaQueryMethods = {
  getUiHints(pageKeyRaw) {
    const pageKey = normalizePageKey(pageKeyRaw);
    const sections = cloneJson(this.pageKeyToSections.get(pageKey) || []);

    const actionCounts = sections.reduce(
      (acc, section) => {
        for (const action of section.actions || []) {
          if (action.kind === "mutation" && action.enabled) acc.executable += 1;
          if (action.kind === "mutation" && !action.enabled) acc.blocked += 1;
        }
        return acc;
      },
      { executable: 0, blocked: 0 }
    );

    return {
      success: true,
      pageKey,
      sections,
      capabilities: {
        hasSections: sections.length > 0,
        executableActionCount: actionCounts.executable,
        blockedActionCount: actionCounts.blocked,
      },
      warnings: sections.length === 0 ? [`No UI semantic map sections for ${pageKey}`] : [],
    };
  },

  getRenderSchema(pageKeyRaw) {
    const uiHints = this.getUiHints(pageKeyRaw);
    const pageKey = uiHints.pageKey;
    const blocks = [];
    const warnings = Array.isArray(uiHints.warnings) ? uiHints.warnings.slice() : [];
    const seenIds = new Set();

    const pushBlock = (block) => {
      if (!block || typeof block !== "object") return;
      const id = cleanText(block.id);
      if (!id || seenIds.has(id)) return;
      seenIds.add(id);
      blocks.push(block);
    };

    pushBlock({
      id: `${slugify(pageKey || "page")}-stats`,
      type: "stats",
      sourcePageKey: pageKey,
      title: "Overview",
      visibleWhenEmpty: false,
    });

    for (const section of uiHints.sections || []) {
      const sectionIdBase = slugify(`${pageKey}:${section?.key || `${section?.dropdown}:${section?.subitem}`}`);
      const sectionRef = makeSectionRef(section);
      const forms = Array.isArray(section?.forms) ? section.forms : [];
      const hasForms = forms.length > 0;
      const hasActions = Array.isArray(section?.actions) && section.actions.length > 0;
      const hasInlineActions = hasActions && hasFormActions(section);

      pushBlock({
        id: `${sectionIdBase}-card`,
        type: "card",
        sourcePageKey: pageKey,
        section: sectionRef,
        showStatus: true,
        showDescription: true,
        showActions: hasActions,
      });

      if (hasForms) {
        pushBlock({
          id: `${sectionIdBase}-form`,
          type: "form",
          sourcePageKey: pageKey,
          section: sectionRef,
          showActions: hasInlineActions,
          visibleWhenEmpty: false,
        });
      }

      pushBlock({
        id: `${sectionIdBase}-table`,
        type: "table",
        sourcePageKey: pageKey,
        section: sectionRef,
        visibleWhenEmpty: false,
      });

      pushBlock({
        id: `${sectionIdBase}-list`,
        type: "list",
        sourcePageKey: pageKey,
        section: sectionRef,
        listKey: "links",
        visibleWhenEmpty: false,
      });
    }

    if (uiHints.sections.length === 0) {
      warnings.push(`No schema sections generated for ${pageKey}`);
    }

    const counts = summarizeBlockCounts(blocks);

    return {
      success: true,
      pageKey,
      schemaVersion: ERP_UI_SCHEMA_VERSION,
      blocks,
      capabilities: {
        hasBlocks: blocks.length > 0,
        blockCount: blocks.length,
        statsBlockCount: counts.stats,
        cardBlockCount: counts.card,
        formBlockCount: counts.form,
        tableBlockCount: counts.table,
        listBlockCount: counts.list,
      },
      warnings,
    };
  },

  getAction(pageKeyRaw, actionIdRaw) {
    const actionId = cleanText(actionIdRaw);
    if (!actionId) return null;

    const hints = this.getUiHints(pageKeyRaw);
    for (const section of hints.sections || []) {
      for (const action of section.actions || []) {
        if (cleanText(action.id) !== actionId) continue;

        return {
          pageKey: hints.pageKey,
          sectionKey: section.key,
          sectionDropdown: section.dropdown,
          sectionSubitem: section.subitem,
          forms: cloneJson(section.forms || []),
          actions: cloneJson(section.actions || []),
          action: cloneJson(action),
        };
      }
    }

    return null;
  },

  getHealth() {
    return {
      loaded: this.loaded,
      uiMapFile: this.uiMapFile,
      sectionCount: this.bySectionKey.size,
      mappedPageCount: this.pageKeyToSections.size,
      generatedAt: this.raw?.generatedAt || null,
    };
  },
};

// --- actions.js (utility) ---

function isAllowedMutationUrl(url) {
  const normalized = normalizeMutationUrl(url);
  if (!normalized) return false;

  const allowlist = new Set([
    "students/transaction/mobilenumberverificationotp.jsp",
    "students/transaction/studentattendanceresources.jsp",
    "students/transaction/studentsonlinepaymentresponse.jsp",
    "students/transaction/studentbankdetailsresource.jsp",
  ]);

  return allowlist.has(normalized);
}

function mutationBlockReason(url) {
  const normalized = normalizeMutationUrl(url);
  if (!normalized) return "Blocked in wave 1: unsupported mutation endpoint.";

  if (
    normalized.includes("students/onlinepayments/") ||
    normalized.includes("students/transaction/feedues.jsp")
  ) {
    return "Blocked in wave 1: payment and dues actions are disabled.";
  }

  if (normalized.includes("students/registrations/sap")) {
    return "Blocked in wave 1: SAP mutations are disabled.";
  }

  if (normalized.includes("qrcodescanner.jsp")) {
    return "Blocked in wave 1: QR scanner mutation is disabled.";
  }

  if (normalized.includes("studentbankdetailsresource.jsp")) {
    return null; // Allowed: bank details form submission
  }

  return "Blocked in wave 1: endpoint not allowlisted.";
}

function sanitizeField(field) {
  return {
    id: cleanText(field?.id) || undefined,
    name: cleanText(field?.name) || undefined,
    label: cleanText(field?.label) || undefined,
    tag: cleanText(field?.tag) || undefined,
    type: cleanText(field?.type) || "text",
    placeholder: cleanText(field?.placeholder) || undefined,
    helperText: cleanText(field?.helperText || field?.helpText || field?.description) || undefined,
    required: Boolean(field?.required),
    disabled: Boolean(field?.disabled),
    readOnly: Boolean(field?.readOnly),
    maxLength:
      typeof field?.maxLength === "number" && Number.isFinite(field.maxLength)
        ? field.maxLength
        : undefined,
    value: cleanText(field?.value) || undefined,
    options: Array.isArray(field?.options)
      ? field.options.slice(0, 40).map((option) => ({
          value: cleanText(option?.value),
          label: cleanText(option?.label),
          selected: Boolean(option?.selected),
        }))
      : undefined,
  };
}

function sanitizeForm(form) {
  return {
    id: cleanText(form?.id) || undefined,
    name: cleanText(form?.name) || undefined,
    method: cleanText(form?.method).toUpperCase() || "GET",
    action: cleanText(form?.action) || undefined,
    target: cleanText(form?.target) || undefined,
    autoComplete: cleanText(form?.autoComplete) || undefined,
    fields: Array.isArray(form?.fields) ? form.fields.map(sanitizeField) : [],
  };
}

function inferredFunctionName(control) {
  return cleanText(control?.inferredAction?.functionName || "");
}

function inferredActionKind(control) {
  return cleanText(control?.inferredAction?.kind || "");
}

function inferredArgs(control) {
  return Array.isArray(control?.inferredAction?.args) ? control.inferredAction.args : [];
}

function findMutationForControl(control, mutations) {
  const fnName = inferredFunctionName(control).toLowerCase();
  const label = cleanText(control?.label).toLowerCase();

  if (!mutations.length) return null;

  const direct = mutations.find((mutation) => cleanText(mutation?.fromFunction).toLowerCase() === fnName);
  if (direct) return direct;

  if (fnName === "funsendotp" || label.includes("send otp")) {
    const otpMutation = mutations.find(
      (mutation) => normalizeMutationUrl(mutation?.url) === "students/transaction/mobilenumberverificationotp.jsp"
    );
    if (otpMutation) return otpMutation;
  }

  if (fnName === "funprint") {
    const printMutation = mutations.find((mutation) =>
      normalizeMutationUrl(mutation?.url).includes("students/transaction/studentsonlinepaymentresponse.jsp")
    );
    if (printMutation) return printMutation;
  }

  if (label === "save") {
    const saveMutation = mutations.find((mutation) => /funsave/i.test(cleanText(mutation?.fromFunction)));
    if (saveMutation) return saveMutation;
  }

  return null;
}

// --- utils.js (utility) ---
function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizePageKey(value) {
  return cleanText(value).toLowerCase().replace(/^\/+/, "").replace(/\/+$/, "");
}

function normalizeSectionToken(value) {
  return cleanText(value).toLowerCase();
}

function normalizeSectionKey(dropdown, subitem) {
  return `${normalizeSectionToken(dropdown)}::${normalizeSectionToken(subitem)}`;
}

function slugify(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function normalizeMutationUrl(url) {
  let value = cleanText(url);
  if (!value) return "";

  value = value.replace(/^https?:\/\/[^/]+/i, "");
  value = value.replace(/^\/+/, "");
  if (value.toLowerCase().startsWith("srmapstudentcorner/")) {
    value = value.slice("srmapstudentcorner/".length);
  }

  return value;
}

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

// --- sectionBuilder.js ---

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

// --- class ---

class ErpUiMapStore {
  constructor({ uiMapFile, scrapeTargets }) {
    this.uiMapFile = uiMapFile;
    this.scrapeTargets = scrapeTargets || {};

    this.raw = null;
    this.loaded = false;
    this.bySectionKey = new Map();
    this.pageKeyToSections = new Map();

    this.reload();
  }

  reload() {
    this.bySectionKey.clear();
    this.pageKeyToSections.clear();
    this.raw = null;
    this.loaded = false;

    if (!this.uiMapFile || !fs.existsSync(this.uiMapFile)) {
      return;
    }

    this.raw = JSON.parse(fs.readFileSync(this.uiMapFile, "utf8"));
    const pages = Array.isArray(this.raw?.pages) ? this.raw.pages : [];

    for (const page of pages) {
      const dropdown = cleanText(page?.dropdown);
      const subitem = cleanText(page?.subitem);
      if (!dropdown || !subitem) continue;

      const sectionKey = normalizeSectionKey(dropdown, subitem);
      this.bySectionKey.set(sectionKey, this.buildSectionHint(page));
    }

    for (const [pageKeyRaw, targets] of Object.entries(this.scrapeTargets)) {
      const pageKey = normalizePageKey(pageKeyRaw);
      const sectionHints = [];

      for (const target of Array.isArray(targets) ? targets : []) {
        const sectionKey = normalizeSectionKey(target?.dropdown, target?.subitem);
        const hint = this.bySectionKey.get(sectionKey);
        if (!hint) continue;
        sectionHints.push(cloneJson(hint));
      }

      const deduped = [];
      const seen = new Set();
      for (const section of sectionHints) {
        const fingerprint = `${normalizeSectionToken(section.dropdown)}::${normalizeSectionToken(section.subitem)}`;
        if (seen.has(fingerprint)) continue;
        seen.add(fingerprint);
        deduped.push(section);
      }

      this.pageKeyToSections.set(pageKey, deduped);
    }

    this.loaded = true;
  }
}

Object.assign(
  ErpUiMapStore.prototype,
  sectionBuilderMethods,
  schemaQueryMethods
);

module.exports = {
  ErpUiMapStore,
  ERP_UI_SCHEMA_VERSION,
  normalizePageKey,
  normalizeSectionKey,
  normalizeMutationUrl,
  isAllowedMutationUrl,
  mutationBlockReason,
};

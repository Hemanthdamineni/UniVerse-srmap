const {
  cleanText,
  normalizePageKey,
  normalizeSectionToken,
  slugify,
  cloneJson,
} = require("./utils");

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

module.exports = {
  ERP_UI_SCHEMA_VERSION,
  schemaQueryMethods,
};

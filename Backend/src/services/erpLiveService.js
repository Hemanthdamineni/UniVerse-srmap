const {
  createApiContext,
  fetchProfileViaApi,
  callEndpointViaApi,
} = require("./erpClient");
const {
  buildCgpaSummaryPayload,
  extractCgpaSummaryFromHtml,
  extractSemesterLabelFromProfile,
  extractSemesterNumber,
} = require("./cgpaSummary");

const PER_PAGE_TARGET_CONCURRENCY = 4;

function extractStudentId(profileData) {
  const table = profileData?.TableContent || {};
  const entries = Object.entries(table);

  const candidates = entries.filter(([key]) =>
    /student\s*id/i.test(key) || /\bstu\s*id\b/i.test(key)
  );

  for (const [, value] of candidates) {
    const match = String(value || "").match(/\b(\d{3,})\b/);
    if (match) return Number(match[1]);
  }

  return null;
}

async function mapWithConcurrency(items, limit, worker) {
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 1, items.length || 1));
  const results = new Array(items.length);
  let cursor = 0;

  async function runner() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: normalizedLimit }, () => runner()));
  return results;
}

class ErpLiveService {
  constructor({ sessionStore, discoveryRepository, scrapeTargets }) {
    this.sessionStore = sessionStore;
    this.discoveryRepository = discoveryRepository;
    this.scrapeTargets = scrapeTargets;
  }

  async fetchProfile(sessionId) {
    const session = await this.sessionStore.getOrThrow(sessionId);
    const api = await createApiContext(session.storageState);

    try {
      const profileData = await fetchProfileViaApi(api);
      const nextStorageState = await api.storageState();
      await this.sessionStore.update(sessionId, {
        profileData,
        storageState: nextStorageState,
      });
      return profileData;
    } finally {
      await api.dispose();
    }
  }

  async scrapeByKey(sessionId, pageKey) {
    if (pageKey === "academic/cgpa-summary") {
      return this.fetchCgpaSummary(sessionId);
    }

    const targets = this.scrapeTargets[pageKey];
    if (!targets) {
      const error = new Error(`Unknown pageKey: ${pageKey}`);
      error.status = 404;
      error.code = "NOT_FOUND";
      throw error;
    }

    if (pageKey !== "profile" && (!Array.isArray(targets) || targets.length === 0)) {
      const error = new Error(`No scrape targets configured for "${pageKey}"`);
      error.status = 502;
      error.code = "PAGE_TARGETS_EMPTY";
      throw error;
    }

    const session = await this.sessionStore.getOrThrow(sessionId);
    const stuId = extractStudentId(session.profileData);
    const variables = stuId ? { stuId } : null;

    if (pageKey === "profile") {
      return this.fetchProfile(sessionId);
    }

    const api = await createApiContext(session.storageState);
    try {
      const groupedResult = {};
      const resolvedTargets = targets.map((target) => {
        const endpoint = this.discoveryRepository.resolveEndpoint(target.dropdown, target.subitem);
        if (!endpoint) {
          const error = new Error(
            `No endpoint mapping for ${target.dropdown} -> ${target.subitem || "(empty)"}`
          );
          error.status = 502;
          error.code = "MISSING_ENDPOINT_MAPPING";
          throw error;
        }

        return {
          target,
          endpoint,
          key: target.subitem && target.subitem.trim() ? target.subitem : target.dropdown,
        };
      });

      const resolvedPayloads = await mapWithConcurrency(
        resolvedTargets,
        Math.min(PER_PAGE_TARGET_CONCURRENCY, resolvedTargets.length || 1),
        async ({ target, endpoint }) =>
          callEndpointViaApi(api, endpoint, target, variables)
      );

      resolvedTargets.forEach(({ target, key }, index) => {
        if (!groupedResult[target.dropdown]) {
          groupedResult[target.dropdown] = {};
        }
        groupedResult[target.dropdown][key] = resolvedPayloads[index];
      });

      const nextStorageState = await api.storageState();
      await this.sessionStore.update(sessionId, { storageState: nextStorageState });
      return groupedResult;
    } finally {
      await api.dispose();
    }
  }

  async fetchEarlierInternalMarksSemester(sessionId, semesterNumber) {
    const semester = Number.parseInt(String(semesterNumber || ""), 10);
    if (!Number.isInteger(semester) || semester <= 0) {
      const error = new Error("Valid semester number is required");
      error.status = 400;
      throw error;
    }

    const session = await this.sessionStore.getOrThrow(sessionId);
    const stuId = extractStudentId(session.profileData);
    const variables = {
      argId: semester,
      ...(stuId ? { stuId } : {}),
    };

    const discoveredEndpoint =
      this.discoveryRepository.resolveHelperFunction("funEarlierInternalMarks");

    const endpoint = discoveredEndpoint || {
      method: "POST",
      url: "students/report/studentreportresources.jsp",
      paramsTemplate: {
        ids: "23",
        filter: "{{argId}}",
      },
      sourceFunction: "funEarlierInternalMarks",
    };

    const api = await createApiContext(session.storageState);
    try {
      const parsed = await callEndpointViaApi(
        api,
        endpoint,
        {
          dropdown: "Examination",
          subitem: `Semester ${semester}`,
        },
        variables
      );

      const nextStorageState = await api.storageState();
      await this.sessionStore.update(sessionId, { storageState: nextStorageState });
      return parsed;
    } finally {
      await api.dispose();
    }
  }

  async fetchCgpaSummary(sessionId) {
    const session = await this.sessionStore.getOrThrow(sessionId);
    const endpoint =
      this.discoveryRepository.resolveEndpoint("Examination", "Exam Mark Details") || {
        method: "POST",
        url: "students/report/studentreportresources.jsp",
        paramsTemplate: { ids: "6" },
        argId: 6,
      };

    const api = await createApiContext(session.storageState);
    try {
      const parsed = await callEndpointViaApi(
        api,
        endpoint,
        {
          dropdown: "Academic",
          subitem: "CGPA Summary",
        }
      );

      const nextStorageState = await api.storageState();
      await this.sessionStore.update(sessionId, { storageState: nextStorageState });

      const semesterLabel = extractSemesterLabelFromProfile(session.profileData);
      const cgpaSummary = extractCgpaSummaryFromHtml(parsed.rawHtml || parsed.text || "");
      const semesterNumber = extractSemesterNumber(semesterLabel);

      return buildCgpaSummaryPayload({
        cgpa: cgpaSummary.cgpa,
        semesterLabel,
        semesterNumber,
        sourceText: cgpaSummary.sourceText,
      });
    } finally {
      await api.dispose();
    }
  }
}

module.exports = {
  ErpLiveService,
  extractStudentId,
};

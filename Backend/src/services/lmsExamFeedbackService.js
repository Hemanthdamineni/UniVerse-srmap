class LmsExamFeedbackService {
  constructor({ lmsStore, erpAggregationService }) {
    this.lmsStore = lmsStore;
    this.erpAggregationService = erpAggregationService;
  }

  async getPendingFeedback({ userId, sessionId }) {
    let currentSemester = "";
    if (this.erpAggregationService && sessionId) {
      try {
        const batch = await this.erpAggregationService.getBatch({
          pageKeys: ["examination/current-semester-results"],
          sessionId,
        });
        const payload = batch["examination/current-semester-results"]?.data || {};
        currentSemester = this.extractCurrentSemester(payload);
      } catch {
        currentSemester = "";
      }
    }

    return this.lmsStore.getPendingExamFeedback({
      userId,
      semester: currentSemester,
    });
  }

  extractCurrentSemester(payload) {
    const tables = payload?.Examination?.["Current Semester Results"]?.tables;
    if (!Array.isArray(tables)) return "";
    for (const table of tables) {
      if (!Array.isArray(table)) continue;
      for (const row of table) {
        const semester = String(row?.Semester || "").trim();
        if (semester) return semester;
      }
    }
    return "";
  }
}

module.exports = {
  LmsExamFeedbackService,
};

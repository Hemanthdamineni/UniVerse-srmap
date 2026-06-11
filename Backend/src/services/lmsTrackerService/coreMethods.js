const { ensureObject } = require("./utils");
const { buildCareerReadiness } = require("./careerReadiness");
const { extractAttendanceRecords, normalizeHistoricalSgpa, readEarnedCreditsConfig } = require("./academicSignals");

module.exports = {
  async _loadBatch(sessionId) {
    if (!sessionId) {
      const error = new Error("Authentication required");
      error.status = 401;
      error.code = "UNAUTHORIZED";
      throw error;
    }

    const batch = await this.erpAggregationService.getBatch({
      sessionId,
      pageKeys: [
        "examination/exam-mark-details",
        "examination/current-semester-results",
        "academic/attendance-details",
        "academic/cgpa-summary",
      ],
    });

    return {
      examMarkRaw: batch["examination/exam-mark-details"]?.data || null,
      currentRaw: batch["examination/current-semester-results"]?.data || null,
      attendanceRaw: batch["academic/attendance-details"]?.data || null,
      cgpaRaw: batch["academic/cgpa-summary"]?.data || null,
    };
  },

  _buildOverviewFromBatch({ examMarkRaw, currentRaw, attendanceRaw, cgpaRaw, user = null }) {
    const creditSummary = readEarnedCreditsConfig(cgpaRaw);
    const gpaTrend = normalizeHistoricalSgpa(examMarkRaw, currentRaw);
    const attendanceRecords = extractAttendanceRecords(attendanceRaw);
    const attendancePct = attendanceRecords.length
      ? (
          attendanceRecords.reduce((sum, record) => sum + Number(record.attendancePct || 0), 0) /
          attendanceRecords.length
        ).toFixed(1)
      : "0.0";

    const overview = {
      completedCredits: creditSummary.completedCredits,
      requiredCredits: creditSummary.requiredCredits,
      currentCgpa: creditSummary.currentCgpa,
      progressPercent: Math.min(
        100,
        Math.round((creditSummary.completedCredits / creditSummary.requiredCredits) * 100)
      ),
      semesters: gpaTrend.map((item) => ({
        semester: item.semester,
        label: item.label,
        credits: item.credits,
        sgpa: item.sgpa.toFixed(2),
        status: item.status,
      })),
      attendancePct,
      subjectsAtRisk: attendanceRecords.filter((record) => record.attendancePct > 0 && record.attendancePct < 75)
        .length,
      attendanceRecords,
    };

    overview.careerReadiness = buildCareerReadiness({
      careerStore: this.careerStore,
      user,
      academicSignals: {
        currentCgpa: overview.currentCgpa,
        progressPercent: overview.progressPercent,
        attendancePct: overview.attendancePct,
        subjectsAtRisk: overview.subjectsAtRisk,
      },
    });

    return overview;
  },

  _buildSourceStatus(batch) {
    return {
      examMarks: Boolean(batch.examMarkRaw),
      currentResults: Boolean(batch.currentRaw),
      attendance: Boolean(batch.attendanceRaw),
      cgpa: Boolean(batch.cgpaRaw),
      careerStore: Boolean(this.careerStore),
    };
  },

  _summarizeSnapshot(snapshot) {
    const payload = ensureObject(snapshot.payload);
    return {
      id: snapshot.id,
      snapshotType: snapshot.snapshotType,
      createdAt: snapshot.createdAt,
      inputsHash: snapshot.inputsHash,
      sourceStatus: snapshot.sourceStatus,
      summary: {
        currentCgpa: payload.currentCgpa || payload.overview?.currentCgpa || "",
        progressPercent: payload.progressPercent ?? payload.overview?.progressPercent ?? null,
        subjectsAtRisk: payload.subjectsAtRisk ?? payload.overview?.subjectsAtRisk ?? null,
        careerAvailable: Boolean(payload.careerReadiness?.available),
      },
    };
  },

  _persistSnapshot({ user, snapshotType, payload, sourceStatus }) {
    if (!this.trackerStore || !user?.userId) return null;
    return this.trackerStore.saveSnapshot({
      userId: user.userId,
      snapshotType,
      payload,
      sourceStatus,
    });
  },

  _getSnapshotHistory(user, snapshotType, limit = 5) {
    if (!this.trackerStore || !user?.userId) return [];
    return this.trackerStore
      .listSnapshots(user.userId, { snapshotType, limit })
      .map((snapshot) => this._summarizeSnapshot(snapshot));
  }
};

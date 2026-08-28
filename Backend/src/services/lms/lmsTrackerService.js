const { extractSemesterNumber } = require("../erp/erpServices");

// --- careerReadiness.js (utility) ---

function scoreCareerProfile(profile) {
  const skills = uniqueStrings(profile.skills);
  const preferredTypes = uniqueStrings(profile.preferredTypes);
  const preferredLocations = uniqueStrings(profile.preferredLocations);
  const checks = [
    {
      key: "skills",
      label: "Skills listed",
      value: skills.length >= 3 ? 25 : skills.length > 0 ? 15 : 0,
      max: 25,
      missing: skills.length >= 3 ? "" : "Add at least three current skills.",
    },
    {
      key: "resume",
      label: "Resume uploaded",
      value: profile.resumeUrl || profile.resumeFileName ? 20 : 0,
      max: 20,
      missing: profile.resumeUrl || profile.resumeFileName ? "" : "Upload a current resume.",
    },
    {
      key: "bio",
      label: "Career summary",
      value: toSafeString(profile.bio).length >= 80 ? 15 : toSafeString(profile.bio) ? 8 : 0,
      max: 15,
      missing: toSafeString(profile.bio).length >= 80 ? "" : "Add a focused career summary.",
    },
    {
      key: "links",
      label: "Portfolio links",
      value: [profile.linkedinUrl, profile.githubUrl, profile.portfolioUrl].filter((item) => toSafeString(item)).length * 5,
      max: 15,
      missing:
        [profile.linkedinUrl, profile.githubUrl, profile.portfolioUrl].some((item) => toSafeString(item))
          ? ""
          : "Add LinkedIn, GitHub, or portfolio links.",
    },
    {
      key: "preferences",
      label: "Opportunity preferences",
      value: preferredTypes.length || preferredLocations.length || toSafeString(profile.minStipend) ? 25 : 0,
      max: 25,
      missing:
        preferredTypes.length || preferredLocations.length || toSafeString(profile.minStipend)
          ? ""
          : "Set preferred opportunity types, locations, or stipend expectations.",
    },
  ];

  const score = checks.reduce((sum, item) => sum + Math.min(item.max, item.value), 0);
  return {
    score,
    completed: checks.filter((item) => item.value >= item.max).map((item) => item.label),
    missing: checks.map((item) => item.missing).filter(Boolean),
    breakdown: checks.map(({ key, label, value, max }) => ({ key, label, score: Math.min(max, value), max })),
  };
}

function scoreResume(profile, academicSignals) {
  const profileScore = scoreCareerProfile(profile);
  const skills = uniqueStrings(profile.skills);
  const hasResume = Boolean(profile.resumeUrl || profile.resumeFileName);
  const cgpa = Number.parseFloat(String(academicSignals.currentCgpa || profile.cgpa || 0));
  const breakdown = [
    { label: "Resume file", score: hasResume ? 25 : 0, max: 25 },
    { label: "Skills evidence", score: Math.min(25, skills.length * 5), max: 25 },
    { label: "Profile completeness", score: Math.round(profileScore.score * 0.25), max: 25 },
    { label: "Academic signal", score: Number.isFinite(cgpa) && cgpa >= 7 ? 25 : Number.isFinite(cgpa) && cgpa > 0 ? 15 : 0, max: 25 },
  ];
  const score = breakdown.reduce((sum, item) => sum + item.score, 0);
  return {
    score,
    hasResume,
    breakdown,
    suggestions: [
      ...(hasResume ? [] : ["Upload a current resume before applying."]),
      ...(skills.length >= 5 ? [] : ["Add more role-specific skills to improve matching."]),
      ...(Number.isFinite(cgpa) && cgpa >= 7 ? [] : ["Keep academic performance context up to date for eligibility checks."]),
    ],
  };
}

function buildCareerReadiness({ careerStore, user, academicSignals }) {
  const unavailable = {
    available: false,
    profileCompleteness: { score: 0, completed: [], missing: ["Career profile data unavailable."], breakdown: [] },
    resumeScore: { score: 0, hasResume: false, breakdown: [], suggestions: ["Connect career profile data."] },
    skillGaps: [],
    recommendedOpportunities: [],
    nextActions: ["Update your career profile so academic recommendations can include opportunity matching."],
    inputsUsed: {
      careerProfile: false,
      skillGaps: 0,
      opportunities: 0,
      applications: 0,
      academicSignals: Object.keys(academicSignals || {}).filter((key) => academicSignals[key] !== undefined),
    },
  };

  if (!careerStore || !user?.userId) return unavailable;

  try {
    const profile = careerStore.getProfile(user);
    const profileSkills = uniqueStrings(profile.skills);
    const profileSkillSet = new Set(profileSkills.map(normalizeSkill));
    const skillGaps = ensureArray(careerStore.getSkillGaps(user)).slice(0, 5).map((gap) => ({
      skill: toSafeString(gap.skill),
      opportunityCount: Number(gap.opportunityCount || 0),
      gapLevel: toSafeString(gap.gapLevel || "missing"),
      reason: `${toSafeString(gap.skill)} appears in ${Number(gap.opportunityCount || 0)} active opportunity match(es) but is not in the profile.`,
    }));
    const opportunities = ensureArray(
      careerStore.getOpportunities({
        user,
        sort: "relevance",
        page: 1,
        limit: 5,
      })
    );
    const applications = typeof careerStore.getApplications === "function" ? ensureArray(careerStore.getApplications(user.userId)) : [];
    const profileCompleteness = scoreCareerProfile(profile);
    const resumeScore = scoreResume(profile, academicSignals);

    const recommendedOpportunities = opportunities.slice(0, 5).map((opportunity) => {
      const opportunitySkills = uniqueStrings(opportunity.skills || parseJsonArray(opportunity.skills));
      const matchedSkills = opportunitySkills.filter((skill) => profileSkillSet.has(normalizeSkill(skill)));
      const missingSkills = opportunitySkills.filter((skill) => !profileSkillSet.has(normalizeSkill(skill))).slice(0, 4);
      return {
        id: opportunity.id,
        title: opportunity.title,
        type: opportunity.type,
        organization: opportunity.company || opportunity.organization || opportunity.organizer || "",
        deadline: opportunity.deadline || "",
        eligibleBranches: Array.isArray(opportunity.eligibleBranches)
          ? opportunity.eligibleBranches
          : parseJsonArray(opportunity.eligibleBranches),
        eligibleYears: Array.isArray(opportunity.eligibleYears)
          ? opportunity.eligibleYears
          : parseJsonArray(opportunity.eligibleYears),
        matchedSkills,
        missingSkills,
        confidence: Math.max(0.35, Math.min(0.95, 0.45 + matchedSkills.length * 0.1 - missingSkills.length * 0.03)),
        reasons: [
          matchedSkills.length ? `Matches ${matchedSkills.length} profile skill(s).` : "Relevant active opportunity from the career catalog.",
          missingSkills.length ? `Missing skills to close: ${missingSkills.join(", ")}.` : "No major skill gap detected from listed skills.",
        ],
        inputsUsed: ["careerProfile.skills", "careerOpportunities.skills", "careerEligibility"],
      };
    });

    const nextActions = [
      ...(resumeScore.hasResume ? [] : ["Upload a resume before applying to recommended roles."]),
      ...(skillGaps[0] ? [`Start with ${skillGaps[0].skill}; it maps to ${skillGaps[0].opportunityCount} active opportunity match(es).`] : []),
      ...(recommendedOpportunities[0] ? [`Review ${recommendedOpportunities[0].title} and decide whether to save or apply.`] : []),
      ...(applications.length ? ["Update application statuses so recommendations learn from outcomes."] : ["Track applications after applying so future recommendations can adapt."]),
    ];

    return {
      available: true,
      profileCompleteness,
      resumeScore,
      skillGaps,
      recommendedOpportunities,
      nextActions: nextActions.slice(0, 4),
      inputsUsed: {
        careerProfile: true,
        skillGaps: skillGaps.length,
        opportunities: recommendedOpportunities.length,
        applications: applications.length,
        academicSignals: Object.keys(academicSignals || {}).filter((key) => academicSignals[key] !== undefined),
      },
    };
  } catch (error) {
    return {
      ...unavailable,
      error: error?.message || "Career readiness could not be computed.",
    };
  }
}

// --- academicSignals.js (utility) ---

function readEarnedCreditsConfig(cgpaData) {
  const defaultReq = 160;
  const result = { requiredCredits: defaultReq, completedCredits: 0, currentCgpa: "0.00" };
  if (!cgpaData || typeof cgpaData !== "object") return result;

  // fetchCgpaSummary shape: { Academic: { "CGPA Summary": { text, TableContent, tables, meta } } }
  const summary = ensureObject(ensureObject(cgpaData.Academic)["CGPA Summary"]);
  const cgpaCandidate = toSafeString(
    ensureObject(summary.meta).cgpa || ensureObject(summary.TableContent)["Current CGPA"] || ""
  );
  const cgpaMatch = cgpaCandidate.match(/(\d{1,2}(?:\.\d{1,3})?)/);
  if (cgpaMatch) {
    const parsed = Number.parseFloat(cgpaMatch[1]);
    if (Number.isFinite(parsed) && parsed > 0) result.currentCgpa = parsed.toFixed(2);
  } else {
    const textMatch = toSafeString(summary.text).match(
      /c\.?\s*g\.?\s*p\.?\s*a\.?\s*[:\-]?\s*(\d{1,2}(?:\.\d{1,3})?)/i
    );
    if (textMatch) {
      const parsed = Number.parseFloat(textMatch[1]);
      if (Number.isFinite(parsed) && parsed > 0) result.currentCgpa = parsed.toFixed(2);
    }
  }

  // Raw SRM Table shape fallback; also the only source of an explicit earned-credits figure
  const records = Array.isArray(cgpaData) ? cgpaData : ensureArray(cgpaData.Table);
  for (const row of records) {
    if (!row || typeof row !== "object") continue;
    const serialized = JSON.stringify(row).toLowerCase();
    if (serialized.includes("earned") && serialized.includes("credit")) {
      const match = serialized.match(/(?:value|text|:)\s*"?(\d+)/i);
      if (match) result.completedCredits = Number.parseInt(match[1] || "0", 10) || 0;
    }
    if (result.currentCgpa === "0.00" && serialized.includes("cgpa")) {
      const match = serialized.match(/(?:value|text|:)\s*"?(\d\.\d+)/i);
      if (match) result.currentCgpa = Number.parseFloat(match[1] || "0").toFixed(2);
    }
  }

  return result;
}

function extractAttendanceRecords(attendanceRaw) {
  const details = ensureObject(ensureObject(attendanceRaw).Academic)["Attendance Details"];
  const tables = ensureArray(ensureObject(details).tables);
  const targetTable = tables.find((table) => Array.isArray(table) && table.length > 2);
  const records = [];

  for (const row of ensureArray(targetTable)) {
    if (!row || typeof row !== "object") continue;
    const subjectCode = toSafeString(row["Subject Code"]);
    if (!subjectCode || !/^[A-Z]{2,5}\s*\d{3,4}[A-Z]?$/i.test(subjectCode)) continue;

    records.push({
      subjectCode,
      subjectDescription: toSafeString(row["Subject Description"]),
      attendancePct: toNumber(row["Attendance %"] ?? row["Attendance\n%"]),
      classesConducted: toNumber(row.ClassesConducted ?? row["Classes Conducted"]),
      present: toNumber(row["Present(P)"] ?? row["Present (P)"]),
    });
  }

  return records;
}

function extractCurrentResultSummary(currentRaw) {
  const root = ensureObject(currentRaw);
  const section =
    ensureObject(ensureObject(root.Examination)["Current Semester Results"]).tables !== undefined
      ? ensureObject(ensureObject(root.Examination)["Current Semester Results"])
      : root;
  const text = toSafeString(section.text);
  const sgpaMatch = text.match(/S\.G\.P\.A\s+([\d.]+)/i);
  const subjects = [];
  const table = ensureArray(ensureArray(section.tables)[0]);

  for (const row of table) {
    if (!row || typeof row !== "object") continue;
    const semester = toSafeString(row.Semester);
    const subjectCode = toSafeString(row["Subject Code"]);
    if (!semester || !subjectCode) continue;
    if (semester.toUpperCase() === "S.G.P.A") continue;
    if (semester.toLowerCase().includes("disclaimer")) continue;

    subjects.push({
      semester,
      subjectCode,
      subjectDescription: toSafeString(row["Subject Description"]),
      credit: toSafeString(row.Credit),
      grade: toSafeString(row.Grade).toUpperCase(),
      result: toSafeString(row.Result),
    });
  }

  return {
    sgpa: sgpaMatch ? toSafeString(sgpaMatch[1]) : "",
    subjects,
  };
}

function parseExamMarkDetailsRows(examMarkRaw) {
  const section = ensureObject(ensureObject(examMarkRaw).Examination)["Exam Mark Details"];
  const tables = ensureArray(ensureObject(section).tables);
  const rows = [];

  for (const table of tables) {
    for (const row of ensureArray(table)) {
      if (!row || typeof row !== "object") continue;
      const semester = toNumber(row.Semester || row.semester || row.col1, 0);
      const subjectCode = toSafeString(row["Subject Code"] || row.subjectCode || row.Code || row.col3);
      const subjectDescription = toSafeString(
        row["Subject Description"] || row.subjectDescription || row.Description || row.col4
      );
      const grade = toSafeString(row.Grade || row.grade || row["Grade/Marks"] || row.col6).toUpperCase();
      const credit = toNumber(row.Credit || row.credit || row.col5, 0);

      if (!semester || !subjectCode) continue;
      rows.push({ semester, subjectCode, subjectDescription, grade, credit });
    }
  }

  return rows;
}

function normalizeHistoricalSgpa(examMarkRaw, currentRaw) {
  const semesters = new Map();
  const historicalRows = parseExamMarkDetailsRows(examMarkRaw);

  for (const row of historicalRows) {
    if (!semesters.has(row.semester)) {
      semesters.set(row.semester, { credits: 0, points: 0 });
    }
    const bucket = semesters.get(row.semester);
    const points = GRADE_POINTS[row.grade] || 0;
    if (points > 0 && row.credit > 0) {
      bucket.credits += row.credit;
      bucket.points += points * row.credit;
    }
  }

  const currentSummary = extractCurrentResultSummary(currentRaw);
  if (currentSummary.sgpa) {
    const semesterLabel = ensureArray(currentSummary.subjects)[0]?.semester || "";
    const semesterNumber = extractSemesterNumber(semesterLabel) || semesters.size + 1;
    if (!semesters.has(semesterNumber)) {
      semesters.set(semesterNumber, { credits: 0, points: 0, sgpa: currentSummary.sgpa });
    } else {
      semesters.get(semesterNumber).sgpa = currentSummary.sgpa;
    }
  }

  return Array.from(semesters.entries())
    .map(([semester, data]) => ({
      semester,
      label: `Sem ${semester}`,
      credits: Number(data.credits || 0),
      sgpa: data.sgpa ? Number.parseFloat(String(data.sgpa)) : data.credits > 0 ? data.points / data.credits : 0,
      status: data.credits > 0 || data.sgpa ? "Completed" : "In Progress",
    }))
    .filter((item) => Number.isFinite(item.sgpa) && item.sgpa > 0)
    .sort((left, right) => left.semester - right.semester);
}

function flattenHistoricalResults(examMarkRaw, currentRaw) {
  const records = [];
  const historicalRows = parseExamMarkDetailsRows(examMarkRaw);
  for (const row of historicalRows) {
    records.push({
      semester: `Semester ${row.semester}`,
      subjectCode: row.subjectCode,
      subjectDescription: row.subjectDescription,
      grade: row.grade,
      credit: row.credit,
    });
  }

  const current = extractCurrentResultSummary(currentRaw);
  for (const item of current.subjects) {
    records.push({
      semester: item.semester,
      subjectCode: item.subjectCode,
      subjectDescription: item.subjectDescription,
      grade: item.grade,
      credit: toNumber(item.credit),
    });
  }

  return records;
}

function inferCategory(subject) {
  const haystack = `${subject.subjectCode} ${subject.subjectDescription}`.toLowerCase();
  if (/lab|practical/.test(haystack)) return "Lab & Practicals";
  if (/mat|math|algebra|calculus|statistics/.test(haystack)) return "Mathematics";
  if (/physics|chemistry|biology|science/.test(haystack)) return "Science Electives";
  if (/human|social|english|communication|economics|management/.test(haystack)) {
    return "Humanities & Social";
  }
  if (/elective/.test(haystack)) return "Open Electives";
  return "Core Engineering";
}

function buildCategoryPerformance(resultRows) {
  const buckets = new Map();

  for (const row of resultRows) {
    const category = inferCategory(row);
    if (!buckets.has(category)) {
      buckets.set(category, {
        category,
        subjects: 0,
        totalPoints: 0,
        grades: [],
      });
    }
    const bucket = buckets.get(category);
    bucket.subjects += 1;
    bucket.totalPoints += GRADE_POINTS[row.grade] || 0;
    if (row.grade) bucket.grades.push(row.grade);
  }

  return Array.from(buckets.values())
    .map((bucket) => ({
      category: bucket.category,
      subjects: bucket.subjects,
      avgGrade: bucket.grades[0] || "-",
      avgGpa: bucket.subjects ? Number((bucket.totalPoints / bucket.subjects).toFixed(2)) : 0,
    }))
    .sort((left, right) => right.avgGpa - left.avgGpa);
}

function buildRecommendations({ gpaTrend, attendanceRecords, categoryPerformance, progressPercent }) {
  const recommendations = [];
  const atRisk = attendanceRecords.filter((record) => record.attendancePct > 0 && record.attendancePct < 75);
  const weakestCategory = [...categoryPerformance].sort((left, right) => left.avgGpa - right.avgGpa)[0];

  if (atRisk.length > 0) {
    recommendations.push({
      title: "Attendance Warning",
      description: `${atRisk.length} subject${atRisk.length > 1 ? "s are" : " is"} below the 75% attendance line. Prioritize those classes first.`,
      type: "warning",
    });
  }

  if (weakestCategory) {
    recommendations.push({
      title: `Strengthen ${weakestCategory.category}`,
      description: `${weakestCategory.category} is your weakest academic cluster right now. Use LMS resources and faculty office hours to recover early.`,
      type: "improvement",
    });
  }

  if (gpaTrend.length >= 2) {
    const last = gpaTrend[gpaTrend.length - 1];
    const previous = gpaTrend[gpaTrend.length - 2];
    if (last.sgpa >= previous.sgpa) {
      recommendations.push({
        title: "Maintain Current Trajectory",
        description: "Your latest SGPA trend is stable or improving. Keep the same study rhythm and attendance discipline.",
        type: "positive",
      });
    }
  }

  if (progressPercent >= 70) {
    recommendations.push({
      title: "Start Career Preparation",
      description: "Your degree progress is far enough along to begin serious interview prep, project polishing, and internship applications.",
      type: "suggestion",
    });
  }

  return recommendations.slice(0, 4);
}

function buildHighlights({ gpaTrend, categoryPerformance, attendanceRecords }) {
  const bestSemester = [...gpaTrend].sort((left, right) => right.sgpa - left.sgpa)[0];
  const strongestCategory = categoryPerformance[0];
  const atRisk = attendanceRecords.filter((record) => record.attendancePct > 0 && record.attendancePct < 75);
  const consistency =
    gpaTrend.length > 1
      ? Math.sqrt(
          gpaTrend.reduce((sum, item) => {
            const mean = gpaTrend.reduce((inner, row) => inner + row.sgpa, 0) / gpaTrend.length;
            return sum + (item.sgpa - mean) ** 2;
          }, 0) / gpaTrend.length
        ).toFixed(2)
      : "0.00";

  return [
    {
      label: "Strongest Subject Area",
      value: strongestCategory
        ? `${strongestCategory.category} (${strongestCategory.avgGpa.toFixed(2)} GPA)`
        : "Not enough data",
    },
    {
      label: "Best Semester",
      value: bestSemester ? `Semester ${bestSemester.semester} (${bestSemester.sgpa.toFixed(2)} SGPA)` : "Not enough data",
    },
    {
      label: "Attendance Risk",
      value: atRisk.length ? `${atRisk.length} subject(s) below 75%` : "No subject currently at risk",
    },
    {
      label: "Consistency Score",
      value: `Variance sigma ${consistency}`,
    },
  ];
}

// --- coreMethods.js ---
const coreMethods = {
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
    if (!creditSummary.completedCredits) {
      // The CGPA report carries no earned-credits figure; derive it from passed exam-mark rows
      // using the same GRADE_POINTS > 0 rule as normalizeHistoricalSgpa.
      creditSummary.completedCredits = parseExamMarkDetailsRows(examMarkRaw).reduce(
        (sum, row) => sum + ((GRADE_POINTS[row.grade] || 0) > 0 ? row.credit : 0),
        0
      );
    }
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

// --- sourceMethods.js ---
const sourceMethods = {
  _recordGeneratedRecommendations({ user, academicRecommendations, careerReadiness }) {
    if (!this.trackerStore || !user?.userId) return [];
    const academicEvents = this.trackerStore.recordRecommendationEvents({
      userId: user.userId,
      eventType: "generated",
      sourceDomain: "academic_tracker",
      recommendations: ensureArray(academicRecommendations).map((recommendation) => ({
        ...recommendation,
        confidence:
          recommendation.type === "warning"
            ? 0.9
            : recommendation.type === "improvement"
              ? 0.75
              : 0.65,
        inputsUsed: ["gpaTrend", "attendanceRecords", "categoryPerformance"],
      })),
    });
    const careerEvents = this.trackerStore.recordRecommendationEvents({
      userId: user.userId,
      eventType: "generated",
      sourceDomain: "career_readiness",
      recommendations: ensureArray(careerReadiness?.recommendedOpportunities),
    });
    return [...academicEvents, ...careerEvents];
  },

  _getCareerProfile(user) {
    if (!this.careerStore || !user?.userId || typeof this.careerStore.getProfile !== "function") {
      return {
        userId: user?.userId || "",
        skills: [],
        preferredTypes: [],
        preferredLocations: [],
        resumeUrl: "",
        resumeFileName: "",
      };
    }
    try {
      return this.careerStore.getProfile(user);
    } catch {
      return {
        userId: user.userId,
        skills: [],
        preferredTypes: [],
        preferredLocations: [],
        resumeUrl: "",
        resumeFileName: "",
      };
    }
  },

  _getCareerApplications(user) {
    if (!this.careerStore || !user?.userId || typeof this.careerStore.getApplications !== "function") {
      return [];
    }
    try {
      return ensureArray(this.careerStore.getApplications(user.userId));
    } catch {
      return [];
    }
  },

  _getStoredRecommendationEvents(user, limit = 50) {
    if (!this.trackerStore || !user?.userId) return [];
    return ensureArray(this.trackerStore.listRecommendationEvents(user.userId, { limit }));
  },

  async _getLmsRecommendations(user, limit = 5) {
    if (!user?.userId) return [];
    try {
      if (this.recommendationEngine && typeof this.recommendationEngine.getRecommendations === "function") {
        return ensureArray(await this.recommendationEngine.getRecommendations({ userId: user.userId, limit }));
      }
      if (this.lmsStore && typeof this.lmsStore.listRecommendationCandidates === "function") {
        return ensureArray(this.lmsStore.listRecommendationCandidates({ userId: user.userId, limit })).slice(0, limit);
      }
    } catch {
      return [];
    }
    return [];
  },

  _recordUnifiedRecommendations({ user, nextSkills, opportunityRecommendations, actionPlan }) {
    if (!this.trackerStore || !user?.userId) return [];
    const recommendations = [
      ...ensureArray(nextSkills).map((item) => ({
        id: item.id,
        title: item.title,
        confidence: item.confidence,
        inputsUsed: item.inputsUsed,
        reasons: item.reasons,
      })),
      ...ensureArray(opportunityRecommendations).map((item) => ({
        id: item.id,
        title: item.title,
        confidence: item.confidence,
        inputsUsed: item.inputsUsed,
        reasons: item.reasons,
      })),
      ...ensureArray(actionPlan).map((item) => ({
        id: item.id,
        title: item.title,
        confidence: item.confidence,
        inputsUsed: item.inputsUsed,
        reasons: item.reasons,
      })),
    ];
    return this.trackerStore.recordRecommendationEvents({
      userId: user.userId,
      eventType: "generated",
      sourceDomain: "unified_insights",
      recommendations,
    });
  }
};

// --- apiMethods.js ---

const apiMethods = {
  async getOverview({ sessionId, user = null }) {
    const batch = await this._loadBatch(sessionId);
    const overview = this._buildOverviewFromBatch({
      ...batch,
      user,
    });
    const snapshot = this._persistSnapshot({
      user,
      snapshotType: "overview",
      payload: overview,
      sourceStatus: this._buildSourceStatus(batch),
    });
    return {
      ...overview,
      snapshot,
      history: this._getSnapshotHistory(user, "overview"),
    };
  },

  async getInsights({ sessionId, user = null }) {
    const batch = await this._loadBatch(sessionId);
    const overview = this._buildOverviewFromBatch({
      ...batch,
      user,
    });
    const { examMarkRaw, currentRaw } = batch;
    const resultRows = flattenHistoricalResults(examMarkRaw, currentRaw);
    const categoryPerformance = buildCategoryPerformance(resultRows);
    const recommendations = buildRecommendations({
      gpaTrend: overview.semesters.map((item) => ({
        semester: item.semester,
        sgpa: Number(item.sgpa),
      })),
      attendanceRecords: overview.attendanceRecords,
      categoryPerformance,
      progressPercent: overview.progressPercent,
    });
    const payload = {
      gpaTrend: overview.semesters.map((item) => ({
        semester: item.label,
        sgpa: Number(item.sgpa),
      })),
      categoryPerformance,
      highlights: buildHighlights({
        gpaTrend: overview.semesters.map((item) => ({
          semester: item.semester,
          sgpa: Number(item.sgpa),
        })),
        categoryPerformance,
        attendanceRecords: overview.attendanceRecords,
      }),
      recommendations,
      overview,
      careerReadiness: overview.careerReadiness,
    };
    const snapshot = this._persistSnapshot({
      user,
      snapshotType: "insights",
      payload,
      sourceStatus: this._buildSourceStatus(batch),
    });
    const generatedEvents = this._recordGeneratedRecommendations({
      user,
      academicRecommendations: recommendations,
      careerReadiness: overview.careerReadiness,
    });

    return {
      ...payload,
      snapshot,
      history: this._getSnapshotHistory(user, "insights"),
      recommendationEvents: generatedEvents.map((event) => ({
        id: event.id,
        eventType: event.eventType,
        recommendationId: event.recommendationId,
        recommendationTitle: event.recommendationTitle,
        sourceDomain: event.sourceDomain,
        confidence: event.confidence,
        createdAt: event.createdAt,
      })),
    };
  },

  async getUnifiedInsights({ sessionId, user = null }) {
    const startedAt = Date.now();
    const batch = await this._loadBatch(sessionId);
    const overview = this._buildOverviewFromBatch({
      ...batch,
      user,
    });
    const resultRows = flattenHistoricalResults(batch.examMarkRaw, batch.currentRaw);
    const categoryPerformance = buildCategoryPerformance(resultRows);
    const academicRecommendations = buildRecommendations({
      gpaTrend: overview.semesters.map((item) => ({
        semester: item.semester,
        sgpa: Number(item.sgpa),
      })),
      attendanceRecords: overview.attendanceRecords,
      categoryPerformance,
      progressPercent: overview.progressPercent,
    });
    const careerReadiness = overview.careerReadiness || buildCareerReadiness({
      careerStore: this.careerStore,
      user,
      academicSignals: {
        currentCgpa: overview.currentCgpa,
        progressPercent: overview.progressPercent,
        attendancePct: overview.attendancePct,
        subjectsAtRisk: overview.subjectsAtRisk,
      },
    });
    const careerProfile = this._getCareerProfile(user);
    const applications = this._getCareerApplications(user);
    const previousEvents = this._getStoredRecommendationEvents(user, 50);
    const lmsRecommendations = await this._getLmsRecommendations(user, 5);
    const profileGraph = buildUnifiedProfileGraph({
      overview,
      careerReadiness,
      careerProfile,
      applications,
      lmsRecommendations,
      recommendationEvents: previousEvents,
    });
    const atsScore = buildAtsScore(careerReadiness);
    const nextSkills = buildNextSkillRecommendations({
      careerReadiness,
      lmsRecommendations,
      recommendationEvents: previousEvents,
    });
    const opportunityRecommendations = buildUnifiedOpportunityRecommendations({
      careerReadiness,
      user,
      recommendationEvents: previousEvents,
    });
    const actionPlan = buildUnifiedActionPlan({
      overview,
      categoryPerformance,
      careerReadiness,
      nextSkills,
      opportunityRecommendations,
    });

    const payload = {
      contractVersion: UNIFIED_INSIGHTS_CONTRACT_VERSION,
      generatedAt: new Date().toISOString(),
      scoringSchema: buildScoringSchema(),
      profileGraph,
      atsScore,
      academicSignals: {
        currentCgpa: overview.currentCgpa,
        progressPercent: overview.progressPercent,
        attendancePct: overview.attendancePct,
        subjectsAtRisk: overview.subjectsAtRisk,
        recommendations: academicRecommendations,
      },
      nextSkills,
      opportunityRecommendations,
      actionPlan,
      feedbackLoop: {
        recentEvents: summarizeRecentEvents(previousEvents),
        adaptiveSignals: previousEvents.filter((event) => normalizeIdentity(event.eventType) !== "generated").length,
        modelInfluence:
          previousEvents.length > 0
            ? "Prior clicks, saves, applies, and dismissals adjust confidence in later rankings."
            : "No prior interaction events yet; rankings use academic, LMS, and career profile signals.",
      },
      lmsSignals: {
        recommendations: lmsRecommendations.slice(0, 5).map((item) => ({
          id: item.id,
          title: item.title,
          confidence: clampUnit(item.confidence, 0),
          recommendationScore: item.recommendationScore ?? null,
          reasons: ensureArray(item.reasons),
          inputsUsed: item.inputsUsed || {},
        })),
      },
      sourceStatus: this._buildSourceStatus(batch),
      responseTimeMs: Date.now() - startedAt,
    };
    payload.qualityMonitoring = {
      ...evaluateUnifiedInsightPayload(payload),
      measuredLatencyMs: payload.responseTimeMs,
      dashboardCards: [
        { label: "Explainability", value: `${Math.round(evaluateUnifiedInsightPayload(payload).metrics.explainabilityCoverage * 100)}%` },
        { label: "Eligible opportunities", value: `${Math.round(evaluateUnifiedInsightPayload(payload).metrics.eligibleOpportunityRate * 100)}%` },
        { label: "Feedback events", value: String(payload.feedbackLoop.recentEvents.length) },
      ],
    };

    const generatedEvents = this._recordUnifiedRecommendations({
      user,
      nextSkills,
      opportunityRecommendations,
      actionPlan,
    });
    payload.feedbackLoop.generatedEvents = summarizeRecentEvents(generatedEvents);

    const snapshot = this._persistSnapshot({
      user,
      snapshotType: "unified-insights",
      payload,
      sourceStatus: this._buildSourceStatus(batch),
    });

    return {
      ...payload,
      snapshot,
      history: this._getSnapshotHistory(user, "unified-insights"),
    };
  },

  getHistory({ user, snapshotType = "", limit = 10 }) {
    if (!this.trackerStore || !user?.userId) {
      return { items: [] };
    }
    return {
      items: this.trackerStore
        .listSnapshots(user.userId, { snapshotType, limit })
        .map((snapshot) => this._summarizeSnapshot(snapshot)),
    };
  },

  getRecommendationEvents({ user, limit = 25 }) {
    if (!this.trackerStore || !user?.userId) {
      return { items: [] };
    }
    return {
      items: this.trackerStore.listRecommendationEvents(user.userId, { limit }),
    };
  },

  recordRecommendationEvent({ user, payload = {} }) {
    if (!this.trackerStore || !user?.userId) {
      return { items: [] };
    }
    const items = this.trackerStore.recordRecommendationEvents({
      userId: user.userId,
      eventType: payload.eventType || "interaction",
      sourceDomain: payload.sourceDomain || "academic_tracker",
      recommendations: [
        {
          id: payload.recommendationId,
          title: payload.recommendationTitle,
          confidence: payload.confidence,
          action: payload.action,
          inputsUsed: payload.inputsUsed,
        },
      ],
    });
    return { items };
  }
};

// --- utils.js ---
const UNIFIED_INSIGHTS_CONTRACT_VERSION = "unified-insights-v1";

const GRADE_POINTS = {
  O: 10,
  "A+": 9,
  A: 8,
  "B+": 7,
  B: 6,
  C: 5,
  P: 4,
};

function toSafeString(value) {
  if (value === undefined || value === null) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function toNumber(value, fallback = 0) {
  const parsed = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toPercent(value, fallback = 0) {
  const parsed = Number.parseFloat(String(value ?? ""));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(100, Number(parsed.toFixed(2))));
}

function clampUnit(value, fallback = 0) {
  const parsed = Number.parseFloat(String(value ?? ""));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(1, Number(parsed.toFixed(3))));
}

function ensureObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeSkill(value) {
  return toSafeString(value).toLowerCase();
}

function uniqueStrings(values) {
  return Array.from(new Set(ensureArray(values).map(toSafeString).filter(Boolean)));
}

function normalizeIdentity(value) {
  return toSafeString(value).toLowerCase();
}

function hasIntersection(list, acceptedValues) {
  const accepted = new Set(acceptedValues.map(normalizeIdentity).filter(Boolean));
  return ensureArray(list).some((item) => accepted.has(normalizeIdentity(item)));
}

function isOpportunityEligibleForUser(opportunity, user) {
  const branches = Array.isArray(opportunity.eligibleBranches)
    ? opportunity.eligibleBranches
    : parseJsonArray(opportunity.eligibleBranches);
  const years = Array.isArray(opportunity.eligibleYears)
    ? opportunity.eligibleYears
    : parseJsonArray(opportunity.eligibleYears);
  const branch = normalizeIdentity(user?.branch);
  const year = toSafeString(user?.year);

  const branchEligible =
    branches.length === 0 ||
    hasIntersection(branches, ["all", "any"]) ||
    (branch ? hasIntersection(branches, [branch]) : true);
  const yearEligible =
    years.length === 0 ||
    hasIntersection(years, ["all", "any"]) ||
    (year ? hasIntersection(years, [year]) : true);

  return branchEligible && yearEligible;
}

function buildScoringSchema() {
  return {
    contractVersion: UNIFIED_INSIGHTS_CONTRACT_VERSION,
    recommendationShape: {
      id: "string",
      title: "string",
      confidence: "0..1",
      reasons: "string[]",
      inputsUsed: "string[]",
      eligibility: "object",
    },
    dimensions: [
      { key: "academicRisk", label: "Academic risk", inputs: ["attendance", "gpaTrend", "categoryPerformance"] },
      { key: "resumeQuality", label: "ATS-style resume quality", inputs: ["careerProfile", "resume", "academicSignals"] },
      { key: "opportunityFit", label: "Opportunity fit", inputs: ["profileSkills", "opportunitySkills", "eligibility"] },
      { key: "skillDemand", label: "Skill demand", inputs: ["careerSkillGaps", "activeOpportunityDemand"] },
      { key: "feedbackAdaptation", label: "Feedback adaptation", inputs: ["recommendationEvents"] },
    ],
    eligibilityFilters: ["activeOpportunity", "moderationClear", "branchEligible", "yearEligible", "notDismissed"],
    feedbackWeights: {
      clicked: 0.05,
      saved: 0.07,
      applied: 0.12,
      dismissed: -0.12,
    },
  };
}

function summarizeRecentEvents(events) {
  return ensureArray(events)
    .slice(0, 8)
    .map((event) => ({
      id: event.id,
      eventType: event.eventType,
      recommendationId: event.recommendationId,
      recommendationTitle: event.recommendationTitle,
      sourceDomain: event.sourceDomain,
      confidence: clampUnit(event.confidence, 0),
      createdAt: event.createdAt,
    }));
}

function feedbackBoostForRecommendation(item, events) {
  const itemId = toSafeString(item.id);
  const itemTitle = normalizeIdentity(item.title);
  let boost = 0;
  for (const event of ensureArray(events)) {
    const matches =
      toSafeString(event.recommendationId) === itemId ||
      normalizeIdentity(event.recommendationTitle) === itemTitle;
    if (!matches) continue;
    const eventType = normalizeIdentity(event.eventType || event.action);
    if (["clicked", "click", "opened", "viewed"].includes(eventType)) boost += 0.05;
    if (["saved", "bookmarked"].includes(eventType)) boost += 0.07;
    if (["applied", "apply"].includes(eventType)) boost += 0.12;
    if (["dismissed", "hidden"].includes(eventType)) boost -= 0.12;
  }
  return Number(Math.max(-0.2, Math.min(0.25, boost)).toFixed(3));
}

// --- unifiedInsights.js ---

function buildUnifiedProfileGraph({ overview, careerReadiness, careerProfile, applications, lmsRecommendations, recommendationEvents }) {
  const profileSkills = uniqueStrings(careerProfile?.skills);
  const nodes = [
    {
      id: "academic",
      type: "source",
      label: "Academic Record",
      status: overview.semesters.length ? "ready" : "sparse",
      value: `${overview.currentCgpa || "0.00"} CGPA`,
      confidence: overview.semesters.length ? 0.86 : 0.35,
      inputsUsed: ["cgpa", "semesterResults", "attendance"],
    },
    {
      id: "lms",
      type: "source",
      label: "LMS Engagement",
      status: lmsRecommendations.length ? "ready" : "sparse",
      value: `${lmsRecommendations.length} ranked resource(s)`,
      confidence: lmsRecommendations.length ? 0.78 : 0.32,
      inputsUsed: ["lmsRecommendations", "topicMastery", "resourceEngagement"],
    },
    {
      id: "resume",
      type: "source",
      label: "Resume",
      status: careerReadiness.resumeScore.hasResume ? "ready" : "missing",
      value: `${careerReadiness.resumeScore.score}% ATS score`,
      confidence: careerReadiness.resumeScore.hasResume ? 0.82 : 0.44,
      inputsUsed: ["resumeFile", "careerProfile", "academicSignals"],
    },
    {
      id: "skills",
      type: "profile",
      label: "Skill Profile",
      status: profileSkills.length >= 3 ? "ready" : "sparse",
      value: `${profileSkills.length} skill(s)`,
      confidence: profileSkills.length >= 3 ? 0.8 : 0.42,
      inputsUsed: ["careerProfile.skills", "careerSkillGaps"],
    },
    {
      id: "applications",
      type: "behavior",
      label: "Applications",
      status: applications.length ? "ready" : "sparse",
      value: `${applications.length} tracked application(s)`,
      confidence: applications.length ? 0.76 : 0.35,
      inputsUsed: ["careerApplications"],
    },
    {
      id: "feedback",
      type: "behavior",
      label: "Recommendation Feedback",
      status: recommendationEvents.length ? "ready" : "cold_start",
      value: `${recommendationEvents.length} event(s)`,
      confidence: recommendationEvents.length ? 0.72 : 0.28,
      inputsUsed: ["recommendationEvents"],
    },
  ];

  return {
    nodes,
    edges: [
      { from: "academic", to: "resume", signal: "CGPA and progress influence ATS rubric." },
      { from: "skills", to: "applications", signal: "Skill profile controls opportunity eligibility and fit." },
      { from: "lms", to: "skills", signal: "LMS ranking informs the next learning action." },
      { from: "feedback", to: "applications", signal: "Clicks, saves, and applies adapt later recommendations." },
    ],
    coverage: {
      readySignals: nodes.filter((node) => node.status === "ready").length,
      totalSignals: nodes.length,
      missingSignals: nodes.filter((node) => node.status === "missing" || node.status === "cold_start").map((node) => node.label),
    },
  };
}

function buildAtsScore(careerReadiness) {
  const resumeScore = careerReadiness.resumeScore || { score: 0, hasResume: false, breakdown: [], suggestions: [] };
  return {
    score: toPercent(resumeScore.score),
    hasResume: Boolean(resumeScore.hasResume),
    rubric: ensureArray(resumeScore.breakdown).map((item) => ({
      label: toSafeString(item.label),
      score: toPercent(item.score),
      max: toPercent(item.max),
      reason:
        Number(item.score || 0) >= Number(item.max || 0)
          ? `${toSafeString(item.label)} is complete.`
          : `${toSafeString(item.label)} needs improvement before high-fit applications.`,
    })),
    suggestions: ensureArray(resumeScore.suggestions),
    confidence: resumeScore.hasResume ? 0.82 : 0.56,
    inputsUsed: ["careerProfile", "resumeMetadata", "academicSignals"],
  };
}

function buildNextSkillRecommendations({ careerReadiness, lmsRecommendations, recommendationEvents }) {
  const lmsTitles = ensureArray(lmsRecommendations).map((item) => toSafeString(item.title)).filter(Boolean);
  return ensureArray(careerReadiness.skillGaps)
    .slice(0, 5)
    .map((gap, index) => {
      const baseConfidence = clampUnit(0.52 + Math.min(0.28, Number(gap.opportunityCount || 0) * 0.04) - index * 0.03, 0.5);
      const feedbackBoost = feedbackBoostForRecommendation({ id: `skill-${normalizeSkill(gap.skill)}`, title: `Learn ${gap.skill}` }, recommendationEvents);
      const confidence = clampUnit(baseConfidence + feedbackBoost, baseConfidence);
      return {
        id: `skill-${normalizeSkill(gap.skill).replace(/[^a-z0-9]+/g, "-")}`,
        skill: toSafeString(gap.skill),
        title: `Build ${toSafeString(gap.skill)}`,
        opportunityDemand: Number(gap.opportunityCount || 0),
        gapLevel: toSafeString(gap.gapLevel || "missing"),
        confidence,
        feedbackBoost,
        reasons: [
          `${toSafeString(gap.skill)} appears in ${Number(gap.opportunityCount || 0)} active opportunity match(es).`,
          gap.reason || "This skill is absent from the current career profile.",
          lmsTitles[index] ? `Use LMS resource: ${lmsTitles[index]}.` : "No ranked LMS resource is currently attached.",
        ],
        inputsUsed: ["careerSkillGaps", "activeOpportunityDemand", "lmsRecommendations", "recommendationEvents"],
      };
    });
}

function buildUnifiedOpportunityRecommendations({ careerReadiness, user, recommendationEvents }) {
  return ensureArray(careerReadiness.recommendedOpportunities)
    .filter((opportunity) => isOpportunityEligibleForUser(opportunity, user))
    .map((opportunity) => {
      const feedbackBoost = feedbackBoostForRecommendation(opportunity, recommendationEvents);
      const confidence = clampUnit(Number(opportunity.confidence || 0.45) + feedbackBoost, 0.45);
      const reasons = [
        ...ensureArray(opportunity.reasons),
        feedbackBoost > 0 ? "Recent interaction increased this recommendation's relevance." : "",
        feedbackBoost < 0 ? "Recent dismissal reduced this recommendation's relevance." : "",
      ].filter(Boolean);
      return {
        id: opportunity.id,
        title: opportunity.title,
        type: opportunity.type,
        organization: opportunity.organization,
        deadline: opportunity.deadline,
        matchedSkills: ensureArray(opportunity.matchedSkills),
        missingSkills: ensureArray(opportunity.missingSkills),
        confidence,
        feedbackBoost,
        eligibility: {
          eligible: true,
          branch: toSafeString(user?.branch) || "not provided",
          year: toSafeString(user?.year) || "not provided",
          filtersApplied: ["activeOpportunity", "branchEligible", "yearEligible", "moderationClear"],
        },
        reasons,
        inputsUsed: uniqueStrings([...(opportunity.inputsUsed || []), "recommendationEvents", "careerEligibility"]),
      };
    })
    .sort((left, right) => right.confidence - left.confidence)
    .slice(0, 5);
}

function buildUnifiedActionPlan({ overview, categoryPerformance, careerReadiness, nextSkills, opportunityRecommendations }) {
  const weakestCategory = [...ensureArray(categoryPerformance)].sort((left, right) => left.avgGpa - right.avgGpa)[0];
  const actions = [];

  if (overview.subjectsAtRisk > 0) {
    actions.push({
      id: "action-attendance-risk",
      domain: "academic",
      priority: "high",
      title: "Recover attendance risk",
      description: `${overview.subjectsAtRisk} subject(s) are below the attendance safety line.`,
      confidence: 0.9,
      reasons: ["Attendance below threshold blocks exam eligibility and should be resolved first."],
      inputsUsed: ["attendanceRecords"],
    });
  }

  if (weakestCategory) {
    actions.push({
      id: `action-strengthen-${normalizeSkill(weakestCategory.category).replace(/[^a-z0-9]+/g, "-")}`,
      domain: "academic",
      priority: "medium",
      title: `Strengthen ${weakestCategory.category}`,
      description: `${weakestCategory.category} has the lowest current academic score cluster.`,
      confidence: 0.74,
      reasons: [`Average GPA is ${Number(weakestCategory.avgGpa || 0).toFixed(2)} across ${weakestCategory.subjects} subject(s).`],
      inputsUsed: ["categoryPerformance", "gpaTrend"],
    });
  }

  if (!careerReadiness.resumeScore.hasResume) {
    actions.push({
      id: "action-upload-resume",
      domain: "career",
      priority: "high",
      title: "Upload resume for ATS scoring",
      description: "Opportunity ranking has lower confidence without resume evidence.",
      confidence: 0.82,
      reasons: ["Resume file contributes 25 points to the ATS-style rubric."],
      inputsUsed: ["careerProfile", "resumeMetadata"],
    });
  }

  if (nextSkills[0]) {
    actions.push({
      id: `action-${nextSkills[0].id}`,
      domain: "career",
      priority: "high",
      title: `Build ${nextSkills[0].skill}`,
      description: `${nextSkills[0].opportunityDemand} active opportunity match(es) need this skill.`,
      confidence: nextSkills[0].confidence,
      reasons: nextSkills[0].reasons,
      inputsUsed: nextSkills[0].inputsUsed,
    });
  }

  if (opportunityRecommendations[0]) {
    actions.push({
      id: `action-review-${opportunityRecommendations[0].id}`,
      domain: "career",
      priority: "medium",
      title: `Review ${opportunityRecommendations[0].title}`,
      description: "This eligible opportunity is currently the highest-confidence career match.",
      confidence: opportunityRecommendations[0].confidence,
      reasons: opportunityRecommendations[0].reasons,
      inputsUsed: opportunityRecommendations[0].inputsUsed,
    });
  }

  return actions.slice(0, 6);
}

function evaluateUnifiedInsightPayload(payload) {
  const recommendations = [
    ...ensureArray(payload.nextSkills),
    ...ensureArray(payload.opportunityRecommendations),
    ...ensureArray(payload.actionPlan),
  ];
  const explainable = recommendations.filter(
    (item) => ensureArray(item.reasons).length > 0 && ensureArray(item.inputsUsed).length > 0
  ).length;
  const opportunities = ensureArray(payload.opportunityRecommendations);
  const eligible = opportunities.filter((item) => item.eligibility?.eligible !== false).length;
  const nodes = ensureArray(payload.profileGraph?.nodes);
  const readySignals = nodes.filter((node) => node.status === "ready").length;
  const totalSignals = nodes.length || 1;

  return {
    baseline: "offline-fixture-v1",
    metrics: {
      recommendationCount: recommendations.length,
      explainabilityCoverage: recommendations.length ? Number((explainable / recommendations.length).toFixed(3)) : 1,
      eligibleOpportunityRate: opportunities.length ? Number((eligible / opportunities.length).toFixed(3)) : 1,
      profileSignalCoverage: Number((readySignals / totalSignals).toFixed(3)),
      feedbackEventCount: ensureArray(payload.feedbackLoop?.recentEvents).length,
    },
    thresholds: {
      explainabilityCoverage: 1,
      eligibleOpportunityRate: 1,
      profileSignalCoverage: 0.5,
      recommendationApiP95Ms: 400,
    },
  };
}

// --- class ---
class LmsTrackerService {
  constructor({ erpAggregationService, careerStore = null, trackerStore = null, lmsStore = null, recommendationEngine = null }) {
    this.erpAggregationService = erpAggregationService;
    this.careerStore = careerStore;
    this.trackerStore = trackerStore;
    this.lmsStore = lmsStore;
    this.recommendationEngine = recommendationEngine;
  }

}

Object.assign(
  LmsTrackerService.prototype,
  coreMethods,
  sourceMethods,
  apiMethods
);

module.exports = {
  LmsTrackerService,
  evaluateUnifiedInsightPayload,
  UNIFIED_INSIGHTS_CONTRACT_VERSION,
};

const { extractSemesterNumber } = require("../cgpaSummary");
const {
  GRADE_POINTS,
  ensureArray,
  ensureObject,
  toNumber,
  toSafeString,
} = require("./utils");

function readEarnedCreditsConfig(cgpaData) {
  const defaultReq = 160;
  if (!cgpaData || typeof cgpaData !== "object") {
    return { requiredCredits: defaultReq, completedCredits: 0, currentCgpa: "0.00" };
  }

  const records = Array.isArray(cgpaData) ? cgpaData : ensureArray(cgpaData.Table);
  let completedCredits = 0;
  let currentCgpa = "0.00";

  for (const row of records) {
    if (!row || typeof row !== "object") continue;
    const serialized = JSON.stringify(row).toLowerCase();
    if (serialized.includes("earned") && serialized.includes("credit")) {
      const match = serialized.match(/(?:value|text|:)\s*"?(\d+)/i);
      if (match) completedCredits = Number.parseInt(match[1] || "0", 10) || 0;
    }
    if (serialized.includes("cgpa")) {
      const match = serialized.match(/(?:value|text|:)\s*"?(\d\.\d+)/i);
      if (match) currentCgpa = Number.parseFloat(match[1] || "0").toFixed(2);
    }
  }

  return {
    requiredCredits: defaultReq,
    completedCredits,
    currentCgpa,
  };
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

module.exports = {
  readEarnedCreditsConfig,
  extractAttendanceRecords,
  extractCurrentResultSummary,
  parseExamMarkDetailsRows,
  normalizeHistoricalSgpa,
  flattenHistoricalResults,
  inferCategory,
  buildCategoryPerformance,
  buildRecommendations,
  buildHighlights,
};

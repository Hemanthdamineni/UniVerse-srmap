const cheerio = require("cheerio");
const { cleanText } = require("../utils/text");

function normalizeSemesterLabel(value) {
  const label = cleanText(value);
  if (!label) return "";
  return label;
}

function romanToNumber(value) {
  const normalized = String(value || "").trim().toUpperCase();
  if (!normalized) return null;

  const romanMap = {
    I: 1,
    V: 5,
    X: 10,
  };

  let total = 0;
  let prev = 0;
  for (let index = normalized.length - 1; index >= 0; index -= 1) {
    const symbol = normalized[index];
    const current = romanMap[symbol];
    if (!current) return null;
    if (current < prev) {
      total -= current;
    } else {
      total += current;
      prev = current;
    }
  }

  return total || null;
}

function extractSemesterNumber(value) {
  const label = cleanText(value);
  if (!label) return null;

  const arabicMatch = label.match(/\b(\d{1,2})\b/);
  if (arabicMatch) return Number(arabicMatch[1]);

  const romanMatch = label.match(/\b([IVX]{1,6})\b/i);
  if (romanMatch) return romanToNumber(romanMatch[1]);

  return null;
}

function extractCgpaValue(value) {
  const text = cleanText(value);
  if (!text) return "";
  const match = text.match(/\b(\d{1,2}(?:\.\d{1,3})?)\b/);
  return match ? match[1] : "";
}

function extractCgpaSummaryFromHtml(html = "") {
  const rawHtml = String(html || "");
  if (!rawHtml) {
    return {
      cgpa: "",
      sourceText: "",
    };
  }

  const $ = cheerio.load(rawHtml);
  const selectorCandidates = [
    "div[style*='float: right'][style*='font-size']",
    "div:contains('CGPA')",
    "span:contains('CGPA')",
    "td:contains('CGPA')",
  ];

  for (const selector of selectorCandidates) {
    const node = $(selector).first();
    const text = cleanText(node.text());
    const cgpa = extractCgpaValue(text);
    if (cgpa) {
      return {
        cgpa,
        sourceText: text,
      };
    }
  }

  const pageText = cleanText($.root().text());
  const cgpaMatch = pageText.match(/c\.?\s*g\.?\s*p\.?\s*a\.?\s*[:\-]?\s*(\d{1,2}(?:\.\d{1,3})?)/i);
  return {
    cgpa: cgpaMatch ? cgpaMatch[1] : "",
    sourceText: pageText,
  };
}

function extractSemesterLabelFromProfile(profileData) {
  const tableContent =
    profileData && typeof profileData === "object" && profileData.TableContent
      ? profileData.TableContent
      : null;

  if (!tableContent || typeof tableContent !== "object") return "";

  const entries = Object.entries(tableContent);
  const semesterEntry = entries.find(([key]) => /semester/i.test(String(key || "")));
  if (!semesterEntry) return "";
  return normalizeSemesterLabel(semesterEntry[1]);
}

function buildCgpaSummaryPayload({
  cgpa,
  semesterLabel,
  semesterNumber,
  sourceText = "",
} = {}) {
  const rows = [];
  if (cgpa) {
    rows.push({ Metric: "Current CGPA", Value: cgpa });
  }
  if (semesterLabel) {
    rows.push({ Metric: "Current Semester", Value: semesterLabel });
  }
  if (semesterNumber) {
    rows.push({ Metric: "Semester Number", Value: String(semesterNumber) });
  }

  return {
    Academic: {
      "CGPA Summary": {
        title: "CGPA Summary",
        text: sourceText || [cgpa ? `Current CGPA: ${cgpa}` : "", semesterLabel ? `Current Semester: ${semesterLabel}` : ""]
          .filter(Boolean)
          .join("\n"),
        TableContent: {
          ...(cgpa ? { "Current CGPA": cgpa } : {}),
          ...(semesterLabel ? { Semester: semesterLabel } : {}),
          ...(semesterNumber ? { "Semester Number": String(semesterNumber) } : {}),
        },
        tables: rows.length ? [rows] : [],
        meta: {
          ...(cgpa ? { cgpa } : {}),
          ...(semesterLabel ? { semesterLabel } : {}),
          ...(semesterNumber ? { semesterNumber } : {}),
        },
      },
    },
  };
}

module.exports = {
  extractCgpaSummaryFromHtml,
  extractSemesterLabelFromProfile,
  extractSemesterNumber,
  buildCgpaSummaryPayload,
};

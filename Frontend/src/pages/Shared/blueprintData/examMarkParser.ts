import type { DataTableModel } from "../../../components/erp/ErpPrimitives";
import { isRecord } from "./valueUtils";

const MONTH_PATTERN = /^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+\d{4}$/i;
const SUBJECT_CODE_PATTERN = /^[A-Z]{2,}\s*\d{2,3}[A-Z]?$/i;
const GRADE_PATTERN = /^(O|A\+|A|B\+|B|C|D|P|F|RA|AB)$/i;
const RESULT_PATTERN = /^(PASS|FAIL|ABSENT|RA|WH)$/i;

export function parseExamMarkDetails(rawTables: unknown[]): DataTableModel | null {
  const rows: Array<Record<string, string>> = [];

  rawTables.forEach((rawTable) => {
    if (!Array.isArray(rawTable) || rawTable.length === 0 || !isRecord(rawTable[0])) return;

    const rawRow = rawTable[0];
    const tokens = Array.from(
      new Set(
        Object.keys(rawRow)
          .map((key) => key.replace(/_\d+$/, "").trim())
          .filter((token) => token.length > 0)
      )
    );

    const parsedRow = parseExamMarkTokenRow(tokens);
    if (parsedRow) {
      rows.push(parsedRow);
    }
  });

  const filteredRows = rows.filter((row) => {
    const desc = row["Subject Description"];
    return !(desc && desc !== "-" && desc.length > 3 && desc === desc.toUpperCase());
  });

  if (filteredRows.length === 0) return null;

  return {
    title: "Historical Exam Marks",
    columns: [
      "Semester",
      "Month & Year",
      "Subject Code",
      "Subject Description",
      "Credit",
      "Grade",
      "Grade Point",
      "Result",
      "Attempt",
    ],
    rows: filteredRows,
  };
}

function parseExamMarkTokenRow(tokens: string[]): Record<string, string> | null {
  const row: Record<string, string> = {
    Semester: "-",
    "Month & Year": "-",
    "Subject Code": "-",
    "Subject Description": "-",
    Credit: "-",
    Grade: "-",
    "Grade Point": "-",
    Result: "-",
    Attempt: "-",
  };

  const numericTokens = tokens.filter((token) => /^\d+$/.test(token));
  if (numericTokens.length > 0) row.Semester = numericTokens[0];
  if (numericTokens.length > 1) row.Credit = numericTokens[1];
  if (numericTokens.length > 2) row.Attempt = numericTokens[numericTokens.length - 1];

  const monthToken = tokens.find((token) => MONTH_PATTERN.test(token));
  if (monthToken) row["Month & Year"] = monthToken;

  const subjectCode = tokens.find((token) => SUBJECT_CODE_PATTERN.test(token));
  if (subjectCode) row["Subject Code"] = subjectCode;

  const gradeToken = tokens.find((token) => GRADE_PATTERN.test(token));
  if (gradeToken) row.Grade = gradeToken;

  const gradePointToken = tokens.find((token) => /^\d+\.\d{2}$/.test(token));
  if (gradePointToken) row["Grade Point"] = gradePointToken;

  const resultToken = tokens.find((token) => RESULT_PATTERN.test(token));
  if (resultToken) row.Result = resultToken;

  const description = tokens
    .filter((token) => token.length > 3)
    .filter((token) => !MONTH_PATTERN.test(token))
    .filter((token) => !SUBJECT_CODE_PATTERN.test(token))
    .filter((token) => !GRADE_PATTERN.test(token))
    .filter((token) => !RESULT_PATTERN.test(token))
    .filter((token) => !/^\d+(\.\d+)?$/.test(token))
    .sort((a, b) => b.length - a.length)[0];

  if (description) row["Subject Description"] = description;

  if (row["Subject Code"] === "-" || row["Subject Description"] === "-") {
    return null;
  }

  return row;
}

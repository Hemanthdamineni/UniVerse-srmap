import type { PageRenderer } from "../../../config/erpBlueprints";
import type { KpiItem, SectionModel } from "../../../components/erp/ErpPrimitives";
import { parseNumericValue } from "./valueUtils";

export function buildKpis(renderer: PageRenderer, sections: SectionModel[], textSamples: string[]): KpiItem[] {
  const rows = sections.flatMap((section) => section.tables.flatMap((table) => table.rows));

  if (renderer === "attendance") {
    const attendanceValues = rows
      .map((row) => parseNumericValue(row["Attendance %"] || ""))
      .filter((value): value is number => Number.isFinite(value));

    const lowAttendanceCount = attendanceValues.filter((value) => value < 75).length;
    return [
      {
        label: "Subjects Tracked",
        value: String(attendanceValues.length),
      },
      {
        label: "Average Attendance",
        value:
          attendanceValues.length > 0
            ? `${(attendanceValues.reduce((a, b) => a + b, 0) / attendanceValues.length).toFixed(2)}%`
            : "-",
      },
      {
        label: "Below 75%",
        value: String(lowAttendanceCount),
      },
    ];
  }

  if (renderer === "curriculum") {
    const totalCredits = rows
      .map((row) => parseNumericValue(row.Credit || ""))
      .filter((value): value is number => Number.isFinite(value))
      .reduce((sum, value) => sum + value, 0);

    return [
      { label: "Subjects", value: String(rows.length) },
      { label: "Total Credits", value: totalCredits > 0 ? String(totalCredits) : "-" },
    ];
  }

  if (renderer === "results-current") {
    const sgpaText = textSamples.join(" ");
    const sgpaMatch = sgpaText.match(/S\.G\.P\.A\s*([0-9.]+)/i);
    const passedCount = rows.filter((row) => /pass/i.test(row.Result || "")).length;

    return [
      { label: "SGPA", value: sgpaMatch?.[1] || "-" },
      { label: "Subjects Passed", value: String(passedCount) },
    ];
  }

  if (renderer === "results-earlier") {
    const gradePoints = rows
      .map((row) => parseNumericValue(row["Grade Point"] || row["Grade Points"] || ""))
      .filter((value): value is number => Number.isFinite(value));

    const averageGradePoint =
      gradePoints.length > 0
        ? (gradePoints.reduce((a, b) => a + b, 0) / gradePoints.length).toFixed(2)
        : "-";

    return [
      { label: "Historical Exam Marks", value: String(rows.length) },
      { label: "Average Grade Point", value: averageGradePoint },
    ];
  }

  if (renderer === "finance-paid") {
    const amounts = rows
      .map((row) => parseNumericValue(row.Amount || ""))
      .filter((value): value is number => Number.isFinite(value));
    const total = amounts.reduce((sum, value) => sum + value, 0);

    return [
      { label: "Payment Entries", value: String(amounts.length) },
      { label: "Recorded Amount", value: total > 0 ? total.toLocaleString() : "-" },
    ];
  }

  if (renderer === "finance-dues") {
    const dues = rows
      .map((row) => parseNumericValue(row.Amount || row["Due Amount"] || ""))
      .filter((value): value is number => Number.isFinite(value));

    const totalDue = dues.reduce((sum, value) => sum + value, 0);
    return [{ label: "Outstanding Due", value: totalDue > 0 ? totalDue.toLocaleString() : "-" }];
  }

  if (renderer === "dashboard") {
    return [
      { label: "Sections Loaded", value: String(sections.length) },
      {
        label: "Tables Loaded",
        value: String(sections.flatMap((section) => section.tables).length),
      },
    ];
  }

  return [];
}

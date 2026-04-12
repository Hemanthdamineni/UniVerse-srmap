import sys

with open('src/pages/Dashboard/Attendance.tsx', 'r') as f:
    lines = f.readlines()

new_memo = """  const processedData = useMemo(() => {
    const transformed = transformAttendance(attendanceData);
    if (!transformed || transformed.records.length === 0) return null;

    const chartData = transformed.records.map((record) => {
      // Recharts doesn't handle very long labels well
      const subject = record.subjectCode.length > 8 ? f\"{record.subjectCode.substring(0, 8)}...\" : record.subjectCode;
      return {
        subject,
        fullSubject: record.subjectCode,
        attendance: record.attendancePct,
        fill: record.attendancePct >= 75 ? "var(--color-good)" : "var(--color-critical)"
      };
    });

    const averageAttendance = chartData.length > 0 
      ? chartData.reduce((sum, item) => sum + item.attendance, 0) / chartData.length 
      : 0;

    return {
      subjects: chartData,
      averageAttendance,
      criticalSubjects: chartData.filter((item) => item.attendance < 75).length
    };
  }, [attendanceData]);
"""

out = []
for i, line in enumerate(lines):
    if i == 3:
        out.append('import { transformAttendance } from "../../lib/erpTransformers";\n')
        out.append(line)
    elif 5 <= i <= 99:
        if i == 5:
            out.append(new_memo.replace('f"', '`').replace('..."', '...' + '`'))
    else:
        out.append(line)

with open('src/pages/Dashboard/Attendance.tsx', 'w') as f:
    f.writelines(out)

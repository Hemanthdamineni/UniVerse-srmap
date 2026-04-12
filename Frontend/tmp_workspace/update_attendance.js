const fs = require('fs');
const file = './src/pages/Dashboard/Attendance.tsx';
let data = fs.readFileSync(file, 'utf8');

data = data.replace('import { useMemo } from "react";', 'import { useMemo } from "react";\nimport { transformAttendance } from "../../lib/erpTransformers";');

const newMemo = `  const processedData = useMemo(() => {
    const transformed = transformAttendance(attendanceData);
    if (!transformed || transformed.records.length === 0) return null;

    const chartData = transformed.records.map((record) => {
      const subject = record.subjectCode.length > 8 ? \`\${record.subjectCode.substring(0, 8)}...\` : record.subjectCode;
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
  }, [attendanceData]);`;

data = data.replace(/const processedData = useMemo\(\(\) => \{[\s\S]*?\}, \[attendanceData\]\);/, newMemo);

fs.writeFileSync(file, data);

import { ChartContainer, ChartTooltip } from "../../components/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine } from "recharts";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { executePipeline, type AttendanceModel } from "../../lib/erpTransformers";

function Attendance({ attendanceData }: { attendanceData?: any }) {
  const processedData = useMemo(() => {
    const pipelineResult = executePipeline("attendance", attendanceData);
    if (!pipelineResult?.isValid || !pipelineResult.data) return null;
    
    const transformed = pipelineResult.data as AttendanceModel;
    if (transformed.records.length === 0) return null;

    const chartData = transformed.records.map((record) => {
      // Recharts doesn't handle very long labels well
      const subject = record.subjectCode.length > 8 ? `${record.subjectCode.substring(0, 8)}...` : record.subjectCode;
      return {
        subject,
        fullSubject: record.subjectCode,
        attendance: record.attendancePct,
        fill: record.attendancePct >= 75 ? "var(--color-good)" : "var(--color-critical)"
      };
    });

    const totalAttendance = chartData.reduce((sum, item) => sum + item.attendance, 0);
    const averageAttendance = chartData.length > 0 ? totalAttendance / chartData.length : 0;
    const criticalSubjects = chartData.filter((item) => item.attendance < 75).length;

    return {
      subjects: chartData,
      averageAttendance,
      criticalSubjects,
    };
  }, [attendanceData]);

  const chartConfig = {
    attendance: {
      label: "Attendance",
      color: "#3b82f6",
    },
    good: {
      label: "Good (≥75%)",
      color: "#10b981",
    },
    critical: {
      label: "Critical (<75%)",
      color: "#ef4444",
    },
  };

  if (!processedData) {
    return (
      <div className="p-4 h-full flex flex-col">
        <h2 className="font-bold text-lg mb-4">Attendance</h2>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-500 text-center">No attendance data available</p>
        </div>
      </div>
    );
  }

  const { subjects, criticalSubjects } = processedData;

  return (
    <div className="p-4 h-full flex flex-col space-y-3">
      <div className="space-y-2">
        <h2 className="font-bold text-lg">Attendance</h2>
        <div className="flex text-sm">
          {criticalSubjects > 0 && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              <span className="text-red-600">
                {criticalSubjects} below 75%
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <ChartContainer config={chartConfig} className="h-full w-full">
          <BarChart
            data={subjects}
            margin={{ top: 10, right: 10, left: 10, bottom: subjects.length > 6 ? 50 : 30 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" vertical={false} />
            <XAxis
              dataKey="subject"
              tickLine={false}
              axisLine={false}
              fontSize={9}
              angle={subjects.length > 6 ? -45 : 0}
              textAnchor={subjects.length > 6 ? "end" : "middle"}
              height={subjects.length > 6 ? 50 : 30}
              interval={0}
            />
            <YAxis
              domain={[0, 100]}
              tickLine={false}
              axisLine={false}
              fontSize={9}
              width={25}
              tickFormatter={(value) => `${value}%`}
            />
            <ChartTooltip
              cursor={{ fill: 'rgba(0,0,0,0.1)' }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-white p-3 border rounded-lg shadow-lg">
                      <p className="font-medium text-gray-900">{data.fullSubject}</p>
                      <p className={`text-sm ${data.attendance >= 75 ? 'text-green-600' : 'text-red-600'}`}>
                        {data.attendance.toFixed(1)}% attendance
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <ReferenceLine
              y={75}
              stroke="#ef4444"
              strokeDasharray="5 5"
              strokeWidth={1}
            />
            <Bar
              dataKey="attendance"
              strokeWidth={0}
              radius={[2, 2, 0, 0]}
              maxBarSize={40}
            />
          </BarChart>
        </ChartContainer>
      </div>

      {/* <div className="grid gap-2">
        {subjects.slice(0, 3).map((subject) => (
          <Link
            key={subject.fullSubject}
            to={`/resources/browse?subjectCode=${encodeURIComponent(subject.fullSubject)}`}
            className="dashboard-subcard flex items-center justify-between rounded-xl px-3 py-2 transition hover:shadow-md"
          >
            <span className="text-sm font-medium text-[#0A3035]">{subject.fullSubject}</span>
            <span className="text-xs font-semibold text-[#34AEBE]">LMS</span>
          </Link>
        ))}
      </div> */}
    </div>
  );
}

export default Attendance;

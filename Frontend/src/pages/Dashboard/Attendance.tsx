import { ChartContainer, ChartTooltip } from "../../components/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine } from "recharts";
import { useMemo } from "react";
import { executePipeline, type AttendanceModel } from "../../lib/erpTransformers";
import { EmptyState } from "../../components/ui/EmptyState";

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

    return {
      subjects: chartData,
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
        <h2 className="card-title font-bold mb-4">Attendance</h2>
        <div className="flex-1 flex items-center justify-center">
          <EmptyState title="No attendance data" description="Attendance data is not available for this semester." />
        </div>
      </div>
    );
  }

  const { subjects } = processedData;

  return (
    <div className="p-4 h-full flex flex-col">

      <div className="flex-1 min-h-0 pt-1">
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
                    <div className="p-3 border rounded-lg shadow-lg" style={{ background: 'var(--comp-surface)', borderColor: 'var(--comp-border)' }}>
                      <p className="font-medium" style={{ color: 'var(--comp-text-primary)' }}>{data.fullSubject}</p>
                      <p className="text-sm" style={{ color: data.attendance >= 75 ? 'var(--success)' : 'var(--error)' }}>
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
              stroke="var(--error)"
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
    </div>
  );
}

export default Attendance;

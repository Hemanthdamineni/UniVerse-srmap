import { useMemo } from "react";
import { ChartContainer, ChartTooltip } from "../../components/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine } from "recharts";
import { executePipeline, type AttendanceModel } from "../../lib/erpTransformers";
import { EmptyState } from "../../components/ui/EmptyState";

function getTierColor(pct: number) {
  if (pct < 20) return "var(--error)";
  if (pct < 40) return "var(--warning)";
  if (pct < 75) return "var(--comp-text-secondary)";
  return "var(--success)";
}

export default function Attendance({ attendanceData }: { attendanceData?: any }) {
  const processed = useMemo(() => {
    const pipelineResult = executePipeline("attendance", attendanceData);
    if (!pipelineResult?.isValid || !pipelineResult.data) return null;
    const transformed = pipelineResult.data as AttendanceModel;
    if (transformed.records.length === 0) return null;

    return transformed;
  }, [attendanceData]);

  if (!processed) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-4 text-center">
        <EmptyState title="Attendance" description="No attendance data available for this semester." />
      </div>
    );
  }

  const { records } = processed;
  const atRiskCount = records.filter((r) => r.attendancePct < 75).length;
  const avgPct = records.reduce((sum, r) => sum + r.attendancePct, 0) / records.length;
  const lowestPct = Math.min(...records.map((r) => r.attendancePct));

  const subjects = records.map((record) => ({
    subject: record.subjectCode,
    fullSubject: record.subjectCode,
    description: record.subjectDescription,
    attendance: record.attendancePct,
    fill: getTierColor(record.attendancePct),
  }));

  const chartConfig = { attendance: { label: "Attendance", color: "#34AEBE" } };
  const needsAngle = subjects.length > 5;

  return (
    <div className="flex h-full flex-col p-3">
      <div className="mb-2 flex shrink-0 items-center justify-between">
        <h2 className="section-title font-bold">Attendance</h2>
      </div>

      <div className="mb-2 grid shrink-0 grid-cols-4 gap-1.5">
        <div className="flex flex-col rounded border px-2 py-1.5" style={{ borderColor: "var(--comp-border)" }}>
          <span className="text-sm font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>{avgPct.toFixed(0)}%</span>
          <span className="text-[10px]" style={{ color: "var(--comp-text-secondary)" }}>Avg</span>
        </div>
        <div className="flex flex-col rounded border px-2 py-1.5" style={{ borderColor: "var(--comp-border)" }}>
          <span className="text-sm font-bold tabular-nums" style={{ color: "var(--error)" }}>{lowestPct.toFixed(0)}%</span>
          <span className="text-[10px]" style={{ color: "var(--comp-text-secondary)" }}>Lowest</span>
        </div>
        <div className="flex flex-col rounded border px-2 py-1.5" style={{ borderColor: "var(--comp-border)" }}>
          <span className="text-sm font-bold tabular-nums" style={{ color: "var(--success)" }}>{records.filter((r) => r.attendancePct >= 75).length}/{subjects.length}</span>
          <span className="text-[10px]" style={{ color: "var(--comp-text-secondary)" }}>Safe</span>
        </div>
        <div
          className="flex flex-col rounded border px-2 py-1.5"
          style={{
            borderColor: atRiskCount > 0 ? "color-mix(in srgb, var(--error) 30%, var(--comp-border))" : "var(--comp-border)",
          }}
        >
          <span
            className="text-sm font-bold tabular-nums"
            style={{ color: atRiskCount > 0 ? "var(--error)" : "var(--comp-text-secondary)" }}
          >
            {atRiskCount}
          </span>
          <span className="text-[10px]" style={{ color: "var(--comp-text-secondary)" }}>Risk</span>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <ChartContainer config={chartConfig} className="h-full w-full">
          <BarChart
            data={subjects}
            margin={{ top: 4, right: 4, left: 0, bottom: needsAngle ? 26 : 10 }}
            barCategoryGap={needsAngle ? 4 : 8}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" vertical={false} />
            <XAxis
              dataKey="subject"
              tickLine={false}
              axisLine={false}
              fontSize={10}
              angle={needsAngle ? -28 : 0}
              textAnchor={needsAngle ? "end" : "middle"}
              interval={0}
              tick={{ fill: "var(--comp-text-secondary)" }}
            />
            <YAxis
              domain={[0, 100]}
              tickLine={false}
              axisLine={false}
              fontSize={10}
              width={28}
              tickCount={5}
              tickFormatter={(value) => `${value}%`}
              tick={{ fill: "var(--comp-text-secondary)" }}
            />
            <ChartTooltip
              cursor={{ fill: "rgba(0,0,0,0.08)" }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div
                      className="rounded-lg border p-3 shadow-lg"
                      style={{ background: "var(--comp-surface)", borderColor: "var(--comp-border)" }}
                    >
                      <p className="font-medium" style={{ color: "var(--comp-text-primary)" }}>
                        {data.fullSubject}
                      </p>
                      {data.description && (
                        <p className="text-xs" style={{ color: "var(--comp-text-secondary)" }}>
                          {data.description}
                        </p>
                      )}
                      <p className="mt-1 text-sm" style={{ color: data.fill }}>
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
              strokeDasharray="4 4"
              strokeWidth={1}
              label={{
                value: "75%",
                position: "right",
                fontSize: 9,
                fill: "var(--error)",
              }}
            />
            <Bar
              dataKey="attendance"
              strokeWidth={0}
              radius={[3, 3, 0, 0]}
              maxBarSize={needsAngle ? 32 : 42}
            />
          </BarChart>
        </ChartContainer>
      </div>
    </div>
  );
}

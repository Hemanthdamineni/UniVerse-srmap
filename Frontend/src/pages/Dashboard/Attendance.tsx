import { useMemo } from "react";
import { ChartContainer, ChartTooltip } from "../../components/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine } from "recharts";
import { executePipeline, type AttendanceModel } from "../../lib/erp/erpTransformers";
import { EmptyState } from "../../components/ui/Feedback";

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
  const safeCount = records.filter((r) => r.attendancePct >= 75).length;

  // Secondary stats: one visual weight (text-sm value + label-text caption);
  // the average above them carries the headline role.
  const subjects = records.map((record) => ({
    subject: record.subjectCode,
    fullSubject: record.subjectCode,
    description: record.subjectDescription,
    attendance: record.attendancePct,
    fill: getTierColor(record.attendancePct),
  }));

  const secondaryStats = [
    { key: "lowest", caption: "Lowest", value: `${lowestPct.toFixed(0)}%`, color: "var(--error)" },
    { key: "safe", caption: "Safe", value: `${safeCount}/${subjects.length}`, color: "var(--success)" },
    {
      key: "risk",
      caption: "Risk",
      value: `${atRiskCount}`,
      color: atRiskCount > 0 ? "var(--error)" : "var(--comp-text-secondary)",
      tinted: atRiskCount > 0,
    },
  ];

  const chartConfig = { attendance: { label: "Attendance", color: "var(--accent-blue)" } };
  const needsAngle = subjects.length > 5;

  return (
    <div className="flex h-full flex-col p-4">
      <h2 className="card-title mb-3 font-semibold shrink-0">Attendance</h2>

      {/* Headline average + secondary stat tiles */}
      <div className="mb-3 shrink-0 rounded border border-[var(--comp-border)] p-2 flex items-baseline justify-between gap-2">
        <span className="text-xl font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>{avgPct.toFixed(0)}%</span>
        <span className="label-text">Avg</span>
      </div>
      <div className="mb-2 grid shrink-0 grid-cols-3 gap-2">
        {secondaryStats.map(({ key, caption, value, color, tinted }) => (
          <div
            key={key}
            className="flex flex-col rounded border p-2"
            style={{
              borderColor: tinted ? "color-mix(in srgb, var(--error) 30%, var(--comp-border))" : "var(--comp-border)",
              background: tinted ? "color-mix(in srgb, var(--error) 12%, var(--comp-surface))" : undefined,
            }}
          >
            <span className="text-sm font-semibold tabular-nums" style={{ color }}>{value}</span>
            <span className="label-text">{caption}</span>
          </div>
        ))}
      </div>

      <div className="flex-1 min-h-0">
        <ChartContainer config={chartConfig} className="aspect-auto h-full w-full">
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
              cursor={{ fill: "color-mix(in srgb, var(--text-primary) 8%, transparent)" }}
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

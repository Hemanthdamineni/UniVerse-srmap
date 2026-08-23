import { useMemo } from "react";
import { ChartContainer } from "../../components/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ReferenceLine, ResponsiveContainer } from "recharts";

interface GpaTrendPoint {
  semester: string;
  sgpa: number;
}

interface GpaTrendChartProps {
  data: GpaTrendPoint[];
  className?: string;
  height?: number;
  showReferenceLines?: boolean;
  showTrendIndicator?: boolean;
}

function getSgpaColor(sgpa: number): string {
  if (sgpa >= 8) return "var(--success)";
  if (sgpa >= 6) return "var(--warning)";
  return "var(--error)";
}

export default function GpaTrendChart({
  data,
  className = "",
  height = 140,
  showReferenceLines = true,
  showTrendIndicator = true,
}: GpaTrendChartProps) {

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.map((point, index) => ({
      semester: point.semester,
      sgpa: point.sgpa,
      fill: getSgpaColor(point.sgpa),
      index,
    }));
  }, [data]);

  const maxSgpa = useMemo(() => {
    if (!data || data.length === 0) return 10;
    return Math.max(...data.map((p) => p.sgpa));
  }, [data]);

  const minSgpa = useMemo(() => {
    if (!data || data.length === 0) return 0;
    return Math.min(...data.map((p) => p.sgpa));
  }, [data]);

  const domainMin = Math.max(0, Math.floor(minSgpa - 0.5));
  const domainMax = Math.min(10, Math.ceil(maxSgpa + 0.5));

  // Calculate overall trend
  const overallTrend = useMemo(() => {
    if (!data || data.length < 2) return 0;
    return data[data.length - 1].sgpa - data[0].sgpa;
  }, [data]);

  const avgSgpa = useMemo(() => {
    if (!data || data.length === 0) return 0;
    return data.reduce((sum, p) => sum + p.sgpa, 0) / data.length;
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <div className={`flex h-${height}px items-center justify-center ${className}`}>
        <div className="text-center p-4">
          <svg
            className="mx-auto h-10 w-10 mb-2"
            style={{ color: "var(--comp-text-muted)" }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <p className="text-sm font-medium" style={{ color: "var(--comp-text-secondary)" }}>No GPA data yet</p>
          <p className="text-xs mt-1" style={{ color: "var(--comp-text-muted)" }}>Complete a semester to see your trend</p>
        </div>
      </div>
    );
  }

  const chartConfig = {
    sgpa: { label: "SGPA", color: "var(--comp-accent)" },
  };

  // Determine if we have enough data for meaningful reference lines
  const hasRange = maxSgpa - minSgpa > 1;

  return (
    <div className={`w-full ${className}`}>
      {/* Header with summary stats */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium" style={{ color: "var(--comp-text-secondary)" }}>Average</span>
          <span className="text-lg font-semibold tabular-nums" style={{ color: "var(--comp-text-primary)" }}>
            {avgSgpa.toFixed(2)}
          </span>
        </div>
        {showTrendIndicator && overallTrend !== 0 && (
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium"
            style={{
              backgroundColor: overallTrend > 0 ? "color-mix(in srgb, var(--success) 15%, transparent)" : "color-mix(in srgb, var(--error) 15%, transparent)",
              color: overallTrend > 0 ? "var(--success)" : "var(--error)",
            }}
          >
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5} aria-hidden="true">
              {overallTrend > 0 ? (
                <polyline points="18 15 12 9 6 15" />
              ) : (
                <polyline points="6 9 12 15 18 9" />
              )}
            </svg>
            <span>{overallTrend > 0 ? "+" : ""}{overallTrend.toFixed(2)} overall</span>
          </div>
        )}
        <div className="flex items-center gap-3 text-xs" style={{ color: "var(--comp-text-muted)" }}>
          <span>Range: {minSgpa.toFixed(1)} – {maxSgpa.toFixed(1)}</span>
          <span>{data.length} semester{data.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      <ChartContainer config={chartConfig} className="w-full" style={{ height: `${height}px` }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 4, right: 12, left: 0, bottom: 0 }}
            layout="vertical"
            barCategoryGap={12}
          >
            <defs>
              {chartData.map((entry) => (
                <linearGradient key={`grad-${entry.index}`} id={`sgpa-gradient-${entry.index}`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={entry.fill} stopOpacity={0.9} />
                  <stop offset="100%" stopColor={entry.fill} stopOpacity={0.3} />
                </linearGradient>
              ))}
              {/* Subtle highlight gradient for top of bars */}
              {chartData.map((entry) => (
                <linearGradient key={`highlight-${entry.index}`} id={`sgpa-highlight-${entry.index}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="white" stopOpacity={0.15} />
                  <stop offset="30%" stopColor="white" stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              horizontal={true}
              stroke="var(--comp-border)"
              strokeOpacity={0.3}
            />

            <XAxis
              type="number"
              domain={[domainMin, domainMax]}
              tickLine={false}
              axisLine={false}
              tickCount={4}
              tickFormatter={(value) => value.toFixed(1)}
              tick={{ fill: "var(--comp-text-secondary)", fontSize: 10 }}
              tickMargin={8}
              width={36}
              interval={0}
              scale="linear"
              reversed // So 0 is at bottom, 10 at top
            />

            <YAxis
              type="category"
              dataKey="semester"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--comp-text-primary)", fontSize: 11, fontWeight: 500 }}
              tickMargin={8}
              width={50}
              interval={0}
            />

            <Tooltip
              cursor={{
                fill: "rgba(0,0,0,0.04)",
                stroke: "var(--comp-border)",
                strokeWidth: 1,
              }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const item = payload[0].payload;
                  const rank = item.index + 1;
                  const total = chartData.length;
                  const isLatest = item.index === total - 1;

                  return (
                    <div
                      className="rounded-lg border p-3 shadow-lg min-w-[160px]"
                      style={{
                        background: "var(--comp-surface)",
                        borderColor: "var(--comp-border)",
                        boxShadow: "0 8px 24px -8px rgba(0,0,0,0.12), 0 4px 12px -4px rgba(0,0,0,0.08)",
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium text-sm" style={{ color: "var(--comp-text-primary)" }}>
                          {item.semester}
                        </p>
                        {isLatest && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                            style={{
                              background: "color-mix(in srgb, var(--comp-accent) 15%, transparent)",
                              color: "var(--comp-accent)",
                            }}
                          >
                            Latest
                          </span>
                        )}
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold tabular-nums" style={{ color: item.fill }}>
                          {item.sgpa.toFixed(2)}
                        </span>
                        <span className="text-xs" style={{ color: "var(--comp-text-muted)" }}>SGPA</span>
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-[11px]" style={{ color: "var(--comp-text-secondary)" }}>
                        <span>Semester {rank} of {total}</span>
                        {item.index > 0 && (
                          <>
                            <span className="w-px h-3" style={{ background: "var(--comp-border)" }} />
                            <span>
                              {item.sgpa > chartData[item.index - 1].sgpa ? "↑" : item.sgpa < chartData[item.index - 1].sgpa ? "↓" : "→"}
                              {(item.sgpa - chartData[item.index - 1].sgpa).toFixed(2)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />

            {showReferenceLines && hasRange && (
              <>
                <ReferenceLine
                  y={7}
                  stroke="var(--warning)"
                  strokeDasharray="2 4"
                  strokeWidth={1}
                  label={{
                    value: "7.0 — Good",
                    position: "left",
                    offset: 4,
                    fontSize: 9,
                    fill: "var(--warning)",
                  }}
                />
                <ReferenceLine
                  y={8}
                  stroke="var(--success)"
                  strokeDasharray="2 4"
                  strokeWidth={1}
                  label={{
                    value: "8.0 — Excellent",
                    position: "left",
                    offset: 4,
                    fontSize: 9,
                    fill: "var(--success)",
                  }}
                />
              </>
            )}

            <Bar
              dataKey="sgpa"
              radius={[0, 4, 4, 0]}
              barSize={28}
              layout="vertical"
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={`url(#sgpa-gradient-${entry.index})`}
                  stroke={`url(#sgpa-highlight-${entry.index})`}
                  strokeWidth={1}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartContainer>

      {/* Legend / Key */}
      <div className="flex flex-wrap items-center gap-3 mt-3 pt-2 border-t" style={{ borderColor: "var(--comp-border)" }}>
        <span className="text-xs" style={{ color: "var(--comp-text-muted)" }}>Performance:</span>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ background: "var(--success)" }} />
            <span className="text-xs" style={{ color: "var(--comp-text-secondary)" }}>≥ 8.0</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ background: "var(--warning)" }} />
            <span className="text-xs" style={{ color: "var(--comp-text-secondary)" }}>6.0 – 7.9</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ background: "var(--error)" }} />
            <span className="text-xs" style={{ color: "var(--comp-text-secondary)" }}>{'<'} 6.0</span>
          </div>
        </div>
      </div>
    </div>
  );
}
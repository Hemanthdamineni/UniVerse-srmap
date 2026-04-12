import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { useMemo, useState } from "react";
import { executePipeline, type InternalMarksModel, type InternalMarkSubject } from "../../lib/erpTransformers";

function InternalMarks({ marksData }: { marksData?: any }) {
  const [selectedCourse, setSelectedCourse] = useState<InternalMarkSubject | null>(null);

  const processedData = useMemo(() => {
    const pipelineResult = executePipeline("internal-marks", marksData);
    if (!pipelineResult?.isValid || !pipelineResult.data) return null;

    const { subjects, averagePercentage } = pipelineResult.data as InternalMarksModel;

    const pieData = [
      {
        name: "Excellent (>=80%)",
        value: subjects.filter((subject) => subject.percentage >= 80).length,
        color: "var(--success)",
      },
      {
        name: "Good (60-79%)",
        value: subjects.filter((subject) => subject.percentage >= 60 && subject.percentage < 80).length,
        color: "var(--warning)",
      },
      {
        name: "Needs Improvement (<60%)",
        value: subjects.filter((subject) => subject.percentage < 60).length,
        color: "var(--error)",
      },
    ].filter((item) => item.value > 0);

    return {
      subjects,
      pieData,
      averagePercentage,
      detailTables: marksData?.Examination?.["Internal Mark Details"]?.tables || marksData?.Academic?.["Internal Mark Details"]?.tables || [],
    };
  }, [marksData]);
  if (!processedData) {
    return (
      <div className="h-full p-4 flex flex-col justify-center items-center text-center">
        <h2 className="text-xl font-bold tracking-tight text-[var(--text-primary)] mb-1">Internal Marks</h2>
        <p className="text-xs text-[var(--text-secondary)] font-medium">No internal marks data available for this semester.</p>
      </div>
    );
  }

  const { subjects, pieData, averagePercentage } = processedData;
  const atRiskCount = subjects.filter((subject) => subject.percentage < 60).length;

  const getStatusColor = (status: "excellent" | "good" | "needs-improvement") => {
    switch (status) {
      case "excellent": return "var(--success)";
      case "good": return "var(--warning)";
      case "needs-improvement": return "var(--error)";
    }
  };

  return (
    <div className="h-full flex flex-col p-4">
      <header className="shrink-0 mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
          Internal Marks
        </h2>
      </header>

      <div className="flex-1 min-h-0 flex gap-4">
        {/* Left Area: 1. Donut Chart & 2. Legend */}
        <div className="w-[140px] shrink-0 flex flex-col h-full">
          <div className="relative aspect-square max-h-[140px] flex items-center justify-center">
            {subjects.length > 0 && (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      dataKey="value"
                      stroke="none"
                      paddingAngle={1}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`pie-cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-lg font-bold text-[var(--text-primary)] leading-tight">{averagePercentage.toFixed(0)}%</span>
                  <span className="text-[7px] font-medium text-[var(--text-secondary)]">average</span>
                </div>
              </>
            )}
          </div>

          <div className="shrink-0 flex flex-col gap-1 mt-auto">
            <div className="flex items-center justify-between rounded bg-[color-mix(in_srgb,var(--surface)_50%,transparent)] border border-[color-mix(in_srgb,var(--border)_40%,transparent)] px-2 py-1">
              <div className="flex items-center gap-1.5 overflow-hidden">
                <span className="h-1.5 w-1.5 rounded-full shrink-0 bg-[var(--error)]" />
                <span className="text-[9px] font-medium text-[var(--text-secondary)] truncate">Needs Improvement (&lt;60%)</span>
              </div>
              <span className="text-[10px] font-bold text-[var(--text-primary)] ml-1">{atRiskCount}</span>
            </div>
          </div>
        </div>

        {/* Right Area: 3. Dynamic Grid of Course Cards (or Details) */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {selectedCourse ? (
            <div className="flex flex-col h-full bg-[color-mix(in_srgb,var(--surface)_30%,transparent)] border border-[color-mix(in_srgb,var(--border)_80%,transparent)] rounded-xl p-3 shadow-sm">
              <div className="flex items-center justify-between shrink-0 mb-3">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Course Details</h3>
                <button
                  type="button"
                  onClick={() => setSelectedCourse(null)}
                  className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[9px] font-bold text-[var(--text-primary)] hover:opacity-70 transition-opacity"
                >
                  Back
                </button>
              </div>

              <div className="flex flex-col flex-1 min-h-0 overflow-y-auto pr-1">
                <div className="mb-3 text-center">
                  <p className="text-sm font-bold text-[var(--text-primary)] leading-snug">{selectedCourse.code}</p>
                  <p className="text-[10px] text-[var(--text-secondary)] leading-tight">{selectedCourse.description}</p>
                </div>
                
                {/* 4. Details displayed generically from tables instead of hardcoded mid/cla1/etc */}
                <div className="flex flex-col gap-1.5">
                  {(processedData.detailTables.length > selectedCourse.detailTableIndex && Array.isArray(processedData.detailTables[selectedCourse.detailTableIndex]) 
                    ? processedData.detailTables[selectedCourse.detailTableIndex] 
                    : []
                  ).map((row: any, idx: number) => {
                    const label = String(row?.Name ?? row?.["Subject Code"] ?? "");
                    const value = String(row?.["Mark Secured(Conducted)"] ?? row?.["Subject Description"] ?? "");
                    
                    if (!label || label.toLowerCase().includes("name") || label.length < 2) return null;
                    
                    const isMissing = value.trim().toLowerCase() === "not available" || value.trim() === "" || value.trim() === "-";
                    return (
                      <div
                        key={`${label}-${idx}`}
                        className="flex items-center justify-between rounded bg-[color-mix(in_srgb,var(--surface)_50%,transparent)] border border-[color-mix(in_srgb,var(--border)_40%,transparent)] px-2.5 py-2 flex-1 min-h-[28px]"
                      >
                        <span className="text-[10px] font-medium text-[var(--text-secondary)] truncate mr-2">{label}</span>
                        <span className={`text-[11px] font-bold truncate ${isMissing ? "text-[color-mix(in_srgb,var(--text-secondary)_60%,transparent)] italic" : "text-[var(--text-primary)]"}`}>
                          {isMissing ? "N/A" : value}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto pr-1">
              {/* Dynamic responsive grid: 2 cols on small, 3 cols on medium/large widgets */}
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 auto-rows-max">
                {subjects.map((subject, index) => (
                  <button
                    type="button"
                    key={`${subject.code}-${index}`}
                    onClick={() => setSelectedCourse(subject)}
                    className="flex flex-col bg-[color-mix(in_srgb,var(--surface)_50%,transparent)] border border-[color-mix(in_srgb,var(--border)_50%,transparent)] rounded-lg p-2.5 text-left hover:border-[var(--text-secondary)] transition-colors w-full group"
                  >
                    <span className="truncate text-xs font-bold text-[var(--text-primary)] mb-1">
                      {subject.code}
                    </span>
                    
                    <div className="flex items-end justify-between w-full mb-1">
                      <span className="text-[10px] font-bold text-[var(--text-primary)]">
                        {subject.marksObtained}<span className="text-[8px] text-[var(--text-secondary)]">/{subject.maxMarks}</span>
                      </span>
                      <span className="text-[10px] font-bold shrink-0" style={{ color: getStatusColor(subject.status) }}>
                        {subject.percentage.toFixed(1)}%
                      </span>
                    </div>
                    
                    <div className="h-1.5 w-full rounded-full bg-[color-mix(in_srgb,var(--border)_80%,transparent)] overflow-hidden">
                      <div
                        className="h-full rounded-full opacity-80 group-hover:opacity-100 transition-opacity"
                        style={{ width: `${Math.max(0, Math.min(100, subject.percentage))}%`, backgroundColor: getStatusColor(subject.status) }}
                      />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default InternalMarks;

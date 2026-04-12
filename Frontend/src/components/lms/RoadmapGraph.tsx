import type { LmsRoadmap } from "../../lib/lmsApi";

export default function RoadmapGraph({
  roadmap,
  onComplete,
}: {
  roadmap: LmsRoadmap;
  onComplete?: (nodeId: string) => Promise<void>;
}) {
  const completed = new Set(roadmap.userProgress?.completedNodes || []);

  return (
    <div className="grid gap-3">
      {roadmap.nodes.map((node) => (
        <div key={node.id} className="dashboard-card flex items-start justify-between gap-3 p-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              {node.nodeType}
            </p>
            <h3 className="text-base font-semibold text-[#0A3035]">{node.title}</h3>
            {node.description ? (
              <p className="text-sm text-[var(--text-secondary)]">{node.description}</p>
            ) : null}
          </div>
          {onComplete ? (
            <button
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                completed.has(node.id)
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-[#0A3035] text-white"
              }`}
              onClick={() => onComplete(node.id)}
            >
              {completed.has(node.id) ? "Completed" : "Mark done"}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

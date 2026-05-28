import { useMemo } from "react";
import type { LmsRoadmap, LmsRoadmapNode } from "../../lib/lmsApi";

// Internal view-model for node rendering
interface NodeState {
  node: LmsRoadmapNode;
  isCompleted: boolean;
  isLocked: boolean;
  isCurrent: boolean;
  isOptional: boolean;
}

function getNodeTypeLabel(type: string) {
  switch (type) {
    case "concept": return "Concept";
    case "resource": return "Resource";
    case "quiz": return "Quiz";
    case "milestone": return "Milestone";
    default: return type;
  }
}

function RoadmapProgressHeader({
  completedCount,
  totalCount,
  percentage
}: {
  completedCount: number;
  totalCount: number;
  percentage: number;
}) {
  return (
    <div className="dashboard-card p-5 mb-6">
      <div className="flex justify-between items-end mb-3">
        <div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--comp-text-primary)' }}>Roadmap Progress</h2>
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            {completedCount} of {totalCount} required completed
          </p>
        </div>
        <div className="text-2xl font-black" style={{ color: 'var(--comp-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
          {percentage}%
        </div>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: 'var(--comp-border)' }}>
        <div
          className="h-full rounded-full"
          style={{ 
            width: `${percentage}%`, 
            background: 'var(--success)',
            transition: 'transform var(--duration-slow) var(--ease-out)'
          }}
        />
      </div>
    </div>
  );
}

function RoadmapNodeItem({
  state,
  onComplete,
}: {
  state: NodeState;
  onComplete?: (nodeId: string) => Promise<void>;
}) {
  const { node, isCompleted, isLocked, isCurrent, isOptional } = state;
  const isMilestone = node.nodeType === "milestone";

  return (
    <div className="relative flex items-start gap-4 md:gap-6 group">
      {/* Timeline Marker Area */}
      <div className="relative z-10 flex shrink-0 flex-col items-center justify-start w-6 md:w-8 pt-4">
        <div 
          className="flex items-center justify-center rounded-full"
          style={{
            width: isMilestone ? 24 : 20,
            height: isMilestone ? 24 : 20,
            border: `2px solid ${
              isCompleted ? 'var(--success)' : 
              isCurrent ? 'var(--comp-accent)' : 
              'var(--comp-border)'
            }`,
            borderStyle: (isOptional && !isCompleted && !isCurrent) ? 'dashed' : 'solid',
            background: isCompleted ? 'var(--success)' : 'var(--comp-surface)',
            boxShadow: isCurrent ? '0 0 0 4px color-mix(in srgb, var(--comp-accent) 15%, transparent)' : 'none',
            transition: 'all var(--duration-normal) var(--ease-out)',
          }}
        >
          {isCompleted && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          )}
        </div>
      </div>

      {/* Content Card Area */}
      <div 
        className="dashboard-card flex-1 p-4 md:p-5 flex flex-col sm:flex-row gap-4 justify-between items-start"
        style={{
          opacity: isLocked ? 0.6 : 1,
          border: isCurrent ? '1px solid var(--comp-accent)' : '1px solid var(--comp-border)',
          boxShadow: isCurrent ? 'var(--shadow-md)' : 'var(--shadow-sm)',
          transition: 'all var(--duration-normal) var(--ease-out)',
        }}
      >
        <div className="flex-1 space-y-2 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span 
              className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm"
              style={{
                background: isMilestone 
                  ? 'color-mix(in srgb, var(--comp-accent) 10%, transparent)' 
                  : 'color-mix(in srgb, var(--comp-border) 40%, transparent)',
                color: isMilestone ? 'var(--comp-accent)' : 'var(--text-secondary)'
              }}
            >
              {getNodeTypeLabel(node.nodeType)}
            </span>
            {isOptional && (
              <span 
                className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm"
                style={{
                  border: '1px dashed var(--comp-border)',
                  color: 'var(--comp-text-muted)'
                }}
              >
                Optional
              </span>
            )}
            {isLocked && (
              <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1" style={{ color: 'var(--comp-text-muted)' }}>
                🔒 Locked
              </span>
            )}
          </div>

          <h3 
            className="font-bold"
            style={{ 
              color: isLocked ? 'var(--text-secondary)' : 'var(--comp-text-primary)',
              fontSize: isMilestone ? 'var(--text-xl)' : 'var(--text-sm)',
            }}
          >
            {node.title}
          </h3>

          {node.description && (
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {node.description}
            </p>
          )}
        </div>

        {onComplete && !isLocked && (
          <div className="shrink-0 mt-2 sm:mt-0">
            <button
              className="rounded-full px-4 py-2 text-sm font-semibold transition-colors w-full sm:w-auto"
              style={{
                background: isCompleted 
                  ? 'color-mix(in srgb, var(--success) 10%, transparent)' 
                  : 'var(--comp-accent)',
                color: isCompleted ? 'var(--success)' : 'var(--background)',
                border: isCompleted ? '1px solid color-mix(in srgb, var(--success) 30%, transparent)' : '1px solid transparent',
              }}
              onClick={() => onComplete(node.id)}
              aria-label={isCompleted ? `Mark ${node.title} incomplete` : `Mark ${node.title} complete`}
            >
              {isCompleted ? "Completed ✓" : "Mark done"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function RoadmapGraph({
  roadmap,
  onComplete,
}: {
  roadmap: LmsRoadmap;
  onComplete?: (nodeId: string) => Promise<void>;
}) {
  const completedSet = useMemo(
    () => new Set(roadmap.userProgress?.completedNodes || []),
    [roadmap.userProgress?.completedNodes]
  );

  const edges = roadmap.edges || [];

  // Derive all state logically before rendering
  const nodeStates = useMemo(() => {
    // 1. Sort nodes safely by topological/position order
    const sortedNodes = [...roadmap.nodes].sort((a, b) => a.position - b.position);

    const states: NodeState[] = [];

    // Pass 1: Compute basic properties (completed, optional, locked)
    for (const node of sortedNodes) {
      const isCompleted = completedSet.has(node.id);
      const isOptional = Boolean(node.isOptional);

      // A node is locked if any of its prerequisites (incoming edges) are not completed
      const prerequisites = edges.filter((e) => e.toNodeId === node.id).map((e) => e.fromNodeId);
      const isLocked = prerequisites.some((prereqId) => !completedSet.has(prereqId));

      states.push({
        node,
        isCompleted,
        isLocked,
        isCurrent: false, // Set in pass 2
        isOptional,
      });
    }

    // Pass 2: Identify the "current" active node.
    // The current node is the FIRST incomplete, unlocked node.
    let foundCurrent = false;
    for (const state of states) {
      if (!state.isCompleted && !state.isLocked && !foundCurrent) {
        state.isCurrent = true;
        // Only mark the primary REQUIRED node as the single current path blocker
        if (!state.isOptional) {
          foundCurrent = true;
        }
      }
    }

    return states;
  }, [roadmap.nodes, edges, completedSet]);

  const totalRequired = useMemo(() => roadmap.nodes.filter(n => !n.isOptional).length, [roadmap.nodes]);
  const completedRequired = useMemo(() => roadmap.nodes.filter(n => !n.isOptional && completedSet.has(n.id)).length, [roadmap.nodes, completedSet]);
  const progressPct = totalRequired > 0 ? Math.round((completedRequired / totalRequired) * 100) : 0;

  return (
    <div className="w-full">
      <RoadmapProgressHeader 
        completedCount={completedRequired} 
        totalCount={totalRequired} 
        percentage={progressPct} 
      />

      <div className="relative">
        {/* Continuous Vertical Spine */}
        {nodeStates.length > 0 && (
          <div 
            className="absolute top-8 bottom-12 w-0.5 rounded-full"
            style={{ 
              background: 'var(--comp-border)',
              left: '11px', // w-6 (24px) / 2 - 1px
              '@media (min-width: 768px)': {
                left: '15px' // md:w-8 (32px) / 2 - 1px
              }
            } as any}
          >
            {/* The media query in inline styles isn't strictly valid in React, so we use twin divs to handle responsiveness cleanly */}
            <div className="absolute inset-0 block md:hidden" style={{ background: 'var(--comp-border)', width: 2, left: 0 }} />
            <div className="absolute inset-0 hidden md:block" style={{ background: 'var(--comp-border)', width: 2, left: 4 }} />
          </div>
        )}

        {/* Node Sequence */}
        <div className="flex flex-col gap-6">
          {nodeStates.map((state) => (
            <RoadmapNodeItem 
              key={state.node.id} 
              state={state} 
              onComplete={onComplete}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

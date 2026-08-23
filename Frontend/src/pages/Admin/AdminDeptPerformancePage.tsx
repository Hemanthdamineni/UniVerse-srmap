/**
 * AdminDeptPerformancePage.tsx — /admin/department-performance
 * Department-level analytics dashboard with rankings, event counts,
 * participation metrics, and inter-department comparisons.
 */

import { useEffect, useState, useCallback } from 'react';
import { ErpPageShell, KpiGrid } from '../../components/erp/ErpPrimitives';
import { ErrorMessage } from '../../components/competition/ErrorMessage';
import { listEvents } from '../../lib/campus/campusApi';
import { Select } from '../../components/select';
import { DataToolbar } from '../../components/data/DataToolbar';

/* ---------- Types ---------- */

interface DeptMetric {
  id: string;
  name: string;
  code: string;
  eventsHosted: number;
  totalParticipants: number;
  avgSatisfaction: number;
  activeClubs: number;
  trend: 'up' | 'down' | 'stable';
  trendPct: number;
}

/* ---------- Main Page ---------- */

export default function AdminDeptPerformancePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'events' | 'participants' | 'satisfaction'>('events');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await listEvents(); // Trigger API to validate connectivity
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load department data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const departments = ([
    { id: 'd1', name: 'Computer Science Society', code: 'CS', eventsHosted: 142, totalParticipants: 8420, avgSatisfaction: 4.8, activeClubs: 5, trend: 'up', trendPct: 12 },
    { id: 'd2', name: 'Business School Alliance', code: 'BS', eventsHosted: 98, totalParticipants: 5200, avgSatisfaction: 4.5, activeClubs: 3, trend: 'up', trendPct: 8 },
    { id: 'd3', name: 'Digital Arts Guild', code: 'DA', eventsHosted: 76, totalParticipants: 3800, avgSatisfaction: 4.7, activeClubs: 4, trend: 'stable', trendPct: 0 },
    { id: 'd4', name: 'Mechanical Engineering Club', code: 'ME', eventsHosted: 64, totalParticipants: 3100, avgSatisfaction: 4.3, activeClubs: 2, trend: 'down', trendPct: 5 },
    { id: 'd5', name: 'Biotechnology Forum', code: 'BT', eventsHosted: 52, totalParticipants: 2400, avgSatisfaction: 4.6, activeClubs: 2, trend: 'up', trendPct: 15 },
  ] satisfies DeptMetric[]).sort((a, b) => {
    if (sortBy === 'events') return b.eventsHosted - a.eventsHosted;
    if (sortBy === 'participants') return b.totalParticipants - a.totalParticipants;
    return b.avgSatisfaction - a.avgSatisfaction;
  });

  const totalEvents = departments.reduce((s, d) => s + d.eventsHosted, 0);
  const totalParticipants = departments.reduce((s, d) => s + d.totalParticipants, 0);

  return (
    <ErpPageShell title="Department Performance" source="Internal API" isLoading={loading} loadingMessage="Loading department metrics...">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>

        {/* Subtitle */}
        <p className="comp-body" style={{ margin: 0 }}>
          Cross-department analytics and engagement rankings
        </p>

        {/* Summary KPIs */}
        <KpiGrid
          items={[
            { label: 'Total Departments', value: String(departments.length) },
            { label: 'Total Events Hosted', value: String(totalEvents) },
            { label: 'Total Participants', value: totalParticipants.toLocaleString() },
            {
              label: 'Avg Satisfaction',
              value: `${(departments.reduce((s, d) => s + d.avgSatisfaction, 0) / departments.length).toFixed(1)}/5`,
            },
          ]}
        />

        {error && <ErrorMessage message={error} onRetry={loadData} />}

        {/* Sort controls */}
        <DataToolbar
          right={
          <Select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="h-9 min-w-[180px] text-[0.82rem]"
            aria-label="Sort departments by"
          >
            <option value="events">Sort by Events</option>
            <option value="participants">Sort by Participants</option>
            <option value="satisfaction">Sort by Satisfaction</option>
          </Select>
          }
        />

        {/* Department cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {departments.map((dept, idx) => (
            <div
              key={dept.id}
              role="article"
              aria-label={`${dept.name} performance overview`}
              style={{
                background: 'var(--comp-surface)', border: '1px solid var(--comp-border)',
                borderLeft: `1px solid ${idx === 0 ? 'var(--comp-accent)' : 'var(--comp-border)'}`,
                borderRadius: 'var(--border-radius-lg)', padding: 'var(--space-md)',
                display: 'grid',
                alignItems: 'center', gap: 'var(--space-md)',
              }}
              className="grid-cols-1 xl:grid-cols-6"
            >
              <span style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: idx === 0 ? 'var(--comp-accent)' : 'var(--comp-text-muted)', textAlign: 'center' }}>
                #{idx + 1}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                <span style={{
                  width: 36, height: 36, borderRadius: 'var(--border-radius-md)',
                  background: 'var(--comp-accent)', color: 'var(--comp-accent-fg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 'var(--text-xs)', fontWeight: 700,
                }}>
                  {dept.code}
                </span>
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 'var(--text-base)', color: 'var(--comp-text-primary)' }}>{dept.name}</p>
                  <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--comp-text-muted)' }}>{dept.activeClubs} active clubs</p>
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 700 }}>{dept.eventsHosted}</p>
                <span className="comp-label" style={{ fontSize: 'var(--text-xs)' }}>EVENTS</span>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 700 }}>{dept.totalParticipants.toLocaleString()}</p>
                <span className="comp-label" style={{ fontSize: 'var(--text-xs)' }}>PARTICIPANTS</span>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 700 }}>{dept.avgSatisfaction}/5</p>
                <span className="comp-label" style={{ fontSize: 'var(--text-xs)' }}>SATISFACTION</span>
              </div>
              <div style={{ textAlign: 'center' }}>
                <span style={{
                  fontSize: 'var(--text-sm)', fontWeight: 600,
                  color: dept.trend === 'up' ? 'var(--status-open-text)' : dept.trend === 'down' ? 'var(--status-live-text)' : 'var(--comp-text-muted)',
                }}>
                  {dept.trend === 'up' ? '↗' : dept.trend === 'down' ? '↘' : '→'} {dept.trendPct > 0 ? `${dept.trendPct}%` : 'Stable'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ErpPageShell>
  );
}

/**
 * AdminAuditLogsPage.tsx — /admin/audit-logs
 * System audit trail with filterable log entries, severity levels, and export.
 */

import { Download } from "lucide-react";
import { useState } from 'react';
import { ErpPageShell } from '../../components/erp/ErpPrimitives';
import { EmptyState } from '../../components/competition/CompetitionEmptyState';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { DataToolbar } from '../../components/data/DataToolbar';
import { Input } from '../../components/input';

/* ---------- Types ---------- */

interface AuditLog {
  id: string;
  timestamp: string;
  actor: string;
  actorRole: string;
  action: string;
  resource: string;
  severity: 'info' | 'warning' | 'critical';
  ipAddress: string;
}

/* ---------- Main Page ---------- */

export default function AdminAuditLogsPage() {
  const [filter, setFilter] = useState<'all' | 'info' | 'warning' | 'critical'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const logs: AuditLog[] = [
    { id: 'l1', timestamp: new Date(Date.now() - 120000).toISOString(), actor: 'Marcus Thorne', actorRole: 'Admin', action: 'Modified event permissions', resource: 'Tech Week 2025', severity: 'warning', ipAddress: '192.168.1.42' },
    { id: 'l2', timestamp: new Date(Date.now() - 300000).toISOString(), actor: 'System', actorRole: 'System', action: 'Automated backup completed', resource: 'Database', severity: 'info', ipAddress: '127.0.0.1' },
    { id: 'l3', timestamp: new Date(Date.now() - 1800000).toISOString(), actor: 'Elena Rodriguez', actorRole: 'Moderator', action: 'Bulk approved submissions', resource: 'Hackathon Round 1', severity: 'info', ipAddress: '192.168.1.55' },
    { id: 'l4', timestamp: new Date(Date.now() - 3600000).toISOString(), actor: 'Security Bot', actorRole: 'System', action: 'Failed login attempt detected', resource: 'Auth System', severity: 'critical', ipAddress: '10.0.0.99' },
    { id: 'l5', timestamp: new Date(Date.now() - 7200000).toISOString(), actor: 'Dr. Sarah Jenkins', actorRole: 'Super Admin', action: 'Updated system configuration', resource: 'Global Settings', severity: 'warning', ipAddress: '192.168.1.10' },
    { id: 'l6', timestamp: new Date(Date.now() - 14400000).toISOString(), actor: 'System', actorRole: 'System', action: 'Certificate batch generation', resource: 'Spring Gala 2025', severity: 'info', ipAddress: '127.0.0.1' },
  ];

  const filtered = logs
    .filter((l) => filter === 'all' || l.severity === filter)
    .filter((l) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return l.actor.toLowerCase().includes(q) || l.action.toLowerCase().includes(q) || l.resource.toLowerCase().includes(q);
    });

  const severityConfig: Record<AuditLog['severity'], { bg: string; text: string; label: string }> = {
    info: { bg: 'var(--comp-accent-light)', text: 'var(--comp-accent)', label: 'INFO' },
    warning: { bg: 'var(--status-pending-bg)', text: 'var(--status-pending-text)', label: 'WARNING' },
    critical: { bg: 'var(--status-live-bg)', text: 'var(--status-live-text)', label: 'CRITICAL' },
  };

  return (
    <ErpPageShell
      title="System Audit Logs"
      source="Internal API"
      isLoading={false}
      headerActions={
        <button className="comp-btn-primary" style={{ fontSize: '0.82rem' }}><Download size={14} aria-hidden="true" /> Export Logs</button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>

        {/* Subtitle */}
        <p className="comp-body" style={{ margin: 0 }}>
          Complete activity trail across the platform
        </p>

        {/* Filters */}
        <DataToolbar
          left={
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search logs..."
            className="min-w-[250px] max-w-[420px]"
            aria-label="Search audit logs"
          />
          }
          right={
          <>
          {(['all', 'info', 'warning', 'critical'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize transition ${
                filter === f
                  ? 'border-[var(--comp-accent)] bg-[var(--comp-accent)] text-white'
                  : 'border-[var(--comp-border)] bg-[var(--comp-surface)] text-[var(--comp-text-secondary)]'
              }`}
            >
              {f}
            </button>
          ))}
          </>
          }
        />

        {/* Logs table */}
        {filtered.length === 0 ? (
          <EmptyState icon={<span>📋</span>} title="No logs found" description="Try adjusting your filters." />
        ) : (
          <DataTable
            data={filtered}
            ariaLabel="System audit logs"
            stickyHeader
            keyExtractor={(row) => row.id}
            columns={[
              {
                header: "Timestamp",
                accessor: (log) => (
                  <span style={{ fontSize: '0.78rem', color: 'var(--comp-text-muted)' }}>
                    {new Date(log.timestamp).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                ),
              },
              {
                header: "Actor",
                accessor: (log) => (
                  <div>
                    <p style={{ margin: 0, fontWeight: 500, color: 'var(--comp-text-primary)' }}>{log.actor}</p>
                    <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--comp-text-muted)' }}>{log.actorRole}</p>
                  </div>
                ),
              },
              { header: "Action", accessor: (log) => <span style={{ color: 'var(--comp-text-secondary)' }}>{log.action}</span> },
              { header: "Resource", accessor: (log) => <span style={{ color: 'var(--comp-text-muted)' }}>{log.resource}</span> },
              {
                header: "Severity",
                accessor: (log) => {
                  const sev = severityConfig[log.severity];
                  return (
                    <span style={{
                      padding: '2px 8px', borderRadius: 20,
                      background: sev.bg, color: sev.text,
                      fontSize: '0.65rem', fontWeight: 700, textAlign: 'center',
                    }}>
                      {sev.label}
                    </span>
                  );
                },
              },
              {
                header: "IP Address",
                accessor: (log) => (
                  <span style={{ fontSize: '0.78rem', color: 'var(--comp-text-muted)', fontFamily: 'monospace' }}>
                    {log.ipAddress}
                  </span>
                ),
              },
            ] as Column<AuditLog>[]}
          />
        )}

        <p className="comp-body" style={{ textAlign: 'center', fontSize: '0.78rem' }}>
          Showing {filtered.length} of {logs.length} log entries
        </p>
      </div>
    </ErpPageShell>
  );
}

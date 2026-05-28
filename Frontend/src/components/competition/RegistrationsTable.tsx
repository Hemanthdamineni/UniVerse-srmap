/**
 * RegistrationsTable.tsx — Selectable, sortable registrations management table.
 * Supports bulk approve/reject, search, and status pill rendering.
 * Matches the registrations_management_table design screen.
 */

import { useState, useMemo } from 'react';
import { Input } from '../input';
import { Select } from '../select';
import { DataToolbar } from '../data/DataToolbar';
import { RowActionButton } from '../data/RowActionButton';

/* ---------- Types ---------- */

export interface Registration {
  id: string;
  studentName: string;
  email: string;
  department: string;
  teamName?: string;
  registrationDate: string;
  status: 'approved' | 'pending' | 'rejected';
}

interface RegistrationsTableProps {
  registrations: Registration[];
  onApprove?: (ids: string[]) => void;
  onReject?: (ids: string[]) => void;
  onExport?: () => void;
}

/* ---------- Status Pill ---------- */

function RegStatusPill({ status }: { status: Registration['status'] }) {
  const config: Record<Registration['status'], { bg: string; text: string; label: string }> = {
    approved: { bg: 'var(--status-open-bg)', text: 'var(--status-open-text)', label: 'APPROVED' },
    pending: { bg: 'var(--status-pending-bg)', text: 'var(--status-pending-text)', label: 'PENDING' },
    rejected: { bg: 'var(--status-live-bg)', text: 'var(--status-live-text)', label: 'REJECTED' },
  };
  const s = config[status];
  return (
    <span style={{
      background: s.bg, color: s.text, padding: '2px 10px', borderRadius: 20,
      fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.04em',
    }}>
      {s.label}
    </span>
  );
}

/* ---------- Main Component ---------- */

export function RegistrationsTable({ registrations, onApprove, onReject, onExport }: RegistrationsTableProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'status'>('date');
  const [page, setPage] = useState(1);
  const perPage = 10;

  const filtered = useMemo(() => {
    let list = [...registrations];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((r) =>
        r.studentName.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.department.toLowerCase().includes(q) ||
        (r.teamName ?? '').toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      if (sortBy === 'name') return a.studentName.localeCompare(b.studentName);
      if (sortBy === 'status') return a.status.localeCompare(b.status);
      return new Date(b.registrationDate).getTime() - new Date(a.registrationDate).getTime();
    });
    return list;
  }, [registrations, searchQuery, sortBy]);

  const paginated = filtered.slice((page - 1) * perPage, page * perPage);
  const totalPages = Math.ceil(filtered.length / perPage);

  const toggleAll = () => {
    if (selected.size === paginated.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(paginated.map((r) => r.id)));
    }
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const total = registrations.length;
  const pending = registrations.filter((r) => r.status === 'pending').length;
  const capacity = Math.max(total, 3000); // Mock capacity

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>

      {/* Header actions */}
      <DataToolbar
        left={
        <Input
          type="text"
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
          placeholder="Search student registrations..."
          className="min-w-[240px] max-w-[420px]"
          aria-label="Search registrations"
        />
        }
        right={
        <>
          {onExport && (
            <button className="comp-btn-primary" onClick={onExport} style={{ fontSize: '0.82rem' }}>
              ↓ Export CSV
            </button>
          )}
          <Select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            aria-label="Sort registrations"
            className="h-9 min-w-[160px] text-[0.82rem]"
          >
            <option value="date">Sort by Date</option>
            <option value="name">Sort by Name</option>
            <option value="status">Sort by Status</option>
          </Select>
        </>
        }
      />

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--space-sm)',
          padding: 'var(--space-sm) var(--space-md)',
          background: 'var(--comp-accent-light)', borderRadius: 8,
        }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--comp-accent)' }}>
            {selected.size} Selected
          </span>
          {onApprove && (
            <button
              className="comp-btn-primary"
              onClick={() => onApprove(Array.from(selected))}
              style={{ fontSize: '0.78rem', padding: '4px 12px' }}
            >
              ✓ Approve Selected
            </button>
          )}
          {onReject && (
            <button
              className="comp-btn-ghost"
              onClick={() => onReject(Array.from(selected))}
              style={{ fontSize: '0.78rem', padding: '4px 12px', color: 'var(--status-live-text)' }}
            >
              ✕ Reject Selected
            </button>
          )}
        </div>
      )}

      {/* Table */}
      <div style={{
        background: 'var(--comp-surface)', border: '1px solid var(--comp-border)',
        borderRadius: 12, overflow: 'hidden',
      }}>
      <div className="overflow-x-auto">
      <div className="min-w-[860px]">
        {/* Table header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '28px 2fr 1.2fr 1fr 1fr 0.8fr 40px',
          padding: 'var(--space-sm) var(--space-md)',
          borderBottom: '1px solid var(--comp-border)',
          fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em',
          color: 'var(--comp-text-muted)', textTransform: 'uppercase',
          alignItems: 'center',
        }}>
          <input
            type="checkbox"
            checked={selected.size === paginated.length && paginated.length > 0}
            onChange={toggleAll}
            aria-label="Select all"
          />
          <span>Student Name</span>
          <span>Department</span>
          <span>Team Name</span>
          <span>Reg. Date</span>
          <span>Status</span>
          <span />
        </div>

        {/* Rows */}
        {paginated.map((reg) => (
          <div
            key={reg.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '28px 2fr 1.2fr 1fr 1fr 0.8fr 40px',
              padding: 'var(--space-sm) var(--space-md)',
              borderBottom: '1px solid var(--comp-border)',
              alignItems: 'center', fontSize: '0.85rem',
              background: selected.has(reg.id) ? 'var(--comp-accent-light)' : 'transparent',
            }}
          >
            <input
              type="checkbox"
              checked={selected.has(reg.id)}
              onChange={() => toggle(reg.id)}
              aria-label={`Select ${reg.studentName}`}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
              <div className="reg-avatar">
                {reg.studentName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
              </div>
              <div>
                <p style={{ margin: 0, fontWeight: 600, color: 'var(--comp-text-primary)' }}>{reg.studentName}</p>
                <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--comp-text-muted)' }}>{reg.email}</p>
              </div>
            </div>
            <span style={{ color: 'var(--comp-text-secondary)' }}>{reg.department}</span>
            <span style={{ color: 'var(--comp-text-secondary)' }}>{reg.teamName ?? '—'}</span>
            <span style={{ color: 'var(--comp-text-muted)', fontSize: '0.82rem' }}>
              {new Date(reg.registrationDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            <RegStatusPill status={reg.status} />
            <RowActionButton aria-label={`Actions for ${reg.studentName}`}>⋮</RowActionButton>
          </div>
        ))}
      </div>
      </div>

        {/* Pagination */}
        <div className="reg-pagination">
          <span>Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, filtered.length)} of {filtered.length} registrations</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="comp-btn-ghost"
              style={{ padding: '4px 8px', fontSize: '0.78rem' }}
            >
              ‹
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => setPage(n)}
                aria-label={`Go to page ${n}`}
                className={`reg-page-btn ${n === page ? 'reg-page-btn-active' : 'reg-page-btn-inactive'}`}
              >
                {n}
              </button>
            ))}
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="comp-btn-ghost"
              style={{ padding: '4px 8px', fontSize: '0.78rem' }}
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {/* Bottom stats */}
      <div className="grid grid-cols-1 gap-[var(--space-md)] md:grid-cols-3">
        <div style={{
          background: 'var(--comp-surface)', border: '1px solid var(--comp-border)',
          borderRadius: 10, padding: 'var(--space-md)',
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <span className="comp-label" style={{ fontSize: '0.68rem' }}>TOTAL REGISTRATIONS</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: '1.6rem', fontWeight: 800 }}>{total.toLocaleString()}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--status-open-text)' }}>↗ +12% vs last year</span>
          </div>
        </div>
        <div style={{
          background: 'var(--comp-surface)', border: '1px solid var(--comp-border)',
          borderRadius: 10, padding: 'var(--space-md)',
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <span className="comp-label" style={{ fontSize: '0.68rem' }}>AWAITING APPROVAL</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: '1.6rem', fontWeight: 800 }}>{pending}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--comp-text-muted)' }}>Priority: {pending > 10 ? 'High' : 'Normal'}</span>
          </div>
        </div>
        <div style={{
          background: 'var(--comp-surface)', border: '1px solid var(--comp-border)',
          borderRadius: 10, padding: 'var(--space-md)',
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <span className="comp-label" style={{ fontSize: '0.68rem' }}>CAPACITY UTILIZATION</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: '1.6rem', fontWeight: 800 }}>{Math.round((total / capacity) * 100)}%</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--comp-text-muted)' }}>{total.toLocaleString()} / {capacity.toLocaleString()}</span>
          </div>
          <div style={{ height: 4, borderRadius: 2, background: 'var(--comp-border)', overflow: 'hidden' }}>
            <div style={{
              width: `${Math.round((total / capacity) * 100)}%`, height: '100%', borderRadius: 2,
              background: total / capacity > 0.9 ? 'var(--status-live-text)' : 'var(--comp-accent)',
            }} />
          </div>
        </div>
      </div>
    </div>
  );
}

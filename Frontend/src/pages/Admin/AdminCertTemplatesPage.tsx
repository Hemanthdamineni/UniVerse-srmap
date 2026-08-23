/**
 * AdminCertTemplatesPage.tsx — /admin/certificate-templates
 * Certificate template manager for creating and editing certificate designs.
 */

import { useState } from 'react';
import { ErpPageShell, SectionCard } from '../../components/erp/ErpPrimitives';
import { Chip } from '../../components/ui/Chip';
import { StatCard } from '../../components/ui/Progress';
import { EmptyState } from '../../components/competition/CompetitionEmptyState';

/* ---------- Types ---------- */

interface CertTemplate {
  id: string;
  name: string;
  type: 'participation' | 'winner' | 'appreciation' | 'merit';
  lastModified: string;
  usageCount: number;
  status: 'active' | 'draft' | 'archived';
  preview: string; // emoji placeholder
}

/* ---------- Main Page ---------- */

export default function AdminCertTemplatesPage() {
  const [filter, setFilter] = useState<'all' | 'active' | 'draft' | 'archived'>('all');

  const templates: CertTemplate[] = [
    { id: 't1', name: 'Standard Participation', type: 'participation', lastModified: new Date(Date.now() - 86400000).toISOString(), usageCount: 1240, status: 'active', preview: '📜' },
    { id: 't2', name: 'Competition Winner', type: 'winner', lastModified: new Date(Date.now() - 172800000).toISOString(), usageCount: 86, status: 'active', preview: '🏆' },
    { id: 't3', name: 'Faculty Appreciation', type: 'appreciation', lastModified: new Date(Date.now() - 604800000).toISOString(), usageCount: 45, status: 'active', preview: '🎖️' },
    { id: 't4', name: 'Academic Merit Award', type: 'merit', lastModified: new Date(Date.now() - 1209600000).toISOString(), usageCount: 0, status: 'draft', preview: '🎓' },
    { id: 't5', name: 'Legacy Template (2023)', type: 'participation', lastModified: new Date(Date.now() - 7776000000).toISOString(), usageCount: 890, status: 'archived', preview: '📄' },
  ];

  const filtered = templates.filter((t) => filter === 'all' || t.status === filter);

  const typeColors: Record<CertTemplate['type'], { bg: string; text: string }> = {
    participation: { bg: 'var(--comp-accent-light)', text: 'var(--comp-accent)' },
    winner: { bg: 'color-mix(in srgb, var(--accent-yellow) 22%, var(--comp-surface))', text: 'color-mix(in srgb, var(--accent-yellow) 45%, var(--text-primary))' },
    appreciation: { bg: 'color-mix(in srgb, var(--accent-orange) 16%, var(--comp-surface))', text: 'color-mix(in srgb, var(--accent-orange) 55%, var(--text-primary))' },
    merit: { bg: 'color-mix(in srgb, var(--accent-blue) 14%, var(--comp-surface))', text: 'color-mix(in srgb, var(--accent-blue) 50%, var(--text-primary))' },
  };

  const statusColors: Record<CertTemplate['status'], { bg: string; text: string }> = {
    active: { bg: 'var(--status-open-bg)', text: 'var(--status-open-text)' },
    draft: { bg: 'var(--status-pending-bg)', text: 'var(--status-pending-text)' },
    archived: { bg: 'var(--comp-border)', text: 'var(--comp-text-muted)' },
  };

  return (
    <ErpPageShell
      title="Certificate Templates"
      source="Internal API"
      isLoading={false}
      headerActions={
        <button className="comp-btn-primary" style={{ fontSize: 'var(--text-sm)' }}>
          + Create Template
        </button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>

        {/* Subtitle */}
        <p className="comp-body" style={{ margin: 0 }}>
          Create and manage certificate designs for events and competitions
        </p>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-md)' }}>
          <StatCard label="Total templates" value={templates.length} />
          <StatCard label="Active templates" value={templates.filter((t) => t.status === 'active').length} />
          <StatCard
            label="Certificates issued"
            value={templates.reduce((s, t) => s + t.usageCount, 0).toLocaleString()}
          />
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
          {(['all', 'active', 'draft', 'archived'] as const).map((f) => (
            <Chip key={f} selected={filter === f} onClick={() => setFilter(f)}>
              {f}
            </Chip>
          ))}
        </div>

        {/* Template grid */}
        {filtered.length === 0 ? (
          <EmptyState icon={<span>📄</span>} title="No templates found" description="Try changing your filter or create a new template." />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-md)' }}>
            {filtered.map((tmpl) => {
              const tc = typeColors[tmpl.type];
              const sc = statusColors[tmpl.status];
              return (
                <div
                  key={tmpl.id}
                  style={{
                    background: 'var(--comp-surface)', border: '1px solid var(--comp-border)',
                    borderRadius: 'var(--border-radius-lg)', overflow: 'hidden',
                    display: 'flex', flexDirection: 'column',
                  }}
                >
                  {/* Preview area */}
                  <div style={{
                    height: 120, background: 'linear-gradient(135deg, var(--comp-surface) 0%, color-mix(in srgb, var(--comp-border-strong) 45%, var(--comp-surface)) 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 'var(--text-2xl)', position: 'relative',
                  }}>
                    {tmpl.preview}
                    <span style={{
                      position: 'absolute', top: 8, right: 8,
                      padding: '2px 8px', borderRadius: 'var(--border-radius-sm)',
                      background: sc.bg, color: sc.text,
                      fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase',
                    }}>
                      {tmpl.status}
                    </span>
                  </div>

                  {/* Details */}
                  <div style={{ padding: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ margin: 0, fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--comp-text-primary)' }}>
                        {tmpl.name}
                      </h3>
                    </div>
                    <span style={{
                      alignSelf: 'flex-start', padding: '2px 8px', borderRadius: 'var(--border-radius-full)',
                      background: tc.bg, color: tc.text,
                      fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'capitalize',
                    }}>
                      {tmpl.type}
                    </span>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', color: 'var(--comp-text-muted)' }}>
                      <span>Used {tmpl.usageCount} times</span>
                      <span>{new Date(tmpl.lastModified).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-xs)', marginTop: 4 }}>
                      <button className="comp-btn-ghost" style={{ flex: 1, fontSize: 'var(--text-sm)', padding: '4px 8px' }}>✏ Edit</button>
                      <button className="comp-btn-ghost" style={{ flex: 1, fontSize: 'var(--text-sm)', padding: '4px 8px' }}>📋 Duplicate</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ErpPageShell>
  );
}

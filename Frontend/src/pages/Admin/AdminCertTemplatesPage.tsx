/**
 * AdminCertTemplatesPage.tsx — /admin/certificate-templates
 * Certificate template manager for creating and editing certificate designs.
 */

import { useState } from 'react';
import { ErpPageShell, SectionCard } from '../../components/erp/ErpPrimitives';
import { EmptyState } from '../../components/competition/EmptyState';

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
    winner: { bg: '#fef9c3', text: '#854d0e' },
    appreciation: { bg: '#fce7f3', text: '#be185d' },
    merit: { bg: '#e0f2fe', text: '#0369a1' },
  };

  const statusColors: Record<CertTemplate['status'], { bg: string; text: string }> = {
    active: { bg: 'var(--status-open-bg)', text: 'var(--status-open-text)' },
    draft: { bg: 'var(--status-pending-bg)', text: 'var(--status-pending-text)' },
    archived: { bg: 'var(--comp-border)', text: 'var(--comp-text-muted)' },
  };

  return (
    <ErpPageShell title="Certificate Templates" source="Internal API" isLoading={false}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
          <div>
            <h1 className="comp-heading-lg" style={{ margin: 0 }}>Certificate Template Manager</h1>
            <p className="comp-body" style={{ margin: '4px 0 0' }}>
              Create and manage certificate designs for events and competitions
            </p>
          </div>
          <button className="comp-btn-primary" style={{ fontSize: '0.85rem' }}>
            + Create Template
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-md)' }}>
          <div style={{ background: 'var(--comp-surface)', border: '1px solid var(--comp-border)', borderRadius: 10, padding: 'var(--space-md)' }}>
            <span className="comp-label" style={{ fontSize: '0.68rem' }}>TOTAL TEMPLATES</span>
            <p style={{ margin: '4px 0 0', fontSize: '1.6rem', fontWeight: 800, lineHeight: 1 }}>{templates.length}</p>
          </div>
          <div style={{ background: 'var(--comp-surface)', border: '1px solid var(--comp-border)', borderRadius: 10, padding: 'var(--space-md)' }}>
            <span className="comp-label" style={{ fontSize: '0.68rem' }}>ACTIVE TEMPLATES</span>
            <p style={{ margin: '4px 0 0', fontSize: '1.6rem', fontWeight: 800, lineHeight: 1, color: 'var(--status-open-text)' }}>
              {templates.filter((t) => t.status === 'active').length}
            </p>
          </div>
          <div style={{ background: 'var(--comp-surface)', border: '1px solid var(--comp-border)', borderRadius: 10, padding: 'var(--space-md)' }}>
            <span className="comp-label" style={{ fontSize: '0.68rem' }}>CERTIFICATES ISSUED</span>
            <p style={{ margin: '4px 0 0', fontSize: '1.6rem', fontWeight: 800, lineHeight: 1 }}>
              {templates.reduce((s, t) => s + t.usageCount, 0).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
          {(['all', 'active', 'draft', 'archived'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '5px 12px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 600,
                border: `1px solid ${filter === f ? 'var(--comp-accent)' : 'var(--comp-border)'}`,
                background: filter === f ? 'var(--comp-accent)' : 'var(--comp-surface)',
                color: filter === f ? '#fff' : 'var(--comp-text-secondary)',
                cursor: 'pointer', textTransform: 'capitalize',
              }}
            >
              {f}
            </button>
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
                    borderRadius: 12, overflow: 'hidden',
                    display: 'flex', flexDirection: 'column',
                  }}
                >
                  {/* Preview area */}
                  <div style={{
                    height: 120, background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '3rem', position: 'relative',
                  }}>
                    {tmpl.preview}
                    <span style={{
                      position: 'absolute', top: 8, right: 8,
                      padding: '2px 8px', borderRadius: 4,
                      background: sc.bg, color: sc.text,
                      fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
                    }}>
                      {tmpl.status}
                    </span>
                  </div>

                  {/* Details */}
                  <div style={{ padding: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: 'var(--comp-text-primary)' }}>
                        {tmpl.name}
                      </h3>
                    </div>
                    <span style={{
                      alignSelf: 'flex-start', padding: '2px 8px', borderRadius: 20,
                      background: tc.bg, color: tc.text,
                      fontSize: '0.68rem', fontWeight: 600, textTransform: 'capitalize',
                    }}>
                      {tmpl.type}
                    </span>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--comp-text-muted)' }}>
                      <span>Used {tmpl.usageCount} times</span>
                      <span>{new Date(tmpl.lastModified).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-xs)', marginTop: 4 }}>
                      <button className="comp-btn-ghost" style={{ flex: 1, fontSize: '0.78rem', padding: '4px 8px' }}>✏ Edit</button>
                      <button className="comp-btn-ghost" style={{ flex: 1, fontSize: '0.78rem', padding: '4px 8px' }}>📋 Duplicate</button>
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

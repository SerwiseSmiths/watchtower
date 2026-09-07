'use client';

import { useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { dmSans } from '../tickets/fonts';
import RootSidebar from '@/components/RootSidebar';

export interface AuditLogRow {
  id: number;
  module: string;
  action: string;
  entity_id: string;
  entity_label: string | null;
  changes: Record<string, unknown> | null;
  actor_id: number | null;
  actor_name: string | null;
  created_at: string;
}

interface Filters {
  module?: string;
  action?: string;
  actorId?: string;
  entityId?: string;
  from?: string;
  to?: string;
  page?: string;
}

const labelStyle: CSSProperties = { fontSize: 10, fontWeight: 600, letterSpacing: '-0.03em', color: '#B7B7B7' };
const cellStyle: CSSProperties = { fontSize: 12, fontWeight: 600, letterSpacing: '-0.03em', color: '#000000' };
const inputStyle: CSSProperties = {
  background: '#EFEFEF',
  border: '1px solid #E5E5E5',
  borderRadius: 6,
  padding: '8px 10px',
  fontSize: 12,
  fontWeight: 600,
  color: '#000000',
  outline: 'none',
};

const ACTION_COLORS: Record<string, { bg: string; color: string }> = {
  CREATE: { bg: '#E7F7EF', color: '#0C8D6E' },
  UPDATE: { bg: '#EAF2FC', color: '#0D67CE' },
  DELETE: { bg: '#FDECEC', color: '#E53935' },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function isDiffShape(value: unknown): value is { old: unknown; new: unknown } {
  return typeof value === 'object' && value !== null && 'old' in value && 'new' in value;
}

function renderValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function DiffModal({ row, onClose }: { row: AuditLogRow; onClose: () => void }) {
  const entries = Object.entries(row.changes ?? {});
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 560, maxHeight: '80vh', overflowY: 'auto', background: '#FFFFFF', borderRadius: 10, padding: '20px 25px' }}>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.03em', color: '#181818' }}>
            {row.module} — {row.action}
          </span>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: '#B7B7B7', lineHeight: 1 }}>
            ×
          </button>
        </div>
        <div style={{ fontSize: 11, color: '#B7B7B7', marginBottom: 12 }}>
          {row.entity_label ?? row.entity_id} · {formatDate(row.created_at)} · {row.actor_name ?? 'Unknown'}
        </div>

        {entries.length === 0 && <div style={{ fontSize: 12, color: '#B7B7B7' }}>No field details recorded.</div>}

        <div className="d-flex flex-column" style={{ gap: 10 }}>
          {entries.map(([field, value]) => (
            <div key={field} style={{ borderBottom: '1px solid #F2F2F2', paddingBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#454545', marginBottom: 4 }}>{field}</div>
              {isDiffShape(value) ? (
                <div className="d-flex align-items-center" style={{ gap: 8, fontSize: 12 }}>
                  <span style={{ color: '#E53935', textDecoration: 'line-through' }}>{renderValue(value.old)}</span>
                  <span style={{ color: '#B7B7B7' }}>→</span>
                  <span style={{ color: '#0C8D6E', fontWeight: 700 }}>{renderValue(value.new)}</span>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: '#000' }}>{renderValue(value)}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AuditLogView({
  logs,
  total,
  page,
  pageSize,
  moduleOptions,
  actorOptions,
  filters,
}: {
  logs: AuditLogRow[];
  total: number;
  page: number;
  pageSize: number;
  moduleOptions: string[];
  actorOptions: { id: number; name: string }[];
  filters: Filters;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Filters>(filters);
  const [viewing, setViewing] = useState<AuditLogRow | null>(null);

  function applyFilters(next: Filters) {
    const params = new URLSearchParams();
    if (next.module) params.set('module', next.module);
    if (next.action) params.set('action', next.action);
    if (next.actorId) params.set('actorId', next.actorId);
    if (next.entityId) params.set('entityId', next.entityId);
    if (next.from) params.set('from', next.from);
    if (next.to) params.set('to', next.to);
    router.push(`/audit-log?${params.toString()}`);
  }

  function goToPage(p: number) {
    const params = new URLSearchParams();
    if (filters.module) params.set('module', filters.module);
    if (filters.action) params.set('action', filters.action);
    if (filters.actorId) params.set('actorId', filters.actorId);
    if (filters.entityId) params.set('entityId', filters.entityId);
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    params.set('page', String(p));
    router.push(`/audit-log?${params.toString()}`);
  }

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className={dmSans.className} style={{ minHeight: '100vh', background: '#F2F2F2', display: 'flex' }}>
      <RootSidebar />
      <main className="flex-grow-1" style={{ padding: '44px 40px' }}>
        <h1 className="mb-3" style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', color: '#181818' }}>Audit Log</h1>

        <div className="d-flex flex-wrap align-items-end mb-3" style={{ gap: 10, background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 8, padding: 15 }}>
          <div>
            <div style={labelStyle}>Module</div>
            <select value={draft.module ?? ''} onChange={(e) => setDraft((p) => ({ ...p, module: e.target.value || undefined }))} style={inputStyle}>
              <option value="">All</option>
              {moduleOptions.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <div style={labelStyle}>Action</div>
            <select value={draft.action ?? ''} onChange={(e) => setDraft((p) => ({ ...p, action: e.target.value || undefined }))} style={inputStyle}>
              <option value="">All</option>
              <option value="CREATE">Create</option>
              <option value="UPDATE">Update</option>
              <option value="DELETE">Delete</option>
            </select>
          </div>
          <div>
            <div style={labelStyle}>Actor</div>
            <select value={draft.actorId ?? ''} onChange={(e) => setDraft((p) => ({ ...p, actorId: e.target.value || undefined }))} style={inputStyle}>
              <option value="">All</option>
              {actorOptions.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <div style={labelStyle}>Entity (id or name)</div>
            <input type="text" value={draft.entityId ?? ''} onChange={(e) => setDraft((p) => ({ ...p, entityId: e.target.value || undefined }))} style={inputStyle} placeholder="Search…" />
          </div>
          <div>
            <div style={labelStyle}>From</div>
            <input type="date" value={draft.from ?? ''} onChange={(e) => setDraft((p) => ({ ...p, from: e.target.value || undefined }))} style={inputStyle} />
          </div>
          <div>
            <div style={labelStyle}>To</div>
            <input type="date" value={draft.to ?? ''} onChange={(e) => setDraft((p) => ({ ...p, to: e.target.value || undefined }))} style={inputStyle} />
          </div>
          <button type="button" onClick={() => applyFilters(draft)} style={{ background: '#181818', color: '#FFF', border: 'none', borderRadius: 6, padding: '9px 18px', fontSize: 12, fontWeight: 600 }}>
            Apply
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft({});
              applyFilters({});
            }}
            style={{ background: 'transparent', color: '#B7B7B7', border: '1px solid #E5E5E5', borderRadius: 6, padding: '9px 18px', fontSize: 12, fontWeight: 600 }}
          >
            Clear
          </button>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 5, overflow: 'hidden' }}>
          <div className="d-flex align-items-center" style={{ padding: '0 13px', height: 35, borderBottom: '1px solid #E5E5E5' }}>
            <div style={{ width: 150, ...labelStyle }}>Time</div>
            <div style={{ width: 130, ...labelStyle }}>Module</div>
            <div style={{ width: 90, ...labelStyle }}>Action</div>
            <div style={{ width: 220, ...labelStyle }}>Entity</div>
            <div style={{ width: 160, ...labelStyle }}>Actor</div>
            <div style={{ width: 100, ...labelStyle }}>Details</div>
          </div>

          {logs.length === 0 && <div className="d-flex align-items-center justify-content-center" style={{ height: 80, ...labelStyle }}>No log entries match these filters.</div>}

          {logs.map((row, i) => {
            const colors = ACTION_COLORS[row.action] ?? { bg: '#F2F2F2', color: '#454545' };
            return (
              <div key={row.id} className="d-flex align-items-center" style={{ padding: '0 13px', height: 44, borderBottom: i === logs.length - 1 ? 'none' : '1px solid #E5E5E5' }}>
                <div style={{ width: 150, ...cellStyle, fontWeight: 400 }}>{formatDate(row.created_at)}</div>
                <div style={{ width: 130, ...cellStyle }}>{row.module}</div>
                <div style={{ width: 90 }}>
                  <span style={{ background: colors.bg, color: colors.color, borderRadius: 4, padding: '3px 8px', fontSize: 10, fontWeight: 700 }}>{row.action}</span>
                </div>
                <div style={{ width: 220, ...cellStyle, fontWeight: 400 }}>{row.entity_label ?? row.entity_id}</div>
                <div style={{ width: 160, ...cellStyle, fontWeight: 400 }}>{row.actor_name ?? '—'}</div>
                <div style={{ width: 100 }}>
                  <button type="button" onClick={() => setViewing(row)} style={{ background: '#F2F2F2', border: 'none', borderRadius: 5, padding: '5px 12px', fontSize: 11, fontWeight: 600, color: '#181818' }}>
                    View
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="d-flex align-items-center justify-content-between mt-3">
          <span style={labelStyle}>{total} total entries</span>
          <div className="d-flex align-items-center" style={{ gap: 10 }}>
            <button type="button" disabled={page <= 1} onClick={() => goToPage(page - 1)} style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 5, padding: '6px 14px', fontSize: 12, fontWeight: 600, opacity: page <= 1 ? 0.5 : 1 }}>
              Prev
            </button>
            <span style={labelStyle}>Page {page} of {pageCount}</span>
            <button type="button" disabled={page >= pageCount} onClick={() => goToPage(page + 1)} style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 5, padding: '6px 14px', fontSize: 12, fontWeight: 600, opacity: page >= pageCount ? 0.5 : 1 }}>
              Next
            </button>
          </div>
        </div>
      </main>

      {viewing && <DiffModal row={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

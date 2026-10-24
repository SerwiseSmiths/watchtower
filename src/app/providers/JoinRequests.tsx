'use client';

import { useMemo, useState, useTransition, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import type { NexusProviderSignup, ProviderSignupStatus } from '@/lib/nexus/providerSignups';
import { setProviderSignupStatusAction } from './actions';
import { SKILL_LABELS, SKILL_ORDER } from './skillIcons';

const labelStyle: CSSProperties = { fontSize: 10, fontWeight: 600, letterSpacing: '-0.03em', color: '#B7B7B7' };
const cellStyle: CSSProperties = { fontSize: 12, fontWeight: 600, letterSpacing: '-0.03em', color: '#000000' };

const FILTERS: { key: ProviderSignupStatus; label: string }[] = [
  { key: 'PENDING', label: 'Pending' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Rejected' },
];

const btn = (dark: boolean): CSSProperties => ({
  background: dark ? '#181818' : '#E5E5E5',
  color: dark ? '#FFFFFF' : '#454545',
  borderRadius: 5,
  padding: '5px 10px',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '-0.03em',
  border: 'none',
  whiteSpace: 'nowrap',
});

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function JoinRequests({
  requests,
  onCreateProvider,
  onOpenProvider,
}: {
  /** null = nexus couldn't be reached for this list */
  requests: NexusProviderSignup[] | null;
  onCreateProvider: (request: NexusProviderSignup) => void;
  onOpenProvider: (providerId: string) => void;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<ProviderSignupStatus>('PENDING');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const counts = useMemo(() => {
    const c: Record<ProviderSignupStatus, number> = { PENDING: 0, APPROVED: 0, REJECTED: 0 };
    requests?.forEach((r) => (c[r.status] += 1));
    return c;
  }, [requests]);

  const visible = useMemo(() => (requests ?? []).filter((r) => r.status === filter), [requests, filter]);

  async function setStatus(request: NexusProviderSignup, status: ProviderSignupStatus) {
    setBusyId(request.id);
    setError(null);
    try {
      await setProviderSignupStatusAction(request, status);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update request');
    } finally {
      setBusyId(null);
    }
  }

  if (requests === null) {
    return (
      <div className="d-flex align-items-center justify-content-center" style={{ height: 80, ...labelStyle, background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 5 }}>
        Couldn&apos;t load join requests from nexus. Try refreshing.
      </div>
    );
  }

  return (
    <>
      <div className="d-flex mb-3" style={{ gap: 6 }}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            style={{
              ...btn(filter === f.key),
              padding: '7px 14px',
              fontSize: 12,
            }}
          >
            {f.label} ({counts[f.key]})
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-2" style={{ fontSize: 12, fontWeight: 600, color: '#E53935' }}>
          {error}
        </div>
      )}

      <div style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 5, overflow: 'hidden' }}>
        <div className="d-flex align-items-center" style={{ padding: '0 13px', height: 35, borderBottom: '1px solid #E5E5E5' }}>
          <div style={{ width: 180, ...labelStyle }}>Name</div>
          <div style={{ width: 120, ...labelStyle }}>Phone Number</div>
          <div style={{ width: 100, ...labelStyle }}>City</div>
          <div style={{ width: 260, ...labelStyle }}>Appliances</div>
          <div style={{ width: 90, ...labelStyle }}>Experience</div>
          <div style={{ width: 110, ...labelStyle }}>{filter === 'PENDING' ? 'Submitted' : 'Reviewed'}</div>
          <div style={{ flex: 1 }} />
        </div>

        {visible.length === 0 && (
          <div className="d-flex align-items-center justify-content-center" style={{ height: 80, ...labelStyle }}>
            No {filter.toLowerCase()} requests.
          </div>
        )}

        {visible.map((r, i) => {
          const appliances = SKILL_ORDER.filter((k) => r.deviceTypes.includes(k)).map((k) => SKILL_LABELS[k]);
          const busy = busyId === r.id;
          return (
            <div
              key={r.id}
              className="d-flex align-items-center"
              style={{ padding: '6px 13px', minHeight: 40, borderBottom: i === visible.length - 1 ? 'none' : '1px solid #E5E5E5' }}
            >
              <div style={{ width: 180, ...cellStyle }}>{`${r.firstName} ${r.lastName}`}</div>
              <div style={{ width: 120, ...cellStyle }}>
                <a href={`tel:+91${r.phoneNo}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                  {r.phoneNo}
                </a>
              </div>
              <div style={{ width: 100, ...cellStyle }}>{r.city}</div>
              <div style={{ width: 260, ...cellStyle, fontWeight: 500, paddingRight: 12 }}>{appliances.join(', ') || '—'}</div>
              <div style={{ width: 90, ...cellStyle }}>
                {r.experienceYears != null ? `${r.experienceYears} yr${r.experienceYears === 1 ? '' : 's'}` : '—'}
              </div>
              <div style={{ width: 110, ...cellStyle }}>{formatDate(r.status === 'PENDING' ? r.createdAt : (r.reviewedAt ?? r.updatedAt))}</div>
              <div className="d-flex justify-content-end" style={{ flex: 1, gap: 6 }}>
                {r.status === 'PENDING' && (
                  <>
                    <button type="button" style={btn(false)} disabled={busy} onClick={() => setStatus(r, 'REJECTED')}>
                      Reject
                    </button>
                    <button type="button" style={btn(true)} disabled={busy} onClick={() => onCreateProvider(r)}>
                      Create provider
                    </button>
                  </>
                )}
                {r.status === 'REJECTED' && (
                  <button type="button" style={btn(false)} disabled={busy} onClick={() => setStatus(r, 'PENDING')}>
                    Reopen
                  </button>
                )}
                {r.status === 'APPROVED' && r.providerId && (
                  <button type="button" style={btn(false)} onClick={() => onOpenProvider(r.providerId!)}>
                    View provider
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

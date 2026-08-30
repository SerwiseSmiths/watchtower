'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { dmSans } from '../tickets/fonts';
import { ChevronRightIcon } from '../tickets/icons';
import { formatCurrency, type ProviderRow } from './mapProvider';
import ProviderDrawer from './ProviderDrawer';
import RootSidebar from '@/components/RootSidebar';

function Avatar({ initials, photo }: { initials: string; photo: string | null }) {
  if (photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photo} alt={initials} className="rounded-circle flex-shrink-0" style={{ width: 25, height: 25, objectFit: 'cover' }} />
    );
  }
  return (
    <span
      className="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0"
      style={{ width: 25, height: 25, background: '#E5E5E5', fontSize: 10, fontWeight: 500, color: '#454545' }}
    >
      {initials}
    </span>
  );
}

export default function ProvidersView({ providers }: { providers: ProviderRow[] }) {
  const labelStyle: CSSProperties = { fontSize: 10, fontWeight: 600, letterSpacing: '-0.03em', color: '#B7B7B7' };
  const cellStyle: CSSProperties = { fontSize: 12, fontWeight: 600, letterSpacing: '-0.03em', color: '#000000' };

  const [query, setQuery] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return providers;
    return providers.filter(
      (p) =>
        p.name.toLowerCase().includes(normalized) ||
        p.phoneNumber.toLowerCase().includes(normalized) ||
        (p.location?.toLowerCase().includes(normalized) ?? false),
    );
  }, [providers, query]);

  function openCreate() {
    setEditingId(null);
    setDrawerOpen(true);
  }

  function openEdit(id: string) {
    setEditingId(id);
    setDrawerOpen(true);
  }

  return (
    <div className={dmSans.className} style={{ minHeight: '100vh', background: '#F2F2F2', display: 'flex' }}>
      <RootSidebar />

      <main className="flex-grow-1" style={{ padding: '44px 40px' }}>
        <h1 className="mb-3" style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', color: '#181818' }}>
          Providers
        </h1>

        <div className="d-flex justify-content-between align-items-center mb-3">
          <div
            className="d-flex align-items-center"
            style={{ width: 718, background: '#E4E4E4', border: '1px solid #B7B7B7', borderRadius: 6, padding: '11px', gap: 9 }}
          >
            <span style={{ width: 14, height: 14, border: '1px solid #000', borderRadius: '50%', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search By Name, Phone Number, Pin code"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-grow-1"
              style={{ ...labelStyle, background: 'transparent', border: 'none', outline: 'none', width: '100%' }}
            />
          </div>

          <button
            type="button"
            onClick={openCreate}
            style={{ background: '#181818', color: '#FFFFFF', borderRadius: 5, padding: '10px 16px', fontSize: 12, fontWeight: 500, letterSpacing: '-0.03em', border: 'none' }}
          >
            + Add
          </button>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 5, overflow: 'hidden' }}>
          <div className="d-flex align-items-center" style={{ padding: '0 13px', height: 35, borderBottom: '1px solid #E5E5E5' }}>
            <div style={{ width: 26 }}>
              <input type="checkbox" />
            </div>
            <div style={{ width: 200, ...labelStyle }}>Name</div>
            <div style={{ width: 130, ...labelStyle }}>Phone Number</div>
            <div style={{ width: 90, ...labelStyle }}>Tier</div>
            <div style={{ width: 120, ...labelStyle }}>Complaint Success</div>
            <div style={{ width: 130, ...labelStyle }}>Location</div>
            <div style={{ width: 110, ...labelStyle }}>Wallet Balance</div>
            <div style={{ width: 120, ...labelStyle }}>Connected Since</div>
            <div style={{ width: 90, ...labelStyle }}>Overdue</div>
            <div style={{ width: 24 }} />
          </div>

          {filtered.length === 0 && (
            <div className="d-flex align-items-center justify-content-center" style={{ height: 80, ...labelStyle }}>
              No providers match your search.
            </div>
          )}

          {filtered.map((provider, i) => (
            <div
              key={provider.id}
              className="d-flex align-items-center"
              style={{ padding: '0 13px', height: 35, borderBottom: i === filtered.length - 1 ? 'none' : '1px solid #E5E5E5', cursor: 'pointer' }}
              onClick={() => openEdit(provider.id)}
            >
              <div style={{ width: 26 }} onClick={(e) => e.stopPropagation()}>
                <input type="checkbox" />
              </div>
              <div className="d-flex align-items-center" style={{ width: 200, gap: 9, ...cellStyle }}>
                <Avatar initials={provider.initials} photo={provider.avatar} />
                {provider.name}
              </div>
              <div style={{ width: 130, ...cellStyle }}>{provider.phoneNumber}</div>
              <div style={{ width: 90 }}>
                {provider.providerTierName ? (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: '-0.03em',
                      color: provider.providerTierColor ?? '#454545',
                      border: `1px solid ${provider.providerTierColor ?? '#B7B7B7'}`,
                      borderRadius: 20,
                      padding: '2px 8px',
                    }}
                  >
                    {provider.providerTierName}
                  </span>
                ) : (
                  <span style={{ ...cellStyle, color: '#B7B7B7' }}>—</span>
                )}
              </div>
              <div style={{ width: 120, ...cellStyle }}>{provider.complaintSuccess.toLocaleString('en-IN')}</div>
              <div style={{ width: 130, ...cellStyle }}>{provider.location ?? '—'}</div>
              <div style={{ width: 110, ...cellStyle, color: provider.walletBalance > 0 ? '#0C8D6E' : provider.walletBalance < 0 ? '#E53935' : '#000' }}>
                {formatCurrency(provider.walletBalance)}
              </div>
              <div style={{ width: 120, ...cellStyle }}>{provider.connectedSince}</div>
              <div style={{ width: 90, ...cellStyle, color: provider.overdue > 0 ? '#E53935' : '#000' }}>{provider.overdue}</div>
              <div style={{ width: 24 }} className="d-flex justify-content-center">
                <ChevronRightIcon />
              </div>
            </div>
          ))}
        </div>
      </main>

      <ProviderDrawer open={drawerOpen} providerId={editingId} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}

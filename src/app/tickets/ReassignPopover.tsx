'use client';

import { useEffect, useRef, useState, useTransition, type CSSProperties } from 'react';
import { fetchProviders, reassignProvider } from './actions';
import type { NexusProvider } from '@/lib/nexus/providers';

function providerName(provider: NexusProvider): string {
  return [provider.firstName, provider.lastName].filter(Boolean).join(' ') || provider.phoneNo;
}

export default function ReassignPopover({ complaintId, currentProviderId, onDone }: { complaintId: string; currentProviderId: string | null; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [providers, setProviders] = useState<NexusProvider[] | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
      fetchProviders(search || undefined).then(setProviders);
    }, 200);
    return () => clearTimeout(id);
  }, [open, search]);

  function select(provider: NexusProvider) {
    setError(null);
    startTransition(async () => {
      try {
        await reassignProvider(complaintId, provider.id);
        setOpen(false);
        onDone();
      } catch {
        setError('Failed to reassign — please try again.');
      }
    });
  }

  const pillStyle: CSSProperties = {
    background: 'transparent',
    border: '1px solid #181818',
    borderRadius: 5,
    padding: '5px 15px',
    fontSize: 8,
    fontWeight: 600,
    letterSpacing: '-0.03em',
    color: '#181818',
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen((v) => !v)} style={pillStyle}>
        Reassign
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            width: 240,
            background: '#FFFFFF',
            border: '1px solid #E5E5E5',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            padding: 12,
            zIndex: 30,
          }}
        >
          <input
            type="text"
            placeholder="Search providers…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', background: '#EFEFEF', border: '1px solid #E5E5E5', borderRadius: 6, padding: '6px 10px', fontSize: 11, marginBottom: 8 }}
          />

          {providers === null && <div style={{ fontSize: 11, color: '#B7B7B7' }}>Loading…</div>}
          {providers !== null && providers.length === 0 && <div style={{ fontSize: 11, color: '#B7B7B7' }}>No providers found.</div>}

          <div className="d-flex flex-column" style={{ gap: 4, maxHeight: 220, overflowY: 'auto' }}>
            {providers?.map((provider) => (
              <button
                key={provider.id}
                type="button"
                disabled={isPending}
                onClick={() => select(provider)}
                className="d-flex align-items-center justify-content-between"
                style={{
                  background: provider.id === currentProviderId ? '#F2F2F2' : 'transparent',
                  border: 'none',
                  borderRadius: 6,
                  padding: '6px 8px',
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#181818',
                  textAlign: 'left',
                }}
              >
                {providerName(provider)}
                {provider.id === currentProviderId && <span style={{ fontSize: 10, color: '#B7B7B7' }}>Current</span>}
              </button>
            ))}
          </div>

          {error && <div className="mt-2" style={{ fontSize: 10, color: '#FF5E5E', fontWeight: 600 }}>{error}</div>}
        </div>
      )}
    </div>
  );
}

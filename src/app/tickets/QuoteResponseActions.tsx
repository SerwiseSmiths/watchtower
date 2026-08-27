'use client';

import { useEffect, useRef, useState, useTransition, type CSSProperties } from 'react';
import { respondToQuoteAction } from './actions';

export default function QuoteResponseActions({ complaintId }: { complaintId: string }) {
  const [isPending, startTransition] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setRejecting(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function approve() {
    setError(null);
    startTransition(async () => {
      try {
        await respondToQuoteAction(complaintId, true);
      } catch {
        setError('Failed to approve — please try again.');
      }
    });
  }

  function reject() {
    setError(null);
    startTransition(async () => {
      try {
        await respondToQuoteAction(complaintId, false, reason || undefined);
        setRejecting(false);
        setReason('');
      } catch {
        setError('Failed to reject — please try again.');
      }
    });
  }

  const btnStyle: CSSProperties = {
    flex: 1,
    border: 'none',
    borderRadius: 5,
    padding: '10px',
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '-0.03em',
  };

  return (
    <div ref={ref} className="d-flex flex-column" style={{ gap: 8, position: 'relative' }}>
      <div className="d-flex" style={{ gap: 10 }}>
        <button
          type="button"
          disabled={isPending}
          onClick={approve}
          style={{ ...btnStyle, background: '#2ABA65', color: '#FFFFFF' }}
        >
          Approve Quote
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => setRejecting((v) => !v)}
          style={{ ...btnStyle, background: '#FF5E5E', color: '#FFFFFF' }}
        >
          Reject Quote
        </button>
      </div>

      {rejecting && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            background: '#FFFFFF',
            border: '1px solid #E5E5E5',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            padding: 12,
            zIndex: 30,
          }}
        >
          <textarea
            placeholder="Rejection reason (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            style={{ width: '100%', background: '#EFEFEF', border: '1px solid #E5E5E5', borderRadius: 6, padding: '8px 10px', fontSize: 11, resize: 'none', marginBottom: 8 }}
          />
          <button
            type="button"
            disabled={isPending}
            onClick={reject}
            style={{ width: '100%', background: '#181818', color: '#FFF', border: 'none', borderRadius: 5, padding: '8px', fontSize: 11, fontWeight: 600 }}
          >
            {isPending ? 'Rejecting…' : 'Confirm Rejection'}
          </button>
        </div>
      )}

      {error && <div style={{ fontSize: 10, color: '#FF5E5E', fontWeight: 600 }}>{error}</div>}
    </div>
  );
}

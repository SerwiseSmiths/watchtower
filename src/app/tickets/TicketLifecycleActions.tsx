'use client';

import { useEffect, useRef, useState, useTransition, type CSSProperties } from 'react';
import { cancelTicketAction, reopenTicketAction } from './actions';

const btnStyle: CSSProperties = {
  flex: 1,
  border: 'none',
  borderRadius: 5,
  padding: '8px',
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '-0.03em',
  color: '#FFFFFF',
};

export default function TicketLifecycleActions({ complaintId, isClosed }: { complaintId: string; isClosed: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setCancelling(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function confirmCancel() {
    setError(null);
    startTransition(async () => {
      try {
        await cancelTicketAction(complaintId, reason || undefined);
        setCancelling(false);
        setReason('');
      } catch {
        setError('Failed to cancel — please try again.');
      }
    });
  }

  function reopen() {
    setError(null);
    startTransition(async () => {
      try {
        await reopenTicketAction(complaintId);
      } catch {
        setError('Failed to reopen — please try again.');
      }
    });
  }

  return (
    <div ref={ref} className="d-flex flex-column" style={{ gap: 6, position: 'relative' }}>
      {isClosed ? (
        <button type="button" disabled={isPending} onClick={reopen} style={{ ...btnStyle, background: '#0D67CE' }}>
          {isPending ? 'Reopening…' : 'Reopen Ticket'}
        </button>
      ) : (
        <button type="button" disabled={isPending} onClick={() => setCancelling((v) => !v)} style={{ ...btnStyle, background: '#FF5E5E' }}>
          Cancel Ticket
        </button>
      )}

      {cancelling && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
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
            placeholder="Cancellation reason (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            style={{ width: '100%', background: '#EFEFEF', border: '1px solid #E5E5E5', borderRadius: 6, padding: '8px 10px', fontSize: 11, resize: 'none', marginBottom: 8 }}
          />
          <button
            type="button"
            disabled={isPending}
            onClick={confirmCancel}
            style={{ width: '100%', background: '#181818', color: '#FFF', border: 'none', borderRadius: 5, padding: '8px', fontSize: 11, fontWeight: 600 }}
          >
            {isPending ? 'Cancelling…' : 'Confirm Cancellation'}
          </button>
        </div>
      )}

      {error && <div style={{ fontSize: 10, color: '#FF5E5E', fontWeight: 600 }}>{error}</div>}
    </div>
  );
}

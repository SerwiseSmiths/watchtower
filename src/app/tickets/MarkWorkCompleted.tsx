'use client';

import { useState, useTransition } from 'react';
import { completeWorkAction } from './actions';

// IN_PROGRESS only — marks the repair done on the assigned provider's behalf (nexus
// complete-service as ADMIN), moving the ticket to PAYMENT. Two-step so a stray click
// doesn't ask the customer to pay for unfinished work.
export default function MarkWorkCompleted({ complaintId }: { complaintId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await completeWorkAction(complaintId);
      if (result.ok) setConfirming(false);
      else setError(result.error);
    });
  }

  const base = { border: 'none', borderRadius: 6, padding: '10px', fontSize: 12, fontWeight: 600, letterSpacing: '-0.03em' } as const;

  return (
    <div className="d-flex flex-column" style={{ gap: 6 }}>
      {confirming ? (
        <>
          <div style={{ fontSize: 11, color: '#6B6B6B' }}>
            Mark the repair as done? The ticket moves to Payment and the customer is asked to pay.
          </div>
          <div className="d-flex" style={{ gap: 10 }}>
            <button type="button" disabled={isPending} onClick={() => setConfirming(false)} style={{ ...base, flex: 1, background: '#E5E5E5', color: '#181818' }}>
              Cancel
            </button>
            <button type="button" disabled={isPending} onClick={confirm} style={{ ...base, flex: 1, background: '#0D67CE', color: '#FFFFFF' }}>
              {isPending ? 'Updating…' : 'Yes, Work Completed'}
            </button>
          </div>
        </>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className="w-100" style={{ ...base, background: '#0D67CE', color: '#FFFFFF' }}>
          Mark Work Completed
        </button>
      )}
      {error && <div style={{ fontSize: 11, color: '#FF5E5E', fontWeight: 600 }}>{error}</div>}
    </div>
  );
}

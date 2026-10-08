'use client';

import { useState, useTransition, type CSSProperties } from 'react';
import { respondToQuoteAction } from './actions';
import AddQuoteForm from './AddQuoteForm';
import QuoteReviewModal from './QuoteReviewModal';
import type { TicketQuote } from './mapComplaint';

// Approve / Reject never act directly — both open the review popup first so the admin sees
// the full quote before deciding, and can edit it from there (nexus complaint.md §6.7).
type Mode = { kind: 'closed' } | { kind: 'review'; initial: 'approve' | 'reject' } | { kind: 'edit' };

export default function QuoteResponseActions({
  complaintId,
  quote,
  deviceType,
}: {
  complaintId: string;
  quote: TicketQuote;
  deviceType?: string;
}) {
  const [mode, setMode] = useState<Mode>({ kind: 'closed' });
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function open(initial: 'approve' | 'reject') {
    setError(null);
    setMode({ kind: 'review', initial });
  }

  function respond(approved: boolean, reason?: string) {
    setError(null);
    startTransition(async () => {
      try {
        await respondToQuoteAction(complaintId, approved, reason || undefined);
        setMode({ kind: 'closed' });
      } catch {
        setError(`Failed to ${approved ? 'approve' : 'reject'} — the quote may have changed. Close and try again.`);
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
    <>
      <div className="d-flex" style={{ gap: 10 }}>
        <button type="button" onClick={() => open('approve')} style={{ ...btnStyle, background: '#2ABA65', color: '#FFFFFF' }}>
          Approve Quote
        </button>
        <button type="button" onClick={() => open('reject')} style={{ ...btnStyle, background: '#FF5E5E', color: '#FFFFFF' }}>
          Reject Quote
        </button>
      </div>

      {mode.kind === 'review' && (
        <QuoteReviewModal
          quote={quote}
          initialMode={mode.initial}
          isPending={isPending}
          error={error}
          onApprove={() => respond(true)}
          onReject={(reason) => respond(false, reason)}
          onEdit={() => setMode({ kind: 'edit' })}
          onClose={() => setMode({ kind: 'closed' })}
        />
      )}

      {mode.kind === 'edit' && (
        <AddQuoteForm
          complaintId={complaintId}
          deviceType={deviceType}
          initialQuote={quote}
          onCancel={() => setMode({ kind: 'review', initial: 'approve' })}
          // Back to the review, which now shows the saved quote (the action refreshes the page).
          onDone={() => setMode({ kind: 'review', initial: 'approve' })}
        />
      )}
    </>
  );
}

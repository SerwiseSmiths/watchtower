'use client';

import { useState, useTransition, type CSSProperties } from 'react';
import type { Ticket } from './mapComplaint';
import { nudgeCustomerOnWhatsApp } from './actions';
import { useWhatsApp } from './WhatsAppConnection';

type NudgeState = { kind: 'idle' } | { kind: 'sent' } | { kind: 'error'; message: string };

const CONNECT_FIRST = 'Connect WhatsApp first — nudges are sent from the connected number.';

/** Sends the "track your ticket in the app" WhatsApp message to the customer.
 *  Renders nothing for Completed/Cancelled tickets. With no WhatsApp number
 *  connected, opens the connect popup instead of sending. `compact` is the
 *  table-row size; the default is the full-width detail-panel size. */
export default function NudgeWhatsAppButton({ ticket, compact = false }: { ticket: Ticket; compact?: boolean }) {
  const { status, refresh, openConnect } = useWhatsApp();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<NudgeState>({ kind: 'idle' });

  if (ticket.stage === 'COMPLETED' || ticket.stage === 'REJECTED') return null;

  function nudge() {
    if (!status?.connected) {
      openConnect(CONNECT_FIRST);
      return;
    }
    setState({ kind: 'idle' });
    startTransition(async () => {
      const result = await nudgeCustomerOnWhatsApp(ticket.complaintId);
      if (result.ok) {
        setState({ kind: 'sent' });
      } else if (result.notConnected) {
        // Unlinked from the phone since the page loaded.
        setState({ kind: 'idle' });
        await refresh();
        openConnect(CONNECT_FIRST);
      } else {
        setState({ kind: 'error', message: result.error });
      }
    });
  }

  const label = isPending ? 'Sending…' : state.kind === 'sent' ? 'Sent ✓' : state.kind === 'error' ? 'Failed — retry' : compact ? 'Nudge' : 'Nudge on WhatsApp';
  const background = state.kind === 'error' ? '#FF5E5E' : '#25D366';

  const style: CSSProperties = compact
    ? { background, color: '#FFF', border: 'none', borderRadius: 5, height: 25, padding: '0 8px', fontSize: 10, fontWeight: 500, letterSpacing: '-0.03em', whiteSpace: 'nowrap' }
    : { width: '100%', background, color: '#FFF', border: 'none', borderRadius: 5, padding: '8px', fontSize: 10, fontWeight: 600, letterSpacing: '-0.03em' };

  return (
    <div className="d-flex flex-column" style={{ gap: 4 }}>
      <button
        type="button"
        disabled={isPending}
        onClick={nudge}
        title={state.kind === 'error' ? state.message : `Send WhatsApp update to ${ticket.phoneNumber}`}
        style={{ ...style, cursor: isPending ? 'wait' : 'pointer' }}
      >
        {label}
      </button>
      {/* The table row is too short for an inline message — there it's in the tooltip. */}
      {!compact && state.kind === 'error' && <div style={{ fontSize: 10, fontWeight: 600, color: '#FF5E5E' }}>{state.message}</div>}
    </div>
  );
}

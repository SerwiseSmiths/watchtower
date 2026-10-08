'use client';

import { useState, type CSSProperties } from 'react';
import type { TicketQuote } from './mapComplaint';

// Full read-out of a pending quote, shown before an admin approves or rejects it on the
// customer's behalf — so nobody signs off on a number they haven't seen. "Edit Quote" hands
// off to AddQuoteForm in edit mode (nexus complaint.md §6.7).

function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 100,
  background: 'rgba(0,0,0,0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const headStyle: CSSProperties = { fontSize: 10, fontWeight: 600, letterSpacing: '-0.03em', color: '#B7B7B7' };
const cellStyle: CSSProperties = { fontSize: 12, fontWeight: 600, letterSpacing: '-0.03em', color: '#181818' };
const btnStyle: CSSProperties = { flex: 1, border: 'none', borderRadius: 6, padding: '11px', fontSize: 12, fontWeight: 600, letterSpacing: '-0.03em' };

export default function QuoteReviewModal({
  quote,
  initialMode,
  isPending,
  error,
  onApprove,
  onReject,
  onEdit,
  onClose,
}: {
  quote: TicketQuote;
  /** Which button opened the popup — 'reject' starts with the reason box open. */
  initialMode: 'approve' | 'reject';
  isPending: boolean;
  error: string | null;
  onApprove: () => void;
  onReject: (reason: string) => void;
  onEdit: () => void;
  onClose: () => void;
}) {
  const [rejecting, setRejecting] = useState(initialMode === 'reject');
  const [reason, setReason] = useState('');

  // Only quotes made since per-item labour existed (2026-09-27) carry it on every line.
  const hasLabour = quote.items.length > 0 && quote.items.every((item) => item.labour != null);
  const providerEarns = hasLabour ? quote.items.reduce((sum, item) => sum + (item.labour ?? 0) * item.quantity, 0) : null;
  const columns = hasLabour ? '1fr 44px 90px 90px 96px' : '1fr 44px 90px 96px';

  return (
    <div style={overlayStyle} onClick={isPending ? undefined : onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="d-flex flex-column"
        style={{ width: 600, maxWidth: '94vw', maxHeight: '86vh', background: '#FFFFFF', borderRadius: 10, overflow: 'hidden' }}
      >
        <div className="d-flex justify-content-between align-items-center" style={{ padding: '16px 20px', borderBottom: '1px solid #F0F0F0', flexShrink: 0 }}>
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.03em', color: '#181818' }}>Review Quote</span>
          <button type="button" onClick={onClose} disabled={isPending} style={{ background: 'none', border: 'none', fontSize: 18, color: '#B7B7B7', lineHeight: 1 }}>
            ×
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: columns, gap: 8, paddingBottom: 8, borderBottom: '1px solid #F0F0F0' }}>
            <span style={headStyle}>Item</span>
            <span style={{ ...headStyle, textAlign: 'center' }}>Qty</span>
            <span style={{ ...headStyle, textAlign: 'right' }}>Unit Price</span>
            {hasLabour && <span style={{ ...headStyle, textAlign: 'right' }}>Labour / unit</span>}
            <span style={{ ...headStyle, textAlign: 'right' }}>Amount</span>
          </div>

          {quote.items.length === 0 && <div style={{ ...headStyle, padding: '14px 0' }}>No items in this quote.</div>}

          {quote.items.map((item, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: columns, gap: 8, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #F7F7F7' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ ...cellStyle, wordBreak: 'break-word' }}>{item.name}</div>
                <div style={{ fontSize: 9, fontWeight: 600, color: item.priceOverridden ? '#D97706' : '#B7B7B7', marginTop: 2 }}>
                  {item.partId ? (item.priceOverridden ? 'Catalogue · custom price' : 'Catalogue') : 'Custom item'}
                </div>
              </div>
              <span style={{ ...cellStyle, textAlign: 'center' }}>{item.quantity}</span>
              <span style={{ ...cellStyle, textAlign: 'right' }}>{formatCurrency(item.unitPrice)}</span>
              {hasLabour && <span style={{ ...cellStyle, textAlign: 'right', color: '#6B6B6B' }}>{formatCurrency(item.labour ?? 0)}</span>}
              <span style={{ ...cellStyle, textAlign: 'right', fontWeight: 700 }}>{formatCurrency(item.amount)}</span>
            </div>
          ))}

          <div className="d-flex flex-column" style={{ gap: 4, marginTop: 14 }}>
            {providerEarns != null && (
              <div className="d-flex justify-content-between">
                <span style={headStyle}>Provider earns</span>
                <span style={{ ...cellStyle, color: '#6B6B6B' }}>{formatCurrency(providerEarns)}</span>
              </div>
            )}
            <div className="d-flex justify-content-between align-items-center">
              <span style={{ fontSize: 13, fontWeight: 700, color: '#000000' }}>Total</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#000000' }}>{formatCurrency(quote.totalAmount)}</span>
            </div>
          </div>

          {quote.notes && (
            <div style={{ marginTop: 14, background: '#FAFAFA', border: '1px solid #F0F0F0', borderRadius: 6, padding: '8px 10px' }}>
              <div style={headStyle}>Notes</div>
              <div style={{ fontSize: 12, color: '#181818', whiteSpace: 'pre-wrap', marginTop: 2 }}>{quote.notes}</div>
            </div>
          )}

          {rejecting && (
            <textarea
              autoFocus
              placeholder="Rejection reason (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              style={{ width: '100%', marginTop: 14, background: '#EFEFEF', border: '1px solid #E5E5E5', borderRadius: 6, padding: '8px 10px', fontSize: 12, resize: 'none', outline: 'none' }}
            />
          )}
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid #F0F0F0', flexShrink: 0 }}>
          {error && <div className="mb-2" style={{ fontSize: 11, color: '#FF5E5E', fontWeight: 600 }}>{error}</div>}

          {rejecting ? (
            <div className="d-flex" style={{ gap: 10 }}>
              <button type="button" disabled={isPending} onClick={() => setRejecting(false)} style={{ ...btnStyle, background: '#E5E5E5', color: '#181818' }}>
                Back
              </button>
              <button type="button" disabled={isPending} onClick={() => onReject(reason.trim())} style={{ ...btnStyle, background: '#FF5E5E', color: '#FFFFFF' }}>
                {isPending ? 'Rejecting…' : 'Confirm Rejection'}
              </button>
            </div>
          ) : (
            <div className="d-flex" style={{ gap: 10 }}>
              <button type="button" disabled={isPending} onClick={onEdit} style={{ ...btnStyle, background: '#E5E5E5', color: '#181818' }}>
                Edit Quote
              </button>
              <button type="button" disabled={isPending} onClick={() => setRejecting(true)} style={{ ...btnStyle, background: '#FF5E5E', color: '#FFFFFF' }}>
                Reject
              </button>
              <button type="button" disabled={isPending} onClick={onApprove} style={{ ...btnStyle, background: '#2ABA65', color: '#FFFFFF' }}>
                {isPending ? 'Approving…' : `Approve ${formatCurrency(quote.totalAmount)}`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

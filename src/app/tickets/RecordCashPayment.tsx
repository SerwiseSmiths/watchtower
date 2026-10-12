'use client';

import { useState, useTransition, type CSSProperties } from 'react';
import type { CashCollectedBy } from '@/lib/nexus/complaints';
import { recordCashPaymentAction } from './actions';

// Records a full-quote cash payment while the ticket is in PAYMENT. The admin picks who
// received the cash:
//  - Office (COMPANY): the customer paid us directly. The customer's ledger gets a CASH entry
//    (wallet balance untouched); the provider is credited their labour only.
//  - Provider (PROVIDER): the provider took cash on-site but didn't mark it in radix. Same
//    effect as their own Cash Collect: labour credited, then the full amount they hold is
//    debited (they owe the company the rest).

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
const valueStyle: CSSProperties = { fontSize: 12, fontWeight: 600, letterSpacing: '-0.03em', color: '#181818' };
const btnStyle: CSSProperties = { flex: 1, border: 'none', borderRadius: 6, padding: '11px', fontSize: 12, fontWeight: 600, letterSpacing: '-0.03em' };

export default function RecordCashPayment({
  complaintId,
  customerName,
  providerName,
  totalAmount,
}: {
  complaintId: string;
  customerName: string;
  providerName: string | null;
  totalAmount: number;
}) {
  const [open, setOpen] = useState(false);
  const [collectedBy, setCollectedBy] = useState<CashCollectedBy>('COMPANY');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function close() {
    if (isPending) return;
    setOpen(false);
    setCollectedBy('COMPANY');
    setNote('');
    setError(null);
  }

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await recordCashPaymentAction(complaintId, totalAmount, collectedBy, note.trim() || undefined);
      if (result.ok) {
        setOpen(false);
        setCollectedBy('COMPANY');
        setNote('');
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-100"
        style={{ background: '#2ABA65', color: '#FFFFFF', border: 'none', borderRadius: 6, padding: '10px', fontSize: 12, fontWeight: 600, letterSpacing: '-0.03em' }}
      >
        Record Cash Payment · {formatCurrency(totalAmount)}
      </button>

      {open && (
        <div style={overlayStyle} onClick={close}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="d-flex flex-column"
            style={{ width: 440, maxWidth: '94vw', background: '#FFFFFF', borderRadius: 10, overflow: 'hidden' }}
          >
            <div className="d-flex justify-content-between align-items-center" style={{ padding: '16px 20px', borderBottom: '1px solid #F0F0F0' }}>
              <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.03em', color: '#181818' }}>Record Cash Payment</span>
              <button type="button" onClick={close} disabled={isPending} style={{ background: 'none', border: 'none', fontSize: 18, color: '#B7B7B7', lineHeight: 1 }}>
                ×
              </button>
            </div>

            <div className="d-flex flex-column" style={{ padding: '16px 20px', gap: 10 }}>
              <div className="d-flex justify-content-between">
                <span style={headStyle}>Customer</span>
                <span style={valueStyle}>{customerName}</span>
              </div>
              <div className="d-flex justify-content-between">
                <span style={headStyle}>Provider</span>
                <span style={valueStyle}>{providerName ?? '—'}</span>
              </div>
              <div className="d-flex justify-content-between align-items-center">
                <span style={{ fontSize: 13, fontWeight: 700, color: '#000000' }}>Cash received</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#000000' }}>{formatCurrency(totalAmount)}</span>
              </div>

              <div>
                <div style={{ ...headStyle, marginBottom: 6 }}>Who received the cash?</div>
                <div className="d-flex" style={{ gap: 8 }}>
                  {(
                    [
                      { value: 'COMPANY', label: 'Office (paid to us)' },
                      { value: 'PROVIDER', label: 'Provider (on-site)' },
                    ] as const
                  ).map((option) => {
                    const selected = collectedBy === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        disabled={isPending}
                        onClick={() => setCollectedBy(option.value)}
                        style={{
                          flex: 1,
                          borderRadius: 6,
                          padding: '9px',
                          fontSize: 12,
                          fontWeight: 600,
                          letterSpacing: '-0.03em',
                          background: selected ? '#181818' : '#FFFFFF',
                          color: selected ? '#FFFFFF' : '#181818',
                          border: `1px solid ${selected ? '#181818' : '#E5E5E5'}`,
                        }}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ fontSize: 11, color: '#6B6B6B', background: '#FAFAFA', border: '1px solid #F0F0F0', borderRadius: 6, padding: '8px 10px' }}>
                {collectedBy === 'COMPANY' ? (
                  <>
                    The customer paid the full amount to us directly. The ticket will be closed and the customer&apos;s
                    ledger will show a cash payment. Their wallet balance is not used. The provider is credited their
                    labour.
                  </>
                ) : (
                  <>
                    {providerName ?? 'The provider'} collected the full amount on-site but didn&apos;t mark it in the app.
                    The ticket will be closed, the same as the provider pressing Cash Collect. Their labour is credited,
                    and the rest is recorded as owed to the company.
                  </>
                )}
              </div>

              <textarea
                placeholder="Note (optional) — e.g. Paid at shop, receipt #123"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                rows={3}
                style={{ width: '100%', background: '#EFEFEF', border: '1px solid #E5E5E5', borderRadius: 6, padding: '8px 10px', fontSize: 12, resize: 'none', outline: 'none' }}
              />
            </div>

            <div style={{ padding: '14px 20px', borderTop: '1px solid #F0F0F0' }}>
              {error && <div className="mb-2" style={{ fontSize: 11, color: '#FF5E5E', fontWeight: 600 }}>{error}</div>}
              <div className="d-flex" style={{ gap: 10 }}>
                <button type="button" disabled={isPending} onClick={close} style={{ ...btnStyle, background: '#E5E5E5', color: '#181818' }}>
                  Cancel
                </button>
                <button type="button" disabled={isPending} onClick={confirm} style={{ ...btnStyle, background: '#2ABA65', color: '#FFFFFF' }}>
                  {isPending ? 'Recording…' : `Confirm ${formatCurrency(totalAmount)} cash`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

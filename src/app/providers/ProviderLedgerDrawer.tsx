'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import type { NexusWalletLedgerEntry, NexusWalletHistory } from '@/lib/nexus/wallet';
import { fetchProviderLedgerAction, payoutProviderAction } from './actions';
import { CloseIcon } from '../tickets/icons';

const inputStyle: CSSProperties = {
  width: '100%',
  background: '#EFEFEF',
  border: '1px solid #E5E5E5',
  borderRadius: 6,
  padding: '11px',
  fontSize: 14,
  fontWeight: 600,
  letterSpacing: '-0.03em',
  color: '#000000',
  outline: 'none',
};

const fieldLabelStyle: CSSProperties = { fontSize: 12, fontWeight: 600, letterSpacing: '-0.03em', color: '#454545', marginBottom: 4 };

function formatAmount(amount: number): string {
  return `₹${amount.toFixed(2)}`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function LedgerRow({ entry }: { entry: NexusWalletLedgerEntry }) {
  const isCredit = entry.type === 'CREDIT';
  return (
    <div className="d-flex align-items-center" style={{ padding: '10px 13px', borderBottom: '1px solid #E5E5E5' }}>
      <div style={{ width: 150, fontSize: 11, fontWeight: 600, color: '#454545' }}>{formatDateTime(entry.createdAt)}</div>
      <div style={{ width: 100 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '-0.03em',
            color: isCredit ? '#0C8D6E' : '#E53935',
            border: `1px solid ${isCredit ? '#0C8D6E' : '#E53935'}`,
            borderRadius: 20,
            padding: '2px 8px',
          }}
        >
          {isCredit ? 'Earned' : 'Paid Out'}
        </span>
      </div>
      <div className="flex-grow-1" style={{ fontSize: 12, fontWeight: 600, color: '#000' }}>{entry.title}</div>
      <div style={{ width: 110, textAlign: 'right', fontSize: 12, fontWeight: 700, color: isCredit ? '#0C8D6E' : '#E53935' }}>
        {isCredit ? '+' : '-'}{formatAmount(entry.amount)}
      </div>
      <div style={{ width: 110, textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#B7B7B7' }}>{formatAmount(entry.closingBalance)}</div>
    </div>
  );
}

export default function ProviderLedgerDrawer({
  open,
  providerId,
  providerName,
  currentBalance,
  mode,
  onClose,
  onPayoutComplete,
}: {
  open: boolean;
  providerId: string | null;
  providerName: string;
  currentBalance: number;
  mode: 'view' | 'payout';
  onClose: () => void;
  onPayoutComplete: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<'ledger' | 'confirm'>('ledger');
  const [history, setHistory] = useState<NexusWalletHistory | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setStep('ledger');
    setError(null);
    setDone(false);
    setAmount(currentBalance > 0 ? currentBalance.toFixed(2) : '');
    setNote('');
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, providerId]);

  useEffect(() => {
    if (!open || !providerId) return;
    setLoading(true);
    setError(null);
    fetchProviderLedgerAction(providerId, page)
      .then(setHistory)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load ledger'))
      .finally(() => setLoading(false));
  }, [open, providerId, page]);

  const parsedAmount = Number(amount);
  const amountValid = amount.trim() !== '' && Number.isFinite(parsedAmount) && parsedAmount > 0 && parsedAmount <= currentBalance;

  async function handleConfirmPayout() {
    if (!providerId || !amountValid) return;
    setSubmitting(true);
    setError(null);
    try {
      await payoutProviderAction(providerId, parsedAmount, note.trim() || undefined);
      setDone(true);
      onPayoutComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record payout');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open && !visible) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, pointerEvents: open ? 'auto' : 'none' }}>
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', opacity: visible ? 1 : 0, transition: 'opacity 0.25s ease' }}
      />

      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(640px, 96vw)',
          background: '#FFFFFF',
          borderTopLeftRadius: 10,
          borderBottomLeftRadius: 10,
          transform: `translateX(${visible ? '0' : '100%'})`,
          transition: 'transform 0.28s ease',
          overflowY: 'auto',
          padding: '20px 25px',
        }}
      >
        <div className="d-flex justify-content-between align-items-center mb-4">
          <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em', color: '#181818' }}>
            {step === 'confirm' ? 'Confirm Payout' : mode === 'payout' ? 'Payout — Review Ledger' : 'Wallet Ledger'}
            <div style={{ fontSize: 12, fontWeight: 600, color: '#B7B7B7' }}>{providerName}</div>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="d-flex align-items-center justify-content-center"
            style={{ width: 33, height: 33, borderRadius: '50%', border: '2px solid #F3F3F3', background: '#FFF', boxShadow: '0 4px 24px rgba(0,0,0,0.25)' }}
          >
            <CloseIcon />
          </button>
        </div>

        {step === 'ledger' && (
          <>
            <div className="d-flex justify-content-between align-items-center mb-3" style={{ background: '#EFEFEF', borderRadius: 6, padding: '13px' }}>
              <span style={fieldLabelStyle}>Current Wallet Balance</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: currentBalance >= 0 ? '#0C8D6E' : '#E53935' }}>{formatAmount(currentBalance)}</span>
            </div>

            <div style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 5, overflow: 'hidden', marginBottom: 16 }}>
              <div className="d-flex align-items-center" style={{ padding: '0 13px', height: 32, borderBottom: '1px solid #E5E5E5' }}>
                <div style={{ width: 150, fontSize: 10, fontWeight: 600, color: '#B7B7B7' }}>Date</div>
                <div style={{ width: 100, fontSize: 10, fontWeight: 600, color: '#B7B7B7' }}>Type</div>
                <div className="flex-grow-1" style={{ fontSize: 10, fontWeight: 600, color: '#B7B7B7' }}>Detail</div>
                <div style={{ width: 110, textAlign: 'right', fontSize: 10, fontWeight: 600, color: '#B7B7B7' }}>Amount</div>
                <div style={{ width: 110, textAlign: 'right', fontSize: 10, fontWeight: 600, color: '#B7B7B7' }}>Balance</div>
              </div>

              {loading && <div style={{ padding: 30, textAlign: 'center', color: '#B7B7B7', fontSize: 12 }}>Loading…</div>}

              {!loading && history?.entries.length === 0 && (
                <div style={{ padding: 30, textAlign: 'center', color: '#B7B7B7', fontSize: 12 }}>No ledger entries yet.</div>
              )}

              {!loading && history?.entries.map((entry) => <LedgerRow key={entry.id} entry={entry} />)}
            </div>

            {history && history.pagination.totalPages > 1 && (
              <div className="d-flex justify-content-between align-items-center mb-3">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  style={{ background: 'transparent', border: '1px solid #B7B7B7', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, opacity: page <= 1 ? 0.5 : 1 }}
                >
                  Previous
                </button>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#454545' }}>
                  Page {history.pagination.page} of {history.pagination.totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(history.pagination.totalPages, p + 1))}
                  disabled={page >= history.pagination.totalPages}
                  style={{ background: 'transparent', border: '1px solid #B7B7B7', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, opacity: page >= history.pagination.totalPages ? 0.5 : 1 }}
                >
                  Next
                </button>
              </div>
            )}

            {error && (
              <div className="mb-3" style={{ color: '#E53935', fontSize: 12, fontWeight: 600 }}>{error}</div>
            )}

            {mode === 'payout' && (
              <button
                type="button"
                onClick={() => setStep('confirm')}
                disabled={currentBalance <= 0}
                className="w-100"
                style={{
                  background: '#181818',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 6,
                  padding: '13px',
                  fontSize: 14,
                  fontWeight: 600,
                  letterSpacing: '-0.03em',
                  opacity: currentBalance <= 0 ? 0.5 : 1,
                }}
              >
                Continue to Payout
              </button>
            )}
          </>
        )}

        {step === 'confirm' && (
          <>
            {done ? (
              <div style={{ padding: '30px 0', textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#0C8D6E', marginBottom: 6 }}>Payout recorded</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#454545', marginBottom: 20 }}>
                  {formatAmount(parsedAmount)} marked as paid out to {providerName}.
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  style={{ background: '#181818', color: '#FFFFFF', border: 'none', borderRadius: 6, padding: '11px 24px', fontSize: 14, fontWeight: 600 }}
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="mb-3" style={{ background: '#EFEFEF', borderRadius: 6, padding: '13px' }}>
                  <div style={fieldLabelStyle}>Current Wallet Balance</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: currentBalance >= 0 ? '#0C8D6E' : '#E53935' }}>{formatAmount(currentBalance)}</div>
                </div>

                <div className="mb-3">
                  <div style={fieldLabelStyle}>Payout Amount</div>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    min={0.01}
                    max={currentBalance}
                    step="0.01"
                    style={inputStyle}
                  />
                  {!amountValid && amount.trim() !== '' && (
                    <div style={{ color: '#E53935', fontSize: 11, fontWeight: 600, marginTop: 4 }}>
                      Amount must be greater than 0 and not exceed the current balance.
                    </div>
                  )}
                </div>

                <div className="mb-4">
                  <div style={fieldLabelStyle}>Note (Optional)</div>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. Paid via bank transfer on…"
                    rows={3}
                    style={{ ...inputStyle, resize: 'none' }}
                  />
                </div>

                {error && (
                  <div className="mb-3" style={{ color: '#E53935', fontSize: 12, fontWeight: 600 }}>{error}</div>
                )}

                <div className="d-flex" style={{ gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setStep('ledger')}
                    disabled={submitting}
                    className="flex-grow-1"
                    style={{ background: 'transparent', color: '#181818', border: '1px solid #B7B7B7', borderRadius: 6, padding: '13px', fontSize: 14, fontWeight: 600 }}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmPayout}
                    disabled={submitting || !amountValid}
                    className="flex-grow-1"
                    style={{
                      background: '#181818',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: 6,
                      padding: '13px',
                      fontSize: 14,
                      fontWeight: 600,
                      opacity: submitting || !amountValid ? 0.6 : 1,
                    }}
                  >
                    {submitting ? 'Recording…' : 'Confirm Payout'}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

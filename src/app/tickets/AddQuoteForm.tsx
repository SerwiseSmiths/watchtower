'use client';

import { useEffect, useState, useTransition, type CSSProperties } from 'react';
import { addQuoteAction, fetchServiceParts, fetchServicePart } from './actions';
import type { AddQuoteItemInput } from '@/lib/nexus/complaints';
import type { NexusServicePart } from '@/lib/nexus/parts';

// A line item picked from the CMS catalogue carries its part's documentId as
// `partId` — nexus re-resolves name/price from the CMS at submit time using
// it, so what's shown here is only a preview of the current catalogue price,
// not the value that actually gets snapshotted (see AddQuoteItemInput) —
// unless `priceOverridden` is set, which is the admin's backup for when the
// real cost ran higher than the listed price: nexus then trusts `unitPrice`
// verbatim instead of re-resolving it. Custom items (no partId) always use
// whatever the admin typed, verbatim.
type LineItem = { partId?: string; name: string; unitPrice: number; quantity: number; priceOverridden?: boolean; catalogPrice?: number };

const inputStyle: CSSProperties = {
  background: '#EFEFEF',
  border: '1px solid #E5E5E5',
  borderRadius: 6,
  padding: '8px 10px',
  fontSize: 12,
  width: '100%',
};

const labelStyle: CSSProperties = { fontSize: 10, fontWeight: 600, letterSpacing: '-0.03em', color: '#B7B7B7', marginBottom: 4, display: 'block' };
const linkButtonStyle: CSSProperties = { background: 'none', border: 'none', color: '#B7B7B7', fontSize: 11, fontWeight: 600 };

function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// One row in the confirmation preview — `currentUnitPrice` is a fresh CMS
// read taken right before submitting, so the admin sees today's true price
// instead of whatever the catalogue picker showed however long ago they
// opened it. Nexus still independently re-resolves the authoritative price
// again at the moment it actually persists the quote (see addQuote) — this
// preview exists only to make sure the admin isn't confirming blind.
type ConfirmRow = {
  name: string;
  quantity: number;
  shownUnitPrice: number;
  currentUnitPrice: number;
  changed: boolean;
};

export default function AddQuoteForm({
  complaintId,
  deviceType,
  onCancel,
  onDone,
}: {
  complaintId: string;
  // Scopes the catalogue picker to parts applicable to this ticket's
  // appliance — omit to show the full catalogue.
  deviceType?: string;
  onCancel: () => void;
  onDone: () => void;
}) {
  const [items, setItems] = useState<LineItem[]>([]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [browsing, setBrowsing] = useState(false);
  const [parts, setParts] = useState<NexusServicePart[] | null>(null);
  const [search, setSearch] = useState('');

  const [confirmRows, setConfirmRows] = useState<ConfirmRow[] | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  useEffect(() => {
    if (!browsing || parts !== null) return;
    let cancelled = false;
    fetchServiceParts(deviceType).then((result) => {
      if (!cancelled) setParts(result);
    });
    return () => {
      cancelled = true;
    };
  }, [browsing, parts, deviceType]);

  const filteredParts = (parts ?? []).filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()));

  function addFromCatalogue(part: NexusServicePart) {
    setItems((prev) => [
      ...prev,
      { partId: part.documentId, name: part.name, unitPrice: part.face_value, catalogPrice: part.face_value, quantity: 1 },
    ]);
    setBrowsing(false);
    setSearch('');
  }

  function toggleCustomPrice(index: number) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        if (item.priceOverridden) {
          // Reverting — go back to the catalogue price shown when it was added.
          return { ...item, priceOverridden: false, unitPrice: item.catalogPrice ?? item.unitPrice };
        }
        return { ...item, priceOverridden: true };
      }),
    );
  }

  function addCustomItem() {
    setItems((prev) => [...prev, { name: '', unitPrice: 0, quantity: 1 }]);
  }

  function updateItem(index: number, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  const total = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  function buildPayload(): AddQuoteItemInput[] {
    return items.map((item) => ({
      name: item.name.trim(),
      unitPrice: item.unitPrice,
      quantity: item.quantity || 1,
      ...(item.partId && { partId: item.partId }),
      ...(item.priceOverridden && { priceOverridden: true }),
    }));
  }

  // Step 1 — re-checks every catalogue item's price against the CMS right
  // now (not whatever the picker had cached) and shows a confirmation
  // preview before anything is actually submitted.
  async function reviewAndConfirm() {
    if (items.length === 0) {
      setError('Add at least one item.');
      return;
    }
    const invalid = items.find((item) => !item.name.trim() || item.unitPrice < 0);
    if (invalid) {
      setError('Every item needs a name and a valid unit price.');
      return;
    }

    setError(null);
    setConfirmLoading(true);
    try {
      const rows = await Promise.all(
        items.map(async (item): Promise<ConfirmRow> => {
          if (!item.partId || item.priceOverridden) {
            return { name: item.name, quantity: item.quantity, shownUnitPrice: item.unitPrice, currentUnitPrice: item.unitPrice, changed: false };
          }
          const part = await fetchServicePart(item.partId);
          const currentUnitPrice = part?.face_value ?? item.unitPrice;
          return {
            name: item.name,
            quantity: item.quantity,
            shownUnitPrice: item.unitPrice,
            currentUnitPrice,
            changed: currentUnitPrice !== item.unitPrice,
          };
        }),
      );
      setConfirmRows(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check current prices — please try again.');
    } finally {
      setConfirmLoading(false);
    }
  }

  // Step 2 — the actual submit. Sends the items as originally built; nexus
  // re-resolves catalogue prices from the CMS independently at this exact
  // moment anyway (see addQuote), so what was previewed above is only ever
  // a preview, never what gets trusted.
  function confirmSubmit() {
    const payload = buildPayload();
    startTransition(async () => {
      try {
        await addQuoteAction(complaintId, payload, notes.trim() || undefined);
        onDone();
      } catch (err) {
        // Keep the confirmation open on failure so a retry doesn't need
        // another round of price-checking.
        setError(err instanceof Error ? err.message : 'Failed to submit quote — please try again.');
      }
    });
  }

  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 5, padding: 16 }}>
      <div className="mb-3" style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.03em', color: '#000000' }}>
        Create Quote
      </div>

      {browsing ? (
        <div>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <span style={{ fontSize: 12, fontWeight: 600, color: '#000000' }}>Add from Catalogue</span>
            <button type="button" onClick={() => setBrowsing(false)} style={linkButtonStyle}>
              Back
            </button>
          </div>
          <input
            style={{ ...inputStyle, marginBottom: 10 }}
            type="text"
            placeholder="Search parts, services, repairs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {parts === null && <div style={labelStyle}>Loading…</div>}
          {parts !== null && filteredParts.length === 0 && <div style={labelStyle}>No matching items.</div>}
          {parts !== null && filteredParts.length > 0 && (
            <div className="d-flex flex-column" style={{ gap: 6, maxHeight: 260, overflowY: 'auto' }}>
              {filteredParts.map((part) => (
                <div
                  key={part.documentId}
                  className="d-flex align-items-center justify-content-between"
                  style={{ background: '#F2F2F2', borderRadius: 6, padding: '8px 12px' }}
                >
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#181818' }}>{part.name}</div>
                    <div style={{ fontSize: 10, color: '#B7B7B7' }}>
                      {part.category} · {formatCurrency(part.face_value)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => addFromCatalogue(part)}
                    style={{ background: '#181818', color: '#FFFFFF', border: 'none', borderRadius: 5, padding: '6px 14px', fontSize: 11, fontWeight: 600 }}
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="d-flex flex-column" style={{ gap: 10 }}>
            {items.map((item, i) => (
              <div key={i}>
                <div className="d-flex align-items-end" style={{ gap: 8 }}>
                  <div style={{ flex: '2 1 0' }}>
                    {i === 0 && <span style={labelStyle}>Item</span>}
                    {item.partId ? (
                      <div style={{ ...inputStyle, background: '#E5E5E5', color: '#181818' }}>{item.name}</div>
                    ) : (
                      <input
                        style={inputStyle}
                        type="text"
                        placeholder="e.g. Compressor replacement"
                        value={item.name}
                        onChange={(e) => updateItem(i, { name: e.target.value })}
                      />
                    )}
                  </div>
                  <div style={{ flex: '1 1 0' }}>
                    {i === 0 && <span style={labelStyle}>Qty</span>}
                    <input
                      style={inputStyle}
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => updateItem(i, { quantity: Number(e.target.value) || 1 })}
                    />
                  </div>
                  <div style={{ flex: '1 1 0' }}>
                    {i === 0 && <span style={labelStyle}>Unit Price</span>}
                    {item.partId && !item.priceOverridden ? (
                      <div style={{ ...inputStyle, background: '#E5E5E5', color: '#181818' }}>{formatCurrency(item.unitPrice)}</div>
                    ) : (
                      <input
                        style={inputStyle}
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(i, { unitPrice: Number(e.target.value) || 0 })}
                      />
                    )}
                  </div>
                  <button type="button" onClick={() => removeItem(i)} style={{ ...linkButtonStyle, paddingBottom: 8 }}>
                    Remove
                  </button>
                </div>
                {item.partId && (
                  <div className="d-flex justify-content-end mt-1">
                    <button type="button" onClick={() => toggleCustomPrice(i)} style={{ ...linkButtonStyle, fontSize: 10 }}>
                      {item.priceOverridden ? 'Use catalogue price' : 'Actual cost is higher? Enter a custom price'}
                    </button>
                  </div>
                )}
              </div>
            ))}
            {items.length === 0 && <div style={labelStyle}>No items added yet.</div>}
          </div>

          <div className="d-flex align-items-center mt-2" style={{ gap: 14 }}>
            <button type="button" onClick={() => setBrowsing(true)} style={linkButtonStyle}>
              + Add from Catalogue
            </button>
            <button type="button" onClick={addCustomItem} style={linkButtonStyle}>
              + Add Custom Item
            </button>
          </div>

          <div className="mt-3">
            <span style={labelStyle}>Notes (optional)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              style={{ ...inputStyle, resize: 'none' }}
            />
          </div>

          <div className="d-flex justify-content-between align-items-center mt-3">
            <span style={{ fontSize: 12, fontWeight: 600, color: '#000000' }}>Total: {formatCurrency(total)}</span>
          </div>

          {error && (
            <div className="mt-2" style={{ fontSize: 11, color: '#FF5E5E', fontWeight: 600 }}>
              {error}
            </div>
          )}

          <div className="d-flex align-items-center mt-3" style={{ gap: 10 }}>
            <button
              type="button"
              disabled={confirmLoading}
              onClick={reviewAndConfirm}
              style={{ background: '#181818', color: '#FFFFFF', border: 'none', borderRadius: 6, padding: '8px 20px', fontSize: 12, fontWeight: 600 }}
            >
              {confirmLoading ? 'Checking prices…' : 'Submit Quote'}
            </button>
            <button type="button" onClick={onCancel} style={linkButtonStyle}>
              Cancel
            </button>
          </div>
        </>
      )}

      {confirmRows && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)' }}
          onClick={() => setConfirmRows(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 420, maxWidth: '90vw', maxHeight: '85vh', overflowY: 'auto', background: '#FFFFFF', borderRadius: 10, padding: 20 }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.03em', color: '#000000', marginBottom: 4 }}>
              Confirm Quote
            </div>
            <div style={{ fontSize: 11, color: '#B7B7B7', marginBottom: 14 }}>
              Prices below were just re-checked against the catalogue. Review before submitting.
            </div>

            <div className="d-flex flex-column" style={{ gap: 10, marginBottom: 14 }}>
              {confirmRows.map((row, i) => (
                <div key={i} className="d-flex justify-content-between align-items-start">
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#181818' }}>{row.name}</div>
                    <div style={{ fontSize: 10, color: '#B7B7B7' }}>Qty {row.quantity}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {row.changed ? (
                      <>
                        <div style={{ fontSize: 10, color: '#B7B7B7', textDecoration: 'line-through' }}>
                          {formatCurrency(row.shownUnitPrice)}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#FF5E5E' }}>{formatCurrency(row.currentUnitPrice)}</div>
                      </>
                    ) : (
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#181818' }}>{formatCurrency(row.currentUnitPrice)}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {confirmRows.some((r) => r.changed) && (
              <div className="mb-3" style={{ fontSize: 11, color: '#FF5E5E', fontWeight: 600 }}>
                One or more prices changed since you added them — the quote will use the current price shown above.
              </div>
            )}

            <div className="d-flex justify-content-between align-items-center mb-3" style={{ borderTop: '1px solid #E5E5E5', paddingTop: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#000000' }}>Total</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#000000' }}>
                {formatCurrency(confirmRows.reduce((sum, r) => sum + r.currentUnitPrice * r.quantity, 0))}
              </span>
            </div>

            {error && (
              <div className="mb-3" style={{ fontSize: 11, color: '#FF5E5E', fontWeight: 600 }}>
                {error}
              </div>
            )}

            <div className="d-flex align-items-center" style={{ gap: 10 }}>
              <button
                type="button"
                disabled={isPending}
                onClick={confirmSubmit}
                className="flex-grow-1"
                style={{ background: '#181818', color: '#FFFFFF', border: 'none', borderRadius: 6, padding: '10px', fontSize: 12, fontWeight: 600 }}
              >
                {isPending ? 'Submitting…' : 'Confirm & Submit'}
              </button>
              <button type="button" onClick={() => setConfirmRows(null)} style={linkButtonStyle}>
                Back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState, useTransition, type CSSProperties } from 'react';
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
type LineItem = {
  partId?: string;
  name: string;
  unitPrice: number;
  quantity: number;
  priceOverridden?: boolean;
  catalogPrice?: number;
  category?: string;
  type?: NexusServicePart['type'];
  description?: string | null;
};

type Step = 'browse' | 'cart' | 'confirm';

const TYPE_TABS: { key: NexusServicePart['type']; label: string }[] = [
  { key: 'Service', label: 'Service' },
  { key: 'Parts', label: 'Parts' },
  { key: 'Repair', label: 'Repairs' },
];

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 100,
  background: 'rgba(0,0,0,0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const inputStyle: CSSProperties = {
  background: '#EFEFEF',
  border: '1px solid #E5E5E5',
  borderRadius: 6,
  padding: '9px 11px',
  fontSize: 13,
  width: '100%',
  outline: 'none',
};

const labelStyle: CSSProperties = { fontSize: 10, fontWeight: 600, letterSpacing: '-0.03em', color: '#B7B7B7', marginBottom: 4, display: 'block' };
const linkButtonStyle: CSSProperties = { background: 'none', border: 'none', color: '#B7B7B7', fontSize: 11, fontWeight: 600 };

const stepperBtnStyle: CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: 6,
  border: '1px solid #B7B7B7',
  background: '#FFF',
  fontSize: 13,
  fontWeight: 700,
  lineHeight: 1,
};

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
  const [step, setStep] = useState<Step>('browse');
  const [items, setItems] = useState<LineItem[]>([]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [parts, setParts] = useState<NexusServicePart[] | null>(null);
  const [activeTab, setActiveTab] = useState<NexusServicePart['type']>('Service');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const [confirmRows, setConfirmRows] = useState<ConfirmRow[] | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  useEffect(() => {
    if (parts !== null) return;
    let cancelled = false;
    fetchServiceParts(deviceType).then((result) => {
      if (!cancelled) setParts(result);
    });
    return () => {
      cancelled = true;
    };
  }, [parts, deviceType]);

  const searchTerm = search.trim().toLowerCase();
  const searchResults = searchTerm
    ? (parts ?? []).filter((p) => p.name.toLowerCase().includes(searchTerm))
    : [];

  const tabParts = (parts ?? []).filter((p) => p.type === activeTab);
  const categorized = useMemo(() => {
    const groups: Record<string, NexusServicePart[]> = {};
    for (const p of tabParts) {
      (groups[p.category] ??= []).push(p);
    }
    return groups;
  }, [tabParts]);

  function toggleCategory(category: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

  const quantityFor = (documentId: string) => items.find((i) => i.partId === documentId)?.quantity ?? 0;

  function incrementPart(part: NexusServicePart) {
    setItems((prev) => {
      const existing = prev.find((i) => i.partId === part.documentId);
      if (existing) return prev.map((i) => (i.partId === part.documentId ? { ...i, quantity: i.quantity + 1 } : i));
      return [
        ...prev,
        {
          partId: part.documentId,
          name: part.name,
          unitPrice: part.face_value,
          catalogPrice: part.face_value,
          quantity: 1,
          category: part.category,
          type: part.type,
          description: part.description,
        },
      ];
    });
  }

  function decrementPart(documentId: string) {
    setItems((prev) => {
      const existing = prev.find((i) => i.partId === documentId);
      if (!existing) return prev;
      if (existing.quantity <= 1) return prev.filter((i) => i.partId !== documentId);
      return prev.map((i) => (i.partId === documentId ? { ...i, quantity: i.quantity - 1 } : i));
    });
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
  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);

  function buildPayload(): AddQuoteItemInput[] {
    return items.map((item) => ({
      name: item.name.trim(),
      unitPrice: item.unitPrice,
      quantity: item.quantity || 1,
      ...(item.partId && { partId: item.partId }),
      ...(item.priceOverridden && { priceOverridden: true }),
    }));
  }

  // Re-checks every catalogue item's price against the CMS right now (not
  // whatever the picker had cached) and shows a confirmation preview before
  // anything is actually submitted.
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
      setStep('confirm');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check current prices — please try again.');
    } finally {
      setConfirmLoading(false);
    }
  }

  // The actual submit. Sends the items as originally built; nexus re-resolves
  // catalogue prices from the CMS independently at this exact moment anyway
  // (see addQuote), so what was previewed above is only ever a preview,
  // never what gets trusted.
  function confirmSubmit() {
    const payload = buildPayload();
    startTransition(async () => {
      try {
        await addQuoteAction(complaintId, payload, notes.trim() || undefined);
        onDone();
      } catch (err) {
        // Stay on the confirm step on failure so a retry doesn't need
        // another round of price-checking.
        setError(err instanceof Error ? err.message : 'Failed to submit quote — please try again.');
      }
    });
  }

  return (
    <div style={overlayStyle} onClick={onCancel}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="d-flex flex-column"
        style={{ width: 480, maxWidth: '92vw', height: '82vh', background: '#FFFFFF', borderRadius: 10, overflow: 'hidden' }}
      >
        <div className="d-flex justify-content-between align-items-center" style={{ padding: '16px 20px', borderBottom: '1px solid #F0F0F0', flexShrink: 0 }}>
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.03em', color: '#181818' }}>Create Quote</span>
          <button type="button" onClick={onCancel} style={{ background: 'none', border: 'none', fontSize: 18, color: '#B7B7B7', lineHeight: 1 }}>
            ×
          </button>
        </div>

        {/* ── Browse: tabs + category accordions + search, same concept as radix's QuoteCreationScreen ── */}
        {step === 'browse' && (
          <>
            <div style={{ padding: '14px 20px 0', flexShrink: 0 }}>
              <input
                style={inputStyle}
                type="text"
                placeholder="Search parts, services, repairs…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              {!searchTerm && (
                <div className="d-flex" style={{ gap: 6, marginTop: 12 }}>
                  {TYPE_TABS.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      style={{
                        flex: 1,
                        background: activeTab === tab.key ? '#181818' : '#F2F2F2',
                        color: activeTab === tab.key ? '#FFF' : '#454545',
                        border: 'none',
                        borderRadius: 6,
                        padding: '8px 0',
                        fontSize: 12,
                        fontWeight: 600,
                        letterSpacing: '-0.03em',
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
              {parts === null && <div style={labelStyle}>Loading catalogue…</div>}

              {parts !== null && searchTerm && (
                <div className="d-flex flex-column" style={{ gap: 6 }}>
                  {searchResults.length === 0 && <div style={labelStyle}>No matching items.</div>}
                  {searchResults.map((part) => (
                    <PartRow
                      key={part.documentId}
                      part={part}
                      quantity={quantityFor(part.documentId)}
                      onIncrement={() => incrementPart(part)}
                      onDecrement={() => decrementPart(part.documentId)}
                    />
                  ))}
                </div>
              )}

              {parts !== null && !searchTerm && (
                <div className="d-flex flex-column" style={{ gap: 8 }}>
                  {Object.keys(categorized).length === 0 && <div style={labelStyle}>No items in this tab.</div>}
                  {Object.entries(categorized).map(([category, categoryParts]) => {
                    const expanded = expandedCategories.has(category);
                    return (
                      <div key={category} style={{ border: '1px solid #F0F0F0', borderRadius: 8, overflow: 'hidden' }}>
                        <button
                          type="button"
                          onClick={() => toggleCategory(category)}
                          className="d-flex justify-content-between align-items-center w-100"
                          style={{ background: '#FAFAFA', border: 'none', padding: '10px 12px', fontSize: 12, fontWeight: 600, color: '#181818' }}
                        >
                          <span>{category}</span>
                          <span style={{ fontSize: 10, color: '#B7B7B7', transform: expanded ? 'rotate(180deg)' : undefined }}>▾</span>
                        </button>
                        {expanded && (
                          <div className="d-flex flex-column" style={{ gap: 6, padding: 10 }}>
                            {categoryParts.map((part) => (
                              <PartRow
                                key={part.documentId}
                                part={part}
                                quantity={quantityFor(part.documentId)}
                                onIncrement={() => incrementPart(part)}
                                onDecrement={() => decrementPart(part.documentId)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <button type="button" onClick={addCustomItem} style={{ ...linkButtonStyle, marginTop: 12 }}>
                + Add Custom Item
              </button>
            </div>

            <div style={{ padding: '14px 20px', borderTop: '1px solid #F0F0F0', flexShrink: 0 }}>
              {error && (
                <div className="mb-2" style={{ fontSize: 11, color: '#FF5E5E', fontWeight: 600 }}>
                  {error}
                </div>
              )}
              <button
                type="button"
                disabled={totalCount === 0}
                onClick={() => setStep('cart')}
                className="w-100"
                style={{
                  background: '#181818',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 6,
                  padding: '11px',
                  fontSize: 13,
                  fontWeight: 600,
                  opacity: totalCount === 0 ? 0.5 : 1,
                }}
              >
                Review Quote {totalCount > 0 ? `(${totalCount})` : ''}
              </button>
            </div>
          </>
        )}

        {/* ── Cart: same concept as radix's QuoteConfirmSheet — editable running list ── */}
        {step === 'cart' && (
          <>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
              <div className="d-flex flex-column" style={{ gap: 10 }}>
                {items.map((item, i) => (
                  <div key={i} style={{ background: '#FAFAFA', border: '1px solid #F0F0F0', borderRadius: 8, padding: 10 }}>
                    <div className="d-flex justify-content-between align-items-start" style={{ gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        {item.partId ? (
                          <>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#181818' }}>{item.name}</div>
                            {item.description && <div style={{ fontSize: 10, color: '#B7B7B7' }}>{item.description}</div>}
                          </>
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
                      <button type="button" onClick={() => removeItem(i)} style={{ background: 'none', border: 'none', color: '#FF5E5E', fontSize: 11, fontWeight: 600 }}>
                        Remove
                      </button>
                    </div>

                    <div className="d-flex justify-content-between align-items-center" style={{ marginTop: 8 }}>
                      <div className="d-flex align-items-center" style={{ gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => updateItem(i, { quantity: Math.max(1, item.quantity - 1) })}
                          style={stepperBtnStyle}
                        >
                          −
                        </button>
                        <span style={{ width: 16, textAlign: 'center', fontSize: 12, fontWeight: 700 }}>{item.quantity}</span>
                        <button type="button" onClick={() => updateItem(i, { quantity: item.quantity + 1 })} style={stepperBtnStyle}>
                          +
                        </button>
                      </div>

                      {item.partId && !item.priceOverridden ? (
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#181818' }}>{formatCurrency(item.unitPrice * item.quantity)}</span>
                      ) : (
                        <input
                          style={{ ...inputStyle, width: 100, textAlign: 'right' }}
                          type="number"
                          min={0}
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(i, { unitPrice: Number(e.target.value) || 0 })}
                        />
                      )}
                    </div>

                    {item.partId && (
                      <div className="d-flex justify-content-end" style={{ marginTop: 6 }}>
                        <button type="button" onClick={() => toggleCustomPrice(i)} style={{ ...linkButtonStyle, fontSize: 10 }}>
                          {item.priceOverridden ? 'Use catalogue price' : 'Actual cost is higher? Enter a custom price'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {items.length === 0 && <div style={labelStyle}>No items added yet.</div>}
              </div>

              <div className="mt-3">
                <span style={labelStyle}>Notes (optional)</span>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'none' }} />
              </div>
            </div>

            <div style={{ padding: '14px 20px', borderTop: '1px solid #F0F0F0', flexShrink: 0 }}>
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span style={{ fontSize: 13, fontWeight: 700, color: '#000000' }}>Total</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#000000' }}>{formatCurrency(total)}</span>
              </div>
              {error && (
                <div className="mb-2" style={{ fontSize: 11, color: '#FF5E5E', fontWeight: 600 }}>
                  {error}
                </div>
              )}
              <div className="d-flex align-items-center" style={{ gap: 10 }}>
                <button type="button" onClick={() => setStep('browse')} style={linkButtonStyle}>
                  ← Back to Catalogue
                </button>
                <button
                  type="button"
                  disabled={confirmLoading}
                  onClick={reviewAndConfirm}
                  className="flex-grow-1"
                  style={{ background: '#181818', color: '#FFFFFF', border: 'none', borderRadius: 6, padding: '11px', fontSize: 13, fontWeight: 600 }}
                >
                  {confirmLoading ? 'Checking prices…' : 'Continue'}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Confirm: prices re-checked against the CMS right now — see this file's business-rule comment above ── */}
        {step === 'confirm' && confirmRows && (
          <>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
              <div style={{ fontSize: 11, color: '#B7B7B7', marginBottom: 14 }}>
                Prices below were just re-checked against the catalogue. Review before submitting.
              </div>

              <div className="d-flex flex-column" style={{ gap: 10 }}>
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
                <div className="mt-3" style={{ fontSize: 11, color: '#FF5E5E', fontWeight: 600 }}>
                  One or more prices changed since you added them — the quote will use the current price shown above.
                </div>
              )}
            </div>

            <div style={{ padding: '14px 20px', borderTop: '1px solid #F0F0F0', flexShrink: 0 }}>
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span style={{ fontSize: 13, fontWeight: 700, color: '#000000' }}>Total</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#000000' }}>
                  {formatCurrency(confirmRows.reduce((sum, r) => sum + r.currentUnitPrice * r.quantity, 0))}
                </span>
              </div>
              {error && (
                <div className="mb-2" style={{ fontSize: 11, color: '#FF5E5E', fontWeight: 600 }}>
                  {error}
                </div>
              )}
              <div className="d-flex align-items-center" style={{ gap: 10 }}>
                <button type="button" onClick={() => setStep('cart')} style={linkButtonStyle}>
                  ← Back
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={confirmSubmit}
                  className="flex-grow-1"
                  style={{ background: '#181818', color: '#FFFFFF', border: 'none', borderRadius: 6, padding: '11px', fontSize: 13, fontWeight: 600 }}
                >
                  {isPending ? 'Submitting…' : 'Confirm & Submit'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PartRow({
  part,
  quantity,
  onIncrement,
  onDecrement,
}: {
  part: NexusServicePart;
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
}) {
  return (
    <div
      className="d-flex align-items-center justify-content-between"
      style={{ background: '#F7F7F7', borderRadius: 6, padding: '8px 12px' }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#181818' }}>{part.name}</div>
        <div style={{ fontSize: 10, color: '#B7B7B7' }}>{formatCurrency(part.face_value)}</div>
      </div>
      {quantity === 0 ? (
        <button
          type="button"
          onClick={onIncrement}
          style={{ background: '#181818', color: '#FFFFFF', border: 'none', borderRadius: 5, padding: '6px 14px', fontSize: 11, fontWeight: 600, flexShrink: 0 }}
        >
          Add
        </button>
      ) : (
        <div className="d-flex align-items-center" style={{ gap: 8, flexShrink: 0 }}>
          <button type="button" onClick={onDecrement} style={stepperBtnStyle}>
            −
          </button>
          <span style={{ width: 16, textAlign: 'center', fontSize: 12, fontWeight: 700 }}>{quantity}</span>
          <button type="button" onClick={onIncrement} style={stepperBtnStyle}>
            +
          </button>
        </div>
      )}
    </div>
  );
}

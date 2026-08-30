'use client';

import { useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { dmSans } from '../tickets/fonts';
import RootSidebar from '@/components/RootSidebar';
import type { NexusProviderTier, ProviderTierInput } from '@/lib/nexus/providerTiers';
import { createProviderTierAction, updateProviderTierAction, deleteProviderTierAction } from './actions';

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

interface FormState {
  name: string;
  order: string;
  isActive: boolean;
  description: string;
  color: string;
}

const EMPTY_FORM: FormState = { name: '', order: '0', isActive: true, description: '', color: '' };

function tierToForm(tier: NexusProviderTier): FormState {
  return {
    name: tier.name,
    order: String(tier.order),
    isActive: tier.isActive,
    description: tier.description ?? '',
    color: tier.color ?? '',
  };
}

export default function ProviderTiersView({ tiers }: { tiers: NexusProviderTier[] }) {
  const router = useRouter();
  const labelStyle: CSSProperties = { fontSize: 10, fontWeight: 600, letterSpacing: '-0.03em', color: '#B7B7B7' };
  const cellStyle: CSSProperties = { fontSize: 12, fontWeight: 600, letterSpacing: '-0.03em', color: '#000000' };

  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function openCreate() {
    setEditingId(null);
    setCreating(true);
    setForm(EMPTY_FORM);
    setError(null);
  }

  function openEdit(tier: NexusProviderTier) {
    setCreating(false);
    setEditingId(tier.id);
    setForm(tierToForm(tier));
    setError(null);
  }

  function closeForm() {
    setCreating(false);
    setEditingId(null);
    setError(null);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }

    const input: ProviderTierInput = {
      name: form.name,
      order: Number(form.order) || 0,
      isActive: form.isActive,
      description: form.description || undefined,
      color: form.color || undefined,
    };

    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await updateProviderTierAction(editingId, input);
      } else {
        await createProviderTierAction(input);
      }
      router.refresh();
      closeForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save provider tier');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setError(null);
    try {
      await deleteProviderTierAction(id);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete provider tier');
    } finally {
      setDeletingId(null);
    }
  }

  const showForm = creating || editingId !== null;

  return (
    <div className={dmSans.className} style={{ minHeight: '100vh', background: '#F2F2F2', display: 'flex' }}>
      <RootSidebar />

      <main className="flex-grow-1" style={{ padding: '44px 40px' }}>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', color: '#181818' }}>Provider Tiers</h1>
          <button
            type="button"
            onClick={openCreate}
            style={{ background: '#181818', color: '#FFFFFF', borderRadius: 5, padding: '10px 16px', fontSize: 12, fontWeight: 500, letterSpacing: '-0.03em', border: 'none' }}
          >
            + Add Tier
          </button>
        </div>

        {showForm && (
          <div style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 5, padding: 20, marginBottom: 20 }}>
            <div className="row g-3 mb-3">
              <div className="col-4">
                <div style={fieldLabelStyle}>Name</div>
                <input type="text" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} style={inputStyle} placeholder="Gold" />
              </div>
              <div className="col-2">
                <div style={fieldLabelStyle}>Order</div>
                <input type="number" value={form.order} onChange={(e) => setForm((p) => ({ ...p, order: e.target.value }))} style={inputStyle} />
              </div>
              <div className="col-3">
                <div style={fieldLabelStyle}>Badge Color</div>
                <input type="text" value={form.color} onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))} style={inputStyle} placeholder="#D4AF37" />
              </div>
              <div className="col-3">
                <div style={fieldLabelStyle}>Active</div>
                <select
                  value={form.isActive ? 'true' : 'false'}
                  onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.value === 'true' }))}
                  style={inputStyle}
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
            </div>
            <div className="row g-3 mb-3">
              <div className="col-12">
                <div style={fieldLabelStyle}>Description (Optional)</div>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  rows={2}
                  style={{ ...inputStyle, resize: 'none' }}
                />
              </div>
            </div>

            {error && (
              <div className="mb-3" style={{ color: '#E53935', fontSize: 12, fontWeight: 600 }}>
                {error}
              </div>
            )}

            <div className="d-flex" style={{ gap: 10 }}>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                style={{ background: '#181818', color: '#FFFFFF', border: 'none', borderRadius: 6, padding: '10px 20px', fontSize: 13, fontWeight: 600, letterSpacing: '-0.03em', opacity: saving ? 0.6 : 1 }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={closeForm}
                style={{ background: 'transparent', color: '#454545', border: '1px solid #E5E5E5', borderRadius: 6, padding: '10px 20px', fontSize: 13, fontWeight: 600, letterSpacing: '-0.03em' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 5, overflow: 'hidden' }}>
          <div className="d-flex align-items-center" style={{ padding: '0 13px', height: 35, borderBottom: '1px solid #E5E5E5' }}>
            <div style={{ width: 220, ...labelStyle }}>Name</div>
            <div style={{ width: 80, ...labelStyle }}>Order</div>
            <div style={{ width: 90, ...labelStyle }}>Status</div>
            <div style={{ width: 300, ...labelStyle }}>Description</div>
            <div style={{ width: 140, ...labelStyle }}>Actions</div>
          </div>

          {tiers.length === 0 && (
            <div className="d-flex align-items-center justify-content-center" style={{ height: 80, ...labelStyle }}>
              No provider tiers yet.
            </div>
          )}

          {tiers.map((tier, i) => (
            <div
              key={tier.id}
              className="d-flex align-items-center"
              style={{ padding: '0 13px', height: 40, borderBottom: i === tiers.length - 1 ? 'none' : '1px solid #E5E5E5' }}
            >
              <div className="d-flex align-items-center" style={{ width: 220, gap: 9, ...cellStyle }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: tier.color ?? '#B7B7B7', flexShrink: 0 }} />
                {tier.name}
              </div>
              <div style={{ width: 80, ...cellStyle }}>{tier.order}</div>
              <div style={{ width: 90, ...cellStyle, color: tier.isActive ? '#0C8D6E' : '#B7B7B7' }}>{tier.isActive ? 'Active' : 'Inactive'}</div>
              <div style={{ width: 300, ...cellStyle, fontWeight: 400, color: '#454545' }}>{tier.description ?? '—'}</div>
              <div className="d-flex" style={{ width: 140, gap: 10 }}>
                <button type="button" onClick={() => openEdit(tier)} style={{ background: 'transparent', border: 'none', color: '#181818', fontSize: 12, fontWeight: 600, padding: 0 }}>
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(tier.id)}
                  disabled={deletingId === tier.id}
                  style={{ background: 'transparent', border: 'none', color: '#E53935', fontSize: 12, fontWeight: 600, padding: 0, opacity: deletingId === tier.id ? 0.6 : 1 }}
                >
                  {deletingId === tier.id ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {error && !showForm && (
          <div className="mt-3" style={{ color: '#E53935', fontSize: 12, fontWeight: 600 }}>
            {error}
          </div>
        )}
      </main>
    </div>
  );
}

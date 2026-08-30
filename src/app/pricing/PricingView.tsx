'use client';

import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { dmSans } from '../tickets/fonts';
import RootSidebar from '@/components/RootSidebar';
import type { NexusProviderTier } from '@/lib/nexus/providerTiers';
import type { ServicePartTierPricing } from '@/lib/nexus/servicePartPricing';
import {
  createSubscriptionPlanAction,
  updateSubscriptionPlanAction,
  deleteSubscriptionPlanAction,
  createSubscriptionAddonAction,
  updateSubscriptionAddonAction,
  deleteSubscriptionAddonAction,
  createServicePartAction,
  updateServicePartAction,
  deleteServicePartAction,
  uploadPricingImageAction,
  fetchTierPricingAction,
  upsertPartPricingAction,
  resetPartPricingAction,
  type SubscriptionPlanInput,
  type SubscriptionAddonInput,
  type ServicePartInput,
  type VisitServiceInput,
  type PlanFeatureInput,
} from './actions';

export interface MediaFile {
  id: number;
  url: string;
  name?: string | null;
}

export interface RelationOption {
  id: number;
  name: string;
}

export interface SubscriptionPlanRow {
  id: number;
  key: string;
  name: string;
  badge: string | null;
  badge_color: string | null;
  annual_price: number;
  monthly_price: number;
  tagline: string | null;
  max_services: number;
  duration_months: number;
  sort_order: number;
  is_active: boolean;
  visit_services: { visit_number: number; label: string; service_parts: RelationOption[] }[];
  features: PlanFeatureInput[];
}

export interface SubscriptionAddonRow {
  id: number;
  key: string;
  name: string;
  price: number;
  description: string | null;
  image: MediaFile | null;
  is_active: boolean;
  sort_order: number;
  device_types: RelationOption[];
}

export interface ServicePartRow {
  id: number;
  documentId: string;
  name: string;
  category: string;
  type: string;
  face_value: number;
  provider_cut: number | null;
  expense: number | null;
  description: string | null;
  visibility: string;
  device_types: RelationOption[];
}

export interface DeviceTypeOption {
  id: number;
  name: string;
}

const SERVICE_PART_CATEGORIES = ['Basic Filters', 'Additional Filters', 'Electrical Components', 'Other Items', 'Pipe & Fittings', 'Core'];
const SERVICE_PART_TYPES = ['Parts', 'Repair', 'Service'];
const SERVICE_PART_VISIBILITY = ['ACTIVE', 'DRAFT', 'DISCONTINUED'];

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
const labelStyle: CSSProperties = { fontSize: 10, fontWeight: 600, letterSpacing: '-0.03em', color: '#B7B7B7' };
const cellStyle: CSSProperties = { fontSize: 12, fontWeight: 600, letterSpacing: '-0.03em', color: '#000000' };

function ctaButtonStyle(color: string): CSSProperties {
  return { background: color, color: '#FFFFFF', border: 'none', borderRadius: 5, padding: '6px 14px', fontSize: 11, fontWeight: 600, letterSpacing: '-0.03em' };
}

// ─── Shared field widgets ───────────────────────────────────────────────────

function ImageField({ label, value, onChange }: { label: string; value: MediaFile | null; onChange: (file: MediaFile | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set('file', file);
      const uploaded = await uploadPricingImageAction(formData);
      onChange(uploaded);
    } catch {
      setError('Upload failed — please try again.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <div style={fieldLabelStyle}>{label}</div>
      <div className="d-flex align-items-center" style={{ gap: 10 }}>
        <div className="d-flex align-items-center justify-content-center" style={{ width: 56, height: 56, borderRadius: 6, background: '#EFEFEF', border: '1px solid #E5E5E5', overflow: 'hidden', flexShrink: 0 }}>
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value.url} alt={value.name ?? label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: 9, fontWeight: 600, color: '#B7B7B7' }}>None</span>
          )}
        </div>
        <div className="d-flex flex-column" style={{ gap: 4 }}>
          <button type="button" disabled={uploading} onClick={() => inputRef.current?.click()} style={{ background: '#181818', color: '#FFFFFF', border: 'none', borderRadius: 5, padding: '6px 12px', fontSize: 11, fontWeight: 600, opacity: uploading ? 0.6 : 1 }}>
            {uploading ? 'Uploading…' : value ? 'Change' : 'Upload'}
          </button>
          {value && (
            <button type="button" onClick={() => onChange(null)} style={{ background: 'transparent', border: 'none', color: '#B7B7B7', fontSize: 11, fontWeight: 600, padding: 0, textAlign: 'left' }}>
              Remove
            </button>
          )}
        </div>
        <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
      </div>
      {error && <div style={{ fontSize: 10, color: '#FF5E5E', fontWeight: 600, marginTop: 4 }}>{error}</div>}
    </div>
  );
}

function RelationChecklist({ label, options, selectedIds, onChange }: { label: string; options: RelationOption[]; selectedIds: number[]; onChange: (ids: number[]) => void }) {
  function toggle(id: number) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((v) => v !== id) : [...selectedIds, id]);
  }
  return (
    <div>
      <div style={fieldLabelStyle}>{label}</div>
      <div className="d-flex flex-column" style={{ maxHeight: 140, overflowY: 'auto', background: '#EFEFEF', border: '1px solid #E5E5E5', borderRadius: 6, padding: 8, gap: 4 }}>
        {options.length === 0 && <span style={{ fontSize: 11, color: '#B7B7B7' }}>None available.</span>}
        {options.map((option) => (
          <label key={option.id} className="d-flex align-items-center" style={{ gap: 6, fontSize: 12, color: '#000' }}>
            <input type="checkbox" checked={selectedIds.includes(option.id)} onChange={() => toggle(option.id)} />
            {option.name}
          </label>
        ))}
      </div>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 640, maxHeight: '90vh', overflowY: 'auto', background: '#FFFFFF', borderRadius: 10, padding: '20px 25px' }}>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em', color: '#181818' }}>{title}</span>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: '#B7B7B7', lineHeight: 1 }}>
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SaveButton({ saving, onClick }: { saving: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={saving} className="w-100" style={{ background: '#181818', color: '#FFFFFF', border: 'none', borderRadius: 6, padding: '13px', fontSize: 14, fontWeight: 600, letterSpacing: '-0.03em', opacity: saving ? 0.6 : 1 }}>
      {saving ? 'Saving…' : 'Save & Continue'}
    </button>
  );
}

// ─── Tabs ───────────────────────────────────────────────────────────────────
// Tab selection lives in the URL (?tab=) and is driven by RootSidebar's Pricing
// sub-links, not an in-page tab bar.

type Tab = 'plans' | 'addons' | 'parts';

// ─── Plans tab ──────────────────────────────────────────────────────────────

const EMPTY_PLAN_FORM: SubscriptionPlanInput = {
  key: '',
  name: '',
  badge: '',
  badge_color: '',
  annual_price: 0,
  monthly_price: 0,
  tagline: '',
  max_services: 4,
  duration_months: 12,
  sort_order: 0,
  is_active: true,
  visit_services: [],
  features: [],
};

function planToForm(row: SubscriptionPlanRow): SubscriptionPlanInput {
  return {
    key: row.key,
    name: row.name,
    badge: row.badge ?? '',
    badge_color: row.badge_color ?? '',
    annual_price: row.annual_price,
    monthly_price: row.monthly_price,
    tagline: row.tagline ?? '',
    max_services: row.max_services,
    duration_months: row.duration_months,
    sort_order: row.sort_order,
    is_active: row.is_active,
    visit_services: row.visit_services.map((v) => ({ visit_number: v.visit_number, label: v.label, service_parts: v.service_parts.map((p) => p.id) })),
    features: row.features.map((f) => ({ title: f.title, description: f.description, qty: f.qty })),
  };
}

function VisitServicesEditor({ value, onChange, partOptions }: { value: VisitServiceInput[]; onChange: (v: VisitServiceInput[]) => void; partOptions: RelationOption[] }) {
  function update(i: number, patch: Partial<VisitServiceInput>) {
    onChange(value.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  }
  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }
  function add() {
    onChange([...value, { visit_number: value.length + 1, label: '', service_parts: [] }]);
  }

  return (
    <div>
      <div style={fieldLabelStyle}>Visit Services</div>
      <div className="d-flex flex-column" style={{ gap: 10 }}>
        {value.map((v, i) => (
          <div key={i} style={{ background: '#F7F7F7', border: '1px solid #E5E5E5', borderRadius: 6, padding: 10 }}>
            <div className="row g-2 mb-2">
              <div className="col-3">
                <input type="number" value={v.visit_number} onChange={(e) => update(i, { visit_number: Number(e.target.value) })} style={inputStyle} placeholder="Visit #" />
              </div>
              <div className="col-7">
                <input type="text" value={v.label} onChange={(e) => update(i, { label: e.target.value })} style={inputStyle} placeholder="Label" />
              </div>
              <div className="col-2 d-flex align-items-center justify-content-center">
                <button type="button" onClick={() => remove(i)} style={{ background: 'transparent', border: 'none', color: '#E53935', fontSize: 12, fontWeight: 600 }}>
                  Remove
                </button>
              </div>
            </div>
            <RelationChecklist label="Included Service Parts" options={partOptions} selectedIds={v.service_parts ?? []} onChange={(ids) => update(i, { service_parts: ids })} />
          </div>
        ))}
      </div>
      <button type="button" onClick={add} className="mt-2" style={{ background: '#EFEFEF', border: '1px solid #E5E5E5', borderRadius: 6, padding: '6px 14px', fontSize: 11, fontWeight: 600, color: '#181818' }}>
        + Add Visit
      </button>
    </div>
  );
}

function FeaturesEditor({ value, onChange }: { value: PlanFeatureInput[]; onChange: (v: PlanFeatureInput[]) => void }) {
  function update(i: number, patch: Partial<PlanFeatureInput>) {
    onChange(value.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }
  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }
  function add() {
    onChange([...value, { title: '', description: '', qty: '' }]);
  }

  return (
    <div>
      <div style={fieldLabelStyle}>Features (What&apos;s Included)</div>
      <div className="d-flex flex-column" style={{ gap: 8 }}>
        {value.map((f, i) => (
          <div key={i} className="row g-2 align-items-center">
            <div className="col-4">
              <input type="text" value={f.title} onChange={(e) => update(i, { title: e.target.value })} style={inputStyle} placeholder="Title" />
            </div>
            <div className="col-5">
              <input type="text" value={f.description ?? ''} onChange={(e) => update(i, { description: e.target.value })} style={inputStyle} placeholder="Description" />
            </div>
            <div className="col-2">
              <input type="text" value={f.qty ?? ''} onChange={(e) => update(i, { qty: e.target.value })} style={inputStyle} placeholder="Qty" />
            </div>
            <div className="col-1">
              <button type="button" onClick={() => remove(i)} style={{ background: 'transparent', border: 'none', color: '#E53935', fontSize: 16, fontWeight: 600 }}>
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
      <button type="button" onClick={add} className="mt-2" style={{ background: '#EFEFEF', border: '1px solid #E5E5E5', borderRadius: 6, padding: '6px 14px', fontSize: 11, fontWeight: 600, color: '#181818' }}>
        + Add Feature
      </button>
    </div>
  );
}

function PlansTab({ plans, partOptions }: { plans: SubscriptionPlanRow[]; partOptions: RelationOption[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<SubscriptionPlanInput>(EMPTY_PLAN_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  function openCreate() {
    setEditingId(null);
    setCreating(true);
    setForm(EMPTY_PLAN_FORM);
    setError(null);
  }
  function openEdit(row: SubscriptionPlanRow) {
    setCreating(false);
    setEditingId(row.id);
    setForm(planToForm(row));
    setError(null);
  }
  function close() {
    setCreating(false);
    setEditingId(null);
    setError(null);
  }

  async function handleSave() {
    if (!form.key.trim() || !form.name.trim()) {
      setError('Key and name are required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editingId) await updateSubscriptionPlanAction(editingId, form);
      else await createSubscriptionPlanAction(form);
      router.refresh();
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save plan');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    setError(null);
    try {
      await deleteSubscriptionPlanAction(id);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete plan');
    } finally {
      setDeletingId(null);
    }
  }

  const showForm = creating || editingId !== null;

  return (
    <>
      <div className="d-flex justify-content-end mb-3">
        <button type="button" onClick={openCreate} style={{ background: '#181818', color: '#FFFFFF', borderRadius: 5, padding: '10px 16px', fontSize: 12, fontWeight: 500, border: 'none' }}>
          + Add Plan
        </button>
      </div>

      {showForm && (
        <Modal title={editingId ? 'Edit Subscription Plan' : 'Add Subscription Plan'} onClose={close}>
          <div className="row g-3 mb-3">
            <div className="col-6">
              <div style={fieldLabelStyle}>Key</div>
              <input type="text" value={form.key} onChange={(e) => setForm((p) => ({ ...p, key: e.target.value }))} style={inputStyle} />
            </div>
            <div className="col-6">
              <div style={fieldLabelStyle}>Name</div>
              <input type="text" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} style={inputStyle} />
            </div>
            <div className="col-4">
              <div style={fieldLabelStyle}>Badge</div>
              <input type="text" value={form.badge ?? ''} onChange={(e) => setForm((p) => ({ ...p, badge: e.target.value }))} style={inputStyle} />
            </div>
            <div className="col-4">
              <div style={fieldLabelStyle}>Badge Color</div>
              <input type="text" value={form.badge_color ?? ''} onChange={(e) => setForm((p) => ({ ...p, badge_color: e.target.value }))} style={inputStyle} placeholder="#D4AF37" />
            </div>
            <div className="col-4">
              <div style={fieldLabelStyle}>Active</div>
              <select value={form.is_active ? 'true' : 'false'} onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.value === 'true' }))} style={inputStyle}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
            <div className="col-4">
              <div style={fieldLabelStyle}>Annual Price</div>
              <input type="number" value={form.annual_price} onChange={(e) => setForm((p) => ({ ...p, annual_price: Number(e.target.value) }))} style={inputStyle} />
            </div>
            <div className="col-4">
              <div style={fieldLabelStyle}>Monthly Price</div>
              <input type="number" value={form.monthly_price} onChange={(e) => setForm((p) => ({ ...p, monthly_price: Number(e.target.value) }))} style={inputStyle} />
            </div>
            <div className="col-4">
              <div style={fieldLabelStyle}>Sort Order</div>
              <input type="number" value={form.sort_order} onChange={(e) => setForm((p) => ({ ...p, sort_order: Number(e.target.value) }))} style={inputStyle} />
            </div>
            <div className="col-6">
              <div style={fieldLabelStyle}>Max Services (-1 = unlimited)</div>
              <input type="number" value={form.max_services} onChange={(e) => setForm((p) => ({ ...p, max_services: Number(e.target.value) }))} style={inputStyle} />
            </div>
            <div className="col-6">
              <div style={fieldLabelStyle}>Duration (months)</div>
              <input type="number" value={form.duration_months} onChange={(e) => setForm((p) => ({ ...p, duration_months: Number(e.target.value) }))} style={inputStyle} />
            </div>
            <div className="col-12">
              <div style={fieldLabelStyle}>Tagline</div>
              <input type="text" value={form.tagline ?? ''} onChange={(e) => setForm((p) => ({ ...p, tagline: e.target.value }))} style={inputStyle} />
            </div>
          </div>

          <div className="mb-3">
            <VisitServicesEditor value={form.visit_services ?? []} onChange={(visit_services) => setForm((p) => ({ ...p, visit_services }))} partOptions={partOptions} />
          </div>
          <div className="mb-3">
            <FeaturesEditor value={form.features ?? []} onChange={(features) => setForm((p) => ({ ...p, features }))} />
          </div>

          {error && <div className="mb-3" style={{ color: '#E53935', fontSize: 12, fontWeight: 600 }}>{error}</div>}
          <SaveButton saving={saving} onClick={handleSave} />
        </Modal>
      )}

      <div style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 5, overflow: 'hidden' }}>
        <div className="d-flex align-items-center" style={{ padding: '0 13px', height: 35, borderBottom: '1px solid #E5E5E5' }}>
          <div style={{ width: 160, ...labelStyle }}>Key</div>
          <div style={{ width: 200, ...labelStyle }}>Name</div>
          <div style={{ width: 120, ...labelStyle }}>Annual</div>
          <div style={{ width: 120, ...labelStyle }}>Monthly</div>
          <div style={{ width: 90, ...labelStyle }}>Status</div>
          <div style={{ width: 140, ...labelStyle }}>Actions</div>
        </div>
        {plans.length === 0 && <div className="d-flex align-items-center justify-content-center" style={{ height: 80, ...labelStyle }}>No subscription plans yet.</div>}
        {plans.map((row, i) => (
          <div key={row.id} className="d-flex align-items-center" style={{ padding: '0 13px', height: 44, borderBottom: i === plans.length - 1 ? 'none' : '1px solid #E5E5E5', cursor: 'pointer' }} onClick={() => openEdit(row)}>
            <div style={{ width: 160, ...cellStyle }}>{row.key}</div>
            <div style={{ width: 200, ...cellStyle }}>{row.name}</div>
            <div style={{ width: 120, ...cellStyle }}>₹{row.annual_price}</div>
            <div style={{ width: 120, ...cellStyle }}>₹{row.monthly_price}</div>
            <div style={{ width: 90, ...cellStyle, color: row.is_active ? '#0C8D6E' : '#B7B7B7' }}>{row.is_active ? 'Active' : 'Inactive'}</div>
            <div style={{ width: 140 }} onClick={(e) => e.stopPropagation()}>
              <button type="button" onClick={() => handleDelete(row.id)} disabled={deletingId === row.id} style={{ ...ctaButtonStyle('#FF5E5E'), opacity: deletingId === row.id ? 0.6 : 1 }}>
                {deletingId === row.id ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        ))}
      </div>
      {error && !showForm && <div className="mt-3" style={{ color: '#E53935', fontSize: 12, fontWeight: 600 }}>{error}</div>}
    </>
  );
}

// ─── Addons tab ─────────────────────────────────────────────────────────────

const EMPTY_ADDON_FORM: SubscriptionAddonInput = { key: '', name: '', price: 0, description: '', image: null, is_active: true, sort_order: 0, device_types: [] };

function addonToForm(row: SubscriptionAddonRow): SubscriptionAddonInput & { imageFile: MediaFile | null } {
  return {
    key: row.key,
    name: row.name,
    price: row.price,
    description: row.description ?? '',
    image: row.image?.id ?? null,
    imageFile: row.image,
    is_active: row.is_active,
    sort_order: row.sort_order,
    device_types: row.device_types.map((d) => d.id),
  };
}

function AddonsTab({ addons, deviceTypeOptions }: { addons: SubscriptionAddonRow[]; deviceTypeOptions: DeviceTypeOption[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<SubscriptionAddonInput>(EMPTY_ADDON_FORM);
  const [imageFile, setImageFile] = useState<MediaFile | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  function openCreate() {
    setEditingId(null);
    setCreating(true);
    setForm(EMPTY_ADDON_FORM);
    setImageFile(null);
    setError(null);
  }
  function openEdit(row: SubscriptionAddonRow) {
    const { imageFile: img, ...rest } = addonToForm(row);
    setCreating(false);
    setEditingId(row.id);
    setForm(rest);
    setImageFile(img);
    setError(null);
  }
  function close() {
    setCreating(false);
    setEditingId(null);
    setError(null);
  }

  async function handleSave() {
    if (!form.key.trim() || !form.name.trim()) {
      setError('Key and name are required');
      return;
    }
    const input: SubscriptionAddonInput = { ...form, image: imageFile?.id ?? null };
    setSaving(true);
    setError(null);
    try {
      if (editingId) await updateSubscriptionAddonAction(editingId, input);
      else await createSubscriptionAddonAction(input);
      router.refresh();
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save addon');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    setError(null);
    try {
      await deleteSubscriptionAddonAction(id);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete addon');
    } finally {
      setDeletingId(null);
    }
  }

  const showForm = creating || editingId !== null;

  return (
    <>
      <div className="d-flex justify-content-end mb-3">
        <button type="button" onClick={openCreate} style={{ background: '#181818', color: '#FFFFFF', borderRadius: 5, padding: '10px 16px', fontSize: 12, fontWeight: 500, border: 'none' }}>
          + Add Addon
        </button>
      </div>

      {showForm && (
        <Modal title={editingId ? 'Edit Subscription Addon' : 'Add Subscription Addon'} onClose={close}>
          <div className="row g-3 mb-3">
            <div className="col-6">
              <div style={fieldLabelStyle}>Key</div>
              <input type="text" value={form.key} onChange={(e) => setForm((p) => ({ ...p, key: e.target.value }))} style={inputStyle} />
            </div>
            <div className="col-6">
              <div style={fieldLabelStyle}>Name</div>
              <input type="text" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} style={inputStyle} />
            </div>
            <div className="col-4">
              <div style={fieldLabelStyle}>Price</div>
              <input type="number" value={form.price} onChange={(e) => setForm((p) => ({ ...p, price: Number(e.target.value) }))} style={inputStyle} />
            </div>
            <div className="col-4">
              <div style={fieldLabelStyle}>Sort Order</div>
              <input type="number" value={form.sort_order} onChange={(e) => setForm((p) => ({ ...p, sort_order: Number(e.target.value) }))} style={inputStyle} />
            </div>
            <div className="col-4">
              <div style={fieldLabelStyle}>Active</div>
              <select value={form.is_active ? 'true' : 'false'} onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.value === 'true' }))} style={inputStyle}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
            <div className="col-12">
              <div style={fieldLabelStyle}>Description</div>
              <textarea value={form.description ?? ''} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={2} style={{ ...inputStyle, resize: 'none' }} />
            </div>
          </div>

          <div className="row g-3 mb-3">
            <div className="col-6">
              <ImageField label="Image" value={imageFile} onChange={setImageFile} />
            </div>
            <div className="col-6">
              <RelationChecklist label="Device Types" options={deviceTypeOptions} selectedIds={form.device_types ?? []} onChange={(device_types) => setForm((p) => ({ ...p, device_types }))} />
            </div>
          </div>

          {error && <div className="mb-3" style={{ color: '#E53935', fontSize: 12, fontWeight: 600 }}>{error}</div>}
          <SaveButton saving={saving} onClick={handleSave} />
        </Modal>
      )}

      <div style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 5, overflow: 'hidden' }}>
        <div className="d-flex align-items-center" style={{ padding: '0 13px', height: 35, borderBottom: '1px solid #E5E5E5' }}>
          <div style={{ width: 60, ...labelStyle }}>Image</div>
          <div style={{ width: 160, ...labelStyle }}>Key</div>
          <div style={{ width: 200, ...labelStyle }}>Name</div>
          <div style={{ width: 100, ...labelStyle }}>Price</div>
          <div style={{ width: 90, ...labelStyle }}>Status</div>
          <div style={{ width: 140, ...labelStyle }}>Actions</div>
        </div>
        {addons.length === 0 && <div className="d-flex align-items-center justify-content-center" style={{ height: 80, ...labelStyle }}>No subscription addons yet.</div>}
        {addons.map((row, i) => (
          <div key={row.id} className="d-flex align-items-center" style={{ padding: '0 13px', height: 48, borderBottom: i === addons.length - 1 ? 'none' : '1px solid #E5E5E5', cursor: 'pointer' }} onClick={() => openEdit(row)}>
            <div style={{ width: 60 }}>
              <div style={{ width: 32, height: 32, borderRadius: 5, background: '#EFEFEF', overflow: 'hidden' }}>
                {row.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.image.url} alt={row.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
              </div>
            </div>
            <div style={{ width: 160, ...cellStyle }}>{row.key}</div>
            <div style={{ width: 200, ...cellStyle }}>{row.name}</div>
            <div style={{ width: 100, ...cellStyle }}>₹{row.price}</div>
            <div style={{ width: 90, ...cellStyle, color: row.is_active ? '#0C8D6E' : '#B7B7B7' }}>{row.is_active ? 'Active' : 'Inactive'}</div>
            <div style={{ width: 140 }} onClick={(e) => e.stopPropagation()}>
              <button type="button" onClick={() => handleDelete(row.id)} disabled={deletingId === row.id} style={{ ...ctaButtonStyle('#FF5E5E'), opacity: deletingId === row.id ? 0.6 : 1 }}>
                {deletingId === row.id ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        ))}
      </div>
      {error && !showForm && <div className="mt-3" style={{ color: '#E53935', fontSize: 12, fontWeight: 600 }}>{error}</div>}
    </>
  );
}

// ─── Parts tab ──────────────────────────────────────────────────────────────

const EMPTY_PART_FORM: ServicePartInput = { name: '', category: SERVICE_PART_CATEGORIES[0], type: SERVICE_PART_TYPES[0], face_value: 0, provider_cut: 0, expense: 0, description: '', visibility: 'ACTIVE', device_types: [] };

interface ResolvedPricing {
  salesPrice: number;
  expense: number;
  labour: number;
  maxDiscount: number;
  isDefault: boolean;
}

function resolvePricing(row: ServicePartRow, override: ServicePartTierPricing | undefined): ResolvedPricing {
  if (override) {
    return { salesPrice: override.salesPrice, expense: override.expense ?? 0, labour: override.labour ?? 0, maxDiscount: override.maxDiscount ?? 0, isDefault: false };
  }
  return { salesPrice: row.face_value, expense: row.expense ?? 0, labour: row.provider_cut ?? 0, maxDiscount: 0, isDefault: true };
}

// Uncontrolled + `key`-reset (not a controlled input synced via effect): the input owns its
// own text while typing, and only resets to the resolved `value` when the parent remounts it
// (pass `key={value}` from the caller) — e.g. after a save completes or the Group changes.
function EditableMoneyCell({ value, isDefault, onSave }: { value: number; isDefault: boolean; onSave: (next: number) => void }) {
  return (
    <div className="d-flex flex-column align-items-center" style={{ width: '100%' }}>
      <div className="d-flex align-items-center" style={{ gap: 2 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: '#181818' }}>₹</span>
        <input
          type="number"
          defaultValue={value}
          onBlur={(e) => {
            const parsed = Number(e.target.value);
            if (!Number.isNaN(parsed) && parsed !== value) onSave(parsed);
          }}
          style={{ width: 56, border: 'none', background: 'transparent', fontSize: 10, fontWeight: 600, color: '#181818', textAlign: 'center', outline: 'none' }}
        />
      </div>
      {isDefault && <span style={{ fontSize: 8, fontWeight: 600, color: '#B7B7B7' }}>Default</span>}
    </div>
  );
}

function PartDetailDrawer({
  part,
  deviceTypeOptions,
  onClose,
  onSaved,
}: {
  part: ServicePartRow;
  deviceTypeOptions: DeviceTypeOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ServicePartInput>({
    name: part.name,
    category: part.category,
    type: part.type,
    face_value: part.face_value,
    provider_cut: part.provider_cut ?? 0,
    expense: part.expense ?? 0,
    description: part.description ?? '',
    visibility: part.visibility,
    device_types: part.device_types.map((d) => d.id),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleSave() {
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateServicePartAction(part.id, form);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await deleteServicePartAction(part.id);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
      setDeleting(false);
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.45)' }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 460, maxWidth: '96vw', background: '#FFFFFF', overflowY: 'auto', padding: '20px 25px' }}
      >
        <div className="d-flex justify-content-between align-items-center mb-3">
          <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.03em', color: '#181818' }}>Part Details</span>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: '#B7B7B7', lineHeight: 1 }}>
            ×
          </button>
        </div>

        <div className="d-flex flex-column" style={{ gap: 12 }}>
          <div>
            <div style={fieldLabelStyle}>Name</div>
            <input type="text" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <div style={fieldLabelStyle}>Description</div>
            <textarea value={form.description ?? ''} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={5} style={{ ...inputStyle, resize: 'none' }} />
          </div>
          <div className="row g-3">
            <div className="col-6">
              <div style={fieldLabelStyle}>Category</div>
              <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} style={inputStyle}>
                {SERVICE_PART_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="col-6">
              <div style={fieldLabelStyle}>Type</div>
              <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} style={inputStyle}>
                {SERVICE_PART_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="col-6">
              <div style={fieldLabelStyle}>Visibility</div>
              <select value={form.visibility} onChange={(e) => setForm((p) => ({ ...p, visibility: e.target.value }))} style={inputStyle}>
                {SERVICE_PART_VISIBILITY.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>
          <div className="row g-3">
            <div className="col-4">
              <div style={fieldLabelStyle}>Default Sales Price</div>
              <input type="number" value={form.face_value} onChange={(e) => setForm((p) => ({ ...p, face_value: Number(e.target.value) }))} style={inputStyle} />
            </div>
            <div className="col-4">
              <div style={fieldLabelStyle}>Default Expense</div>
              <input type="number" value={form.expense ?? 0} onChange={(e) => setForm((p) => ({ ...p, expense: Number(e.target.value) }))} style={inputStyle} />
            </div>
            <div className="col-4">
              <div style={fieldLabelStyle}>Default Labour</div>
              <input type="number" value={form.provider_cut ?? 0} onChange={(e) => setForm((p) => ({ ...p, provider_cut: Number(e.target.value) }))} style={inputStyle} />
            </div>
          </div>
          <div style={{ fontSize: 10, color: '#B7B7B7' }}>
            These are the fallback values used for any Group with no pricing override set for this part.
          </div>

          <RelationChecklist
            label="Device Types"
            options={deviceTypeOptions}
            selectedIds={form.device_types ?? []}
            onChange={(device_types) => setForm((p) => ({ ...p, device_types }))}
          />
        </div>

        {error && <div className="mt-3" style={{ color: '#E53935', fontSize: 12, fontWeight: 600 }}>{error}</div>}

        <div className="d-flex mt-4" style={{ gap: 10 }}>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-grow-1"
            style={{ background: '#181818', color: '#FFFFFF', border: 'none', borderRadius: 6, padding: '12px', fontSize: 13, fontWeight: 600, opacity: saving ? 0.6 : 1 }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button type="button" onClick={handleDelete} disabled={deleting} style={{ ...ctaButtonStyle('#FF5E5E'), padding: '12px 18px', opacity: deleting ? 0.6 : 1 }}>
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PartsTab({
  parts,
  deviceTypeOptions,
  providerTiers,
}: {
  parts: ServicePartRow[];
  deviceTypeOptions: DeviceTypeOption[];
  providerTiers: NexusProviderTier[];
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<ServicePartInput>(EMPTY_PART_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailPart, setDetailPart] = useState<ServicePartRow | null>(null);

  const [selectedTierId, setSelectedTierId] = useState<string>(providerTiers[0]?.id ?? '');
  const [selectedDeviceType, setSelectedDeviceType] = useState<number | 'all'>('all');
  const [pricingMap, setPricingMap] = useState<Map<string, ServicePartTierPricing>>(new Map());
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!selectedTierId) {
      setPricingMap(new Map());
      return;
    }
    let cancelled = false;
    fetchTierPricingAction(selectedTierId).then((list) => {
      if (cancelled) return;
      setPricingMap(new Map(list.map((p) => [p.servicePartId, p])));
    });
    return () => {
      cancelled = true;
    };
  }, [selectedTierId]);

  function openCreate() {
    setCreating(true);
    setForm(EMPTY_PART_FORM);
    setError(null);
  }
  function closeCreate() {
    setCreating(false);
    setError(null);
  }

  async function handleCreate() {
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createServicePartAction(form);
      router.refresh();
      closeCreate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save service part');
    } finally {
      setSaving(false);
    }
  }

  async function savePricingField(row: ServicePartRow, patch: Partial<Pick<ResolvedPricing, 'salesPrice' | 'expense' | 'labour' | 'maxDiscount'>>) {
    if (!selectedTierId) return;
    const current = resolvePricing(row, pricingMap.get(row.documentId));
    const next = { ...current, ...patch };
    const saved = await upsertPartPricingAction({
      servicePartId: row.documentId,
      providerTierId: selectedTierId,
      salesPrice: next.salesPrice,
      expense: next.expense,
      labour: next.labour,
      maxDiscount: next.maxDiscount,
    });
    setPricingMap((prev) => new Map(prev).set(row.documentId, saved));
  }

  async function resetPricingForRow(row: ServicePartRow) {
    if (!selectedTierId) return;
    await resetPartPricingAction(row.documentId, selectedTierId);
    setPricingMap((prev) => {
      const next = new Map(prev);
      next.delete(row.documentId);
      return next;
    });
  }

  function toggleCollapsed(deviceTypeId: number) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(deviceTypeId)) next.delete(deviceTypeId);
      else next.add(deviceTypeId);
      return next;
    });
  }

  const sections = deviceTypeOptions
    .filter((dt) => selectedDeviceType === 'all' || selectedDeviceType === dt.id)
    .map((dt) => ({ deviceType: dt, rows: parts.filter((p) => p.device_types.some((x) => x.id === dt.id)) }))
    .filter((section) => section.rows.length > 0);

  const colHeaderStyle: CSSProperties = { ...labelStyle, textAlign: 'center' };

  return (
    <>
      <div className="d-flex justify-content-end mb-3">
        <button type="button" onClick={openCreate} style={{ background: '#181818', color: '#FFFFFF', borderRadius: 5, padding: '10px 16px', fontSize: 12, fontWeight: 500, border: 'none' }}>
          + Add Part
        </button>
      </div>

      {creating && (
        <Modal title="Add Service Part" onClose={closeCreate}>
          <div className="row g-3 mb-3">
            <div className="col-6">
              <div style={fieldLabelStyle}>Name</div>
              <input type="text" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} style={inputStyle} />
            </div>
            <div className="col-3">
              <div style={fieldLabelStyle}>Category</div>
              <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} style={inputStyle}>
                {SERVICE_PART_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="col-3">
              <div style={fieldLabelStyle}>Type</div>
              <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} style={inputStyle}>
                {SERVICE_PART_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="col-4">
              <div style={fieldLabelStyle}>Default Sales Price</div>
              <input type="number" value={form.face_value} onChange={(e) => setForm((p) => ({ ...p, face_value: Number(e.target.value) }))} style={inputStyle} />
            </div>
            <div className="col-4">
              <div style={fieldLabelStyle}>Default Labour</div>
              <input type="number" value={form.provider_cut ?? 0} onChange={(e) => setForm((p) => ({ ...p, provider_cut: Number(e.target.value) }))} style={inputStyle} />
            </div>
            <div className="col-4">
              <div style={fieldLabelStyle}>Default Expense</div>
              <input type="number" value={form.expense ?? 0} onChange={(e) => setForm((p) => ({ ...p, expense: Number(e.target.value) }))} style={inputStyle} />
            </div>
            <div className="col-6">
              <div style={fieldLabelStyle}>Visibility</div>
              <select value={form.visibility} onChange={(e) => setForm((p) => ({ ...p, visibility: e.target.value }))} style={inputStyle}>
                {SERVICE_PART_VISIBILITY.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="col-12">
              <div style={fieldLabelStyle}>Description</div>
              <textarea value={form.description ?? ''} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={2} style={{ ...inputStyle, resize: 'none' }} />
            </div>
          </div>

          <div className="mb-3">
            <RelationChecklist label="Device Types" options={deviceTypeOptions} selectedIds={form.device_types ?? []} onChange={(device_types) => setForm((p) => ({ ...p, device_types }))} />
          </div>

          {error && <div className="mb-3" style={{ color: '#E53935', fontSize: 12, fontWeight: 600 }}>{error}</div>}
          <SaveButton saving={saving} onClick={handleCreate} />
        </Modal>
      )}

      {/* Filter row */}
      <div className="d-flex align-items-center mb-3" style={{ gap: 12 }}>
        <div>
          <div style={fieldLabelStyle}>Group</div>
          <select value={selectedTierId} onChange={(e) => setSelectedTierId(e.target.value)} style={inputStyle}>
            {providerTiers.length === 0 && <option value="">No groups yet</option>}
            {providerTiers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <div style={fieldLabelStyle}>Device Type</div>
          <select
            value={selectedDeviceType === 'all' ? 'all' : String(selectedDeviceType)}
            onChange={(e) => setSelectedDeviceType(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            style={inputStyle}
          >
            <option value="all">All</option>
            {deviceTypeOptions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      </div>

      <div className="d-flex flex-column" style={{ gap: 12 }}>
        {sections.length === 0 && (
          <div style={{ background: '#FFFFFF', borderRadius: 5, padding: 40, textAlign: 'center', ...labelStyle }}>No service parts match this filter.</div>
        )}

        {sections.map(({ deviceType, rows }) => {
          const isCollapsed = collapsed.has(deviceType.id);
          return (
            <div key={deviceType.id} style={{ background: '#FFFFFF', borderRadius: 5, overflow: 'hidden' }}>
              <div
                onClick={() => toggleCollapsed(deviceType.id)}
                className="d-flex align-items-center justify-content-between"
                style={{ background: '#CED9E4', padding: '0 15px', height: 35, cursor: 'pointer' }}
              >
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '-0.03em', color: '#181818' }}>{deviceType.name}</span>
                <span style={{ fontSize: 10, color: '#181818' }}>{isCollapsed ? '▸' : '▾'}</span>
              </div>

              {!isCollapsed && (
                <>
                  <div className="d-flex align-items-center" style={{ padding: '0 15px', height: 35, borderBottom: '1px solid #E5E5E5' }}>
                    <div style={{ width: 220, ...labelStyle }}>Particulars</div>
                    <div style={{ width: 90, ...colHeaderStyle }}>Status</div>
                    <div style={{ width: 90, ...colHeaderStyle }}>Sales Price</div>
                    <div style={{ width: 90, ...colHeaderStyle }}>Expense</div>
                    <div style={{ width: 90, ...colHeaderStyle }}>Labour</div>
                    <div style={{ width: 90, ...colHeaderStyle }}>Gross Profit</div>
                    <div style={{ width: 90, ...colHeaderStyle }}>Max Discount</div>
                    <div style={{ width: 90, ...colHeaderStyle }}>Type</div>
                    <div style={{ width: 60 }} />
                  </div>

                  {rows.map((row, i) => {
                    const pricing = resolvePricing(row, pricingMap.get(row.documentId));
                    const grossProfit = pricing.salesPrice - pricing.expense - pricing.labour;
                    return (
                      <div
                        key={row.id}
                        className="d-flex align-items-center"
                        style={{ padding: '0 15px', height: 44, borderBottom: i === rows.length - 1 ? 'none' : '1px solid #E5E5E5' }}
                      >
                        <div
                          style={{ width: 220, ...cellStyle, cursor: 'pointer' }}
                          onClick={() => setDetailPart(row)}
                        >
                          {row.name}
                        </div>
                        <div style={{ width: 90 }} className="d-flex justify-content-center">
                          <span
                            style={{
                              background: row.visibility === 'ACTIVE' ? '#D6FAB4' : '#E5E5E5',
                              color: row.visibility === 'ACTIVE' ? '#007637' : '#454545',
                              border: `1px solid ${row.visibility === 'ACTIVE' ? '#007637' : '#454545'}`,
                              borderRadius: 4,
                              padding: '2px 8px',
                              fontSize: 8,
                              fontWeight: 500,
                            }}
                          >
                            {row.visibility === 'ACTIVE' ? 'Active' : row.visibility === 'DRAFT' ? 'Draft' : 'Discontinued'}
                          </span>
                        </div>
                        <div style={{ width: 90 }}>
                          <EditableMoneyCell key={pricing.salesPrice} value={pricing.salesPrice} isDefault={pricing.isDefault} onSave={(v) => savePricingField(row, { salesPrice: v })} />
                        </div>
                        <div style={{ width: 90 }}>
                          <EditableMoneyCell key={pricing.expense} value={pricing.expense} isDefault={pricing.isDefault} onSave={(v) => savePricingField(row, { expense: v })} />
                        </div>
                        <div style={{ width: 90 }}>
                          <EditableMoneyCell key={pricing.labour} value={pricing.labour} isDefault={pricing.isDefault} onSave={(v) => savePricingField(row, { labour: v })} />
                        </div>
                        <div style={{ width: 90, ...cellStyle, textAlign: 'center' }}>₹{grossProfit.toFixed(2)}</div>
                        <div style={{ width: 90 }}>
                          <EditableMoneyCell key={pricing.maxDiscount} value={pricing.maxDiscount} isDefault={pricing.isDefault} onSave={(v) => savePricingField(row, { maxDiscount: v })} />
                        </div>
                        <div style={{ width: 90, ...cellStyle, fontWeight: 400, textAlign: 'center' }}>{row.type}</div>
                        <div style={{ width: 60 }} className="d-flex justify-content-center">
                          {!pricing.isDefault && (
                            <button
                              type="button"
                              onClick={() => resetPricingForRow(row)}
                              title="Reset to default price"
                              style={{ background: 'none', border: 'none', fontSize: 9, fontWeight: 600, color: '#0D67CE', padding: 0 }}
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          );
        })}
      </div>

      {error && !creating && <div className="mt-3" style={{ color: '#E53935', fontSize: 12, fontWeight: 600 }}>{error}</div>}

      {detailPart && (
        <PartDetailDrawer
          part={detailPart}
          deviceTypeOptions={deviceTypeOptions}
          onClose={() => setDetailPart(null)}
          onSaved={() => router.refresh()}
        />
      )}
    </>
  );
}

// ─── Root ───────────────────────────────────────────────────────────────────

export default function PricingView({
  plans,
  addons,
  parts,
  deviceTypeOptions,
  providerTiers,
}: {
  plans: SubscriptionPlanRow[];
  addons: SubscriptionAddonRow[];
  parts: ServicePartRow[];
  deviceTypeOptions: DeviceTypeOption[];
  providerTiers: NexusProviderTier[];
}) {
  const searchParams = useSearchParams();
  const tab: Tab = (searchParams?.get('tab') as Tab | null) ?? 'plans';
  const partOptions: RelationOption[] = parts.map((p) => ({ id: p.id, name: p.name }));

  const heading: Record<Tab, string> = { plans: 'Subscription Plans', addons: 'Subscription Addons', parts: 'Service Parts' };

  return (
    <div className={dmSans.className} style={{ minHeight: '100vh', background: '#F2F2F2', display: 'flex' }}>
      <RootSidebar />
      <main className="flex-grow-1" style={{ padding: '44px 40px' }}>
        <h1 className="mb-4" style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', color: '#181818' }}>{heading[tab]}</h1>

        {tab === 'plans' && <PlansTab plans={plans} partOptions={partOptions} />}
        {tab === 'addons' && <AddonsTab addons={addons} deviceTypeOptions={deviceTypeOptions} />}
        {tab === 'parts' && <PartsTab parts={parts} deviceTypeOptions={deviceTypeOptions} providerTiers={providerTiers} />}
      </main>
    </div>
  );
}

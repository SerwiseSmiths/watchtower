'use client';

import { useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { dmSans } from '../tickets/fonts';
import RootSidebar from '@/components/RootSidebar';
import {
  createDeviceTypeAction,
  updateDeviceTypeAction,
  deleteDeviceTypeAction,
  uploadDeviceTypeImageAction,
  type DeviceTypeInput,
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

export interface DeviceTypeRow {
  id: number;
  documentId: string;
  key: string;
  label: string;
  icon: MediaFile | null;
  buttonImage: MediaFile | null;
  service_parts: RelationOption[];
  subscription_addons: RelationOption[];
}

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
  key: string;
  label: string;
  icon: MediaFile | null;
  buttonImage: MediaFile | null;
  servicePartIds: number[];
  subscriptionAddonIds: number[];
}

const EMPTY_FORM: FormState = {
  key: '',
  label: '',
  icon: null,
  buttonImage: null,
  servicePartIds: [],
  subscriptionAddonIds: [],
};

function rowToForm(row: DeviceTypeRow): FormState {
  return {
    key: row.key,
    label: row.label,
    icon: row.icon,
    buttonImage: row.buttonImage,
    servicePartIds: row.service_parts.map((p) => p.id),
    subscriptionAddonIds: row.subscription_addons.map((a) => a.id),
  };
}

function ImageField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: MediaFile | null;
  onChange: (file: MediaFile | null) => void;
}) {
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
      const uploaded = await uploadDeviceTypeImageAction(formData);
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
        <div
          className="d-flex align-items-center justify-content-center"
          style={{ width: 56, height: 56, borderRadius: 6, background: '#EFEFEF', border: '1px solid #E5E5E5', overflow: 'hidden', flexShrink: 0 }}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value.url} alt={value.name ?? label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: 9, fontWeight: 600, color: '#B7B7B7' }}>None</span>
          )}
        </div>
        <div className="d-flex flex-column" style={{ gap: 4 }}>
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            style={{ background: '#181818', color: '#FFFFFF', border: 'none', borderRadius: 5, padding: '6px 12px', fontSize: 11, fontWeight: 600, opacity: uploading ? 0.6 : 1 }}
          >
            {uploading ? 'Uploading…' : value ? 'Change' : 'Upload'}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange(null)}
              style={{ background: 'transparent', border: 'none', color: '#B7B7B7', fontSize: 11, fontWeight: 600, padding: 0, textAlign: 'left' }}
            >
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

function RelationChecklist({
  label,
  options,
  selectedIds,
  onChange,
}: {
  label: string;
  options: RelationOption[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
}) {
  function toggle(id: number) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((v) => v !== id) : [...selectedIds, id]);
  }

  return (
    <div>
      <div style={fieldLabelStyle}>{label}</div>
      <div
        className="d-flex flex-column"
        style={{ maxHeight: 140, overflowY: 'auto', background: '#EFEFEF', border: '1px solid #E5E5E5', borderRadius: 6, padding: 8, gap: 4 }}
      >
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

export default function DeviceTypesView({
  deviceTypes,
  servicePartOptions,
  subscriptionAddonOptions,
}: {
  deviceTypes: DeviceTypeRow[];
  servicePartOptions: RelationOption[];
  subscriptionAddonOptions: RelationOption[];
}) {
  const router = useRouter();
  const labelStyle: CSSProperties = { fontSize: 10, fontWeight: 600, letterSpacing: '-0.03em', color: '#B7B7B7' };
  const cellStyle: CSSProperties = { fontSize: 12, fontWeight: 600, letterSpacing: '-0.03em', color: '#000000' };

  const [editingId, setEditingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  function openCreate() {
    setEditingId(null);
    setCreating(true);
    setForm(EMPTY_FORM);
    setError(null);
  }

  function openEdit(row: DeviceTypeRow) {
    setCreating(false);
    setEditingId(row.id);
    setForm(rowToForm(row));
    setError(null);
  }

  function closeForm() {
    setCreating(false);
    setEditingId(null);
    setError(null);
  }

  async function handleSave() {
    if (!form.key.trim() || !form.label.trim()) {
      setError('Key and label are required');
      return;
    }

    const input: DeviceTypeInput = {
      key: form.key.trim(),
      label: form.label.trim(),
      icon: form.icon?.id ?? null,
      buttonImage: form.buttonImage?.id ?? null,
      service_parts: form.servicePartIds,
      subscription_addons: form.subscriptionAddonIds,
    };

    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await updateDeviceTypeAction(editingId, input);
      } else {
        await createDeviceTypeAction(input);
      }
      router.refresh();
      closeForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save device type');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    setError(null);
    try {
      await deleteDeviceTypeAction(id);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete device type');
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
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', color: '#181818' }}>Device Types</h1>
          <button
            type="button"
            onClick={openCreate}
            style={{ background: '#181818', color: '#FFFFFF', borderRadius: 5, padding: '10px 16px', fontSize: 12, fontWeight: 500, letterSpacing: '-0.03em', border: 'none' }}
          >
            + Add
          </button>
        </div>

        {showForm && (
          <div
            onClick={closeForm}
            style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ width: 620, maxHeight: '90vh', overflowY: 'auto', background: '#FFFFFF', borderRadius: 10, padding: '20px 25px' }}
            >
              <div className="d-flex justify-content-between align-items-center mb-3">
                <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em', color: '#181818' }}>
                  {editingId ? 'Edit Device Type' : 'Add Device Type'}
                </span>
                <button type="button" onClick={closeForm} style={{ background: 'none', border: 'none', fontSize: 18, color: '#B7B7B7', lineHeight: 1 }}>
                  ×
                </button>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-6">
                  <div style={fieldLabelStyle}>Key</div>
                  <input type="text" value={form.key} onChange={(e) => setForm((p) => ({ ...p, key: e.target.value }))} style={inputStyle} placeholder="master_purifier" />
                </div>
                <div className="col-6">
                  <div style={fieldLabelStyle}>Label</div>
                  <input type="text" value={form.label} onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))} style={inputStyle} placeholder="Master Purifier" />
                </div>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-6">
                  <ImageField label="Icon" value={form.icon} onChange={(icon) => setForm((p) => ({ ...p, icon }))} />
                </div>
                <div className="col-6">
                  <ImageField label="Button Image" value={form.buttonImage} onChange={(buttonImage) => setForm((p) => ({ ...p, buttonImage }))} />
                </div>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-6">
                  <RelationChecklist
                    label="Linked Service Parts"
                    options={servicePartOptions}
                    selectedIds={form.servicePartIds}
                    onChange={(servicePartIds) => setForm((p) => ({ ...p, servicePartIds }))}
                  />
                </div>
                <div className="col-6">
                  <RelationChecklist
                    label="Linked Subscription Addons"
                    options={subscriptionAddonOptions}
                    selectedIds={form.subscriptionAddonIds}
                    onChange={(subscriptionAddonIds) => setForm((p) => ({ ...p, subscriptionAddonIds }))}
                  />
                </div>
              </div>

              {error && (
                <div className="mb-3" style={{ color: '#E53935', fontSize: 12, fontWeight: 600 }}>
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="w-100"
                style={{ background: '#181818', color: '#FFFFFF', border: 'none', borderRadius: 6, padding: '13px', fontSize: 14, fontWeight: 600, letterSpacing: '-0.03em', opacity: saving ? 0.6 : 1 }}
              >
                {saving ? 'Saving…' : 'Save & Continue'}
              </button>
            </div>
          </div>
        )}

        <div style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 5, overflow: 'hidden' }}>
          <div className="d-flex align-items-center" style={{ padding: '0 13px', height: 35, borderBottom: '1px solid #E5E5E5' }}>
            <div style={{ width: 60, ...labelStyle }}>Icon</div>
            <div style={{ width: 160, ...labelStyle }}>Key</div>
            <div style={{ width: 200, ...labelStyle }}>Label</div>
            <div style={{ width: 140, ...labelStyle }}>Linked Parts</div>
            <div style={{ width: 160, ...labelStyle }}>Linked Addons</div>
            <div style={{ width: 140, ...labelStyle }}>Actions</div>
          </div>

          {deviceTypes.length === 0 && (
            <div className="d-flex align-items-center justify-content-center" style={{ height: 80, ...labelStyle }}>
              No device types yet.
            </div>
          )}

          {deviceTypes.map((row, i) => (
            <div
              key={row.id}
              className="d-flex align-items-center"
              style={{ padding: '0 13px', height: 48, borderBottom: i === deviceTypes.length - 1 ? 'none' : '1px solid #E5E5E5', cursor: 'pointer' }}
              onClick={() => openEdit(row)}
            >
              <div style={{ width: 60 }}>
                <div style={{ width: 32, height: 32, borderRadius: 5, background: '#EFEFEF', overflow: 'hidden' }}>
                  {row.icon && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={row.icon.url} alt={row.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
                </div>
              </div>
              <div style={{ width: 160, ...cellStyle }}>{row.key}</div>
              <div style={{ width: 200, ...cellStyle }}>{row.label}</div>
              <div style={{ width: 140, ...cellStyle }}>{row.service_parts.length}</div>
              <div style={{ width: 160, ...cellStyle }}>{row.subscription_addons.length}</div>
              <div style={{ width: 140 }} onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => handleDelete(row.id)}
                  disabled={deletingId === row.id}
                  style={{
                    background: '#FF5E5E',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: 5,
                    padding: '6px 14px',
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '-0.03em',
                    opacity: deletingId === row.id ? 0.6 : 1,
                  }}
                >
                  {deletingId === row.id ? 'Deleting…' : 'Delete'}
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

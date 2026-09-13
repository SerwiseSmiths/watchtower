'use client';

import { useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { dmSans } from '../tickets/fonts';
import RootSidebar from '@/components/RootSidebar';
import type { DeviceTypeKey } from '@/lib/nexus/providers';
import type { NexusDeviceTypeGroup, DeviceTypeGroupInput } from '@/lib/nexus/deviceTypeGroups';
import { SKILL_LABELS, SKILL_ORDER } from '../providers/skillIcons';
import { createDeviceTypeGroupAction, updateDeviceTypeGroupAction, deleteDeviceTypeGroupAction } from './actions';

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
  deviceTypes: DeviceTypeKey[];
}

const EMPTY_FORM: FormState = { name: '', deviceTypes: [] };

function groupToForm(group: NexusDeviceTypeGroup): FormState {
  return { name: group.name, deviceTypes: group.deviceTypes };
}

export default function DeviceTypeGroupsView({ groups }: { groups: NexusDeviceTypeGroup[] }) {
  const router = useRouter();
  const labelStyle: CSSProperties = { fontSize: 10, fontWeight: 600, letterSpacing: '-0.03em', color: '#B7B7B7' };
  const cellStyle: CSSProperties = { fontSize: 12, fontWeight: 600, letterSpacing: '-0.03em', color: '#000000' };

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  function openCreate() {
    setEditingKey(null);
    setCreating(true);
    setForm(EMPTY_FORM);
    setError(null);
  }

  function openEdit(group: NexusDeviceTypeGroup) {
    setCreating(false);
    setEditingKey(group.key);
    setForm(groupToForm(group));
    setError(null);
  }

  function closeForm() {
    setCreating(false);
    setEditingKey(null);
    setError(null);
  }

  function toggleDeviceType(type: DeviceTypeKey) {
    setForm((prev) => ({
      ...prev,
      deviceTypes: prev.deviceTypes.includes(type)
        ? prev.deviceTypes.filter((t) => t !== type)
        : [...prev.deviceTypes, type],
    }));
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    if (form.deviceTypes.length === 0) {
      setError('Select at least one device type');
      return;
    }

    const input: DeviceTypeGroupInput = { name: form.name, deviceTypes: form.deviceTypes };

    setSaving(true);
    setError(null);
    try {
      if (editingKey) {
        await updateDeviceTypeGroupAction(editingKey, input);
      } else {
        await createDeviceTypeGroupAction(input);
      }
      router.refresh();
      closeForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save device type group');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(key: string) {
    setDeletingKey(key);
    setError(null);
    try {
      await deleteDeviceTypeGroupAction(key);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete device type group');
    } finally {
      setDeletingKey(null);
    }
  }

  const showForm = creating || editingKey !== null;

  return (
    <div className={dmSans.className} style={{ minHeight: '100vh', background: '#F2F2F2', display: 'flex' }}>
      <RootSidebar />

      <main className="flex-grow-1" style={{ padding: '44px 40px' }}>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', color: '#181818' }}>Device Type Groups</h1>
            <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: '-0.03em', color: '#B7B7B7', marginTop: 2 }}>
              Device types serviced together by one provider. Every device type must belong to exactly one group.
            </div>
          </div>
          <button
            type="button"
            onClick={openCreate}
            style={{ background: '#181818', color: '#FFFFFF', borderRadius: 5, padding: '10px 16px', fontSize: 12, fontWeight: 500, letterSpacing: '-0.03em', border: 'none' }}
          >
            + Add Group
          </button>
        </div>

        {showForm && (
          <div
            onClick={closeForm}
            style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ width: 480, maxHeight: '90vh', overflowY: 'auto', background: '#FFFFFF', borderRadius: 10, padding: '20px 25px' }}
            >
              <div className="d-flex justify-content-between align-items-center mb-3">
                <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em', color: '#181818' }}>
                  {editingKey ? 'Edit Device Type Group' : 'Add Device Type Group'}
                </span>
                <button type="button" onClick={closeForm} style={{ background: 'none', border: 'none', fontSize: 18, color: '#B7B7B7', lineHeight: 1 }}>
                  ×
                </button>
              </div>

              <div className="mb-3">
                <div style={fieldLabelStyle}>Name</div>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  style={inputStyle}
                  placeholder="e.g. AC + Fridge"
                />
              </div>

              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span style={fieldLabelStyle}>Device Types</span>
                  <span style={fieldLabelStyle}>{form.deviceTypes.length} Selected</span>
                </div>
                <div className="d-flex flex-column" style={{ gap: 6 }}>
                  {SKILL_ORDER.map((type) => {
                    const selected = form.deviceTypes.includes(type);
                    return (
                      <div
                        key={type}
                        className="d-flex justify-content-between align-items-center"
                        style={{ background: '#EFEFEF', border: '1px solid #E5E5E5', borderRadius: 6, padding: '9px 11px' }}
                      >
                        <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.03em', color: '#000' }}>
                          {SKILL_LABELS[type]}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleDeviceType(type)}
                          style={{
                            border: `1px solid ${selected ? '#000' : '#454545'}`,
                            background: selected ? '#000' : 'transparent',
                            color: selected ? '#FFF' : '#454545',
                            borderRadius: 52,
                            padding: '5px 10px',
                            fontSize: 12,
                            fontWeight: 600,
                            letterSpacing: '-0.03em',
                          }}
                        >
                          {selected ? 'Selected' : 'Select'}
                        </button>
                      </div>
                    );
                  })}
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
            <div style={{ width: 220, ...labelStyle }}>Name</div>
            <div style={{ width: 420, ...labelStyle }}>Device Types</div>
            <div style={{ width: 140, ...labelStyle }}>Actions</div>
          </div>

          {groups.length === 0 && (
            <div className="d-flex align-items-center justify-content-center" style={{ height: 80, ...labelStyle }}>
              No device type groups yet.
            </div>
          )}

          {groups.map((group, i) => (
            <div
              key={group.key}
              className="d-flex align-items-center"
              style={{ padding: '0 13px', height: 40, borderBottom: i === groups.length - 1 ? 'none' : '1px solid #E5E5E5', cursor: 'pointer' }}
              onClick={() => openEdit(group)}
            >
              <div style={{ width: 220, ...cellStyle }}>{group.name}</div>
              <div style={{ width: 420, ...cellStyle, fontWeight: 400, color: '#454545' }}>
                {group.deviceTypes.map((t) => SKILL_LABELS[t]).join(', ')}
              </div>
              <div style={{ width: 140 }} onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => handleDelete(group.key)}
                  disabled={deletingKey === group.key}
                  style={{
                    background: '#FF5E5E',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: 5,
                    padding: '6px 14px',
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '-0.03em',
                    opacity: deletingKey === group.key ? 0.6 : 1,
                  }}
                >
                  {deletingKey === group.key ? 'Deleting…' : 'Delete'}
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

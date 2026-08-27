'use client';

import { useState, type CSSProperties } from 'react';
import { createCustomerAction } from './actions';
import type { CreateCustomerInput } from '@/lib/nexus/customers';

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

const EMPTY_FORM: CreateCustomerInput = { firstName: '', lastName: '', phoneNo: '', email: '' };

export default function AddCustomerModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState<CreateCustomerInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.phoneNo.trim()) {
      setError('First name, last name, and phone number are required');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await createCustomerAction({ ...form, email: form.email || undefined });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create customer');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 420, background: '#FFFFFF', borderRadius: 10, padding: '20px 25px' }}>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em', color: '#181818' }}>Add Customer</span>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 18, color: '#B7B7B7', lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        <div className="d-flex flex-column" style={{ gap: 12 }}>
          <div>
            <div style={fieldLabelStyle}>First Name</div>
            <input
              type="text"
              value={form.firstName}
              onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
              style={inputStyle}
            />
          </div>
          <div>
            <div style={fieldLabelStyle}>Last Name</div>
            <input
              type="text"
              value={form.lastName}
              onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
              style={inputStyle}
            />
          </div>
          <div>
            <div style={fieldLabelStyle}>Phone No.</div>
            <input
              type="tel"
              value={form.phoneNo}
              onChange={(e) => setForm((p) => ({ ...p, phoneNo: e.target.value }))}
              placeholder="(91) 98241 57811"
              style={inputStyle}
            />
          </div>
          <div>
            <div style={fieldLabelStyle}>Mail ID (Optional)</div>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              placeholder="johndo@gmail.com"
              style={inputStyle}
            />
          </div>
        </div>

        {error && (
          <div className="mt-3" style={{ color: '#E53935', fontSize: 12, fontWeight: 600 }}>
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-100 mt-4"
          style={{
            background: '#181818',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: 6,
            padding: '13px',
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: '-0.03em',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? 'Saving…' : 'Save & Continue'}
        </button>
      </div>
    </div>
  );
}

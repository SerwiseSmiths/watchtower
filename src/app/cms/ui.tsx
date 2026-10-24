'use client';

import { useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import { uploadCmsImageAction } from './actions';

// ─── Shared primitives for the /cms tabs (same conventions as pricing/PricingView.tsx, device-types) ────

export interface MediaFile {
  id: number;
  url: string;
  name?: string | null;
}

export const inputStyle: CSSProperties = {
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
export const fieldLabelStyle: CSSProperties = { fontSize: 12, fontWeight: 600, letterSpacing: '-0.03em', color: '#454545', marginBottom: 4 };
export const labelStyle: CSSProperties = { fontSize: 10, fontWeight: 600, letterSpacing: '-0.03em', color: '#B7B7B7' };
export const cellStyle: CSSProperties = { fontSize: 12, fontWeight: 600, letterSpacing: '-0.03em', color: '#000000' };

export function ctaButtonStyle(color: string): CSSProperties {
  return { background: color, color: '#FFFFFF', border: 'none', borderRadius: 5, padding: '6px 14px', fontSize: 11, fontWeight: 600, letterSpacing: '-0.03em' };
}

export function ImageField({ label, value, onChange }: { label: string; value: MediaFile | null; onChange: (file: MediaFile | null) => void }) {
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
      const uploaded = await uploadCmsImageAction(formData);
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

export function SaveButton({ saving, onClick, label = 'Save' }: { saving: boolean; onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={saving} className="w-100" style={{ background: '#181818', color: '#FFFFFF', border: 'none', borderRadius: 6, padding: '13px', fontSize: 14, fontWeight: 600, letterSpacing: '-0.03em', opacity: saving ? 0.6 : 1 }}>
      {saving ? 'Saving…' : label}
    </button>
  );
}

export function RepeaterHeader({ label, onAdd, addLabel }: { label: string; onAdd: () => void; addLabel: string }) {
  return (
    <div className="d-flex justify-content-between align-items-center mb-2">
      <span style={fieldLabelStyle}>{label}</span>
      <button type="button" onClick={onAdd} style={{ background: '#EFEFEF', border: '1px solid #E5E5E5', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, color: '#181818' }}>
        {addLabel}
      </button>
    </div>
  );
}

export function RemoveRowButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{ background: 'transparent', border: 'none', color: '#E53935', fontSize: 12, fontWeight: 600 }}>
      Remove
    </button>
  );
}

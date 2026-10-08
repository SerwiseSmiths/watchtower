'use client';

import type { CSSProperties } from 'react';
import { DEVICE_KEYS, type DeviceKey } from '@/lib/nexus/devices';
import { DEVICE_FORM_FIELDS, type FieldDef } from './deviceFormConfig';
import { formatDate, type TicketDevice } from './mapComplaint';

const labelStyle: CSSProperties = { fontSize: 10, fontWeight: 600, letterSpacing: '-0.03em', color: '#B7B7B7' };
const valueStyle: CSSProperties = { fontSize: 12, fontWeight: 600, letterSpacing: '-0.03em', color: '#000000', wordBreak: 'break-word' };

/** `SPLIT_UNIT` → `Split Unit`, `coolingCapacityTon` → `Cooling Capacity Ton`. */
function humanize(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

function formatValue(field: FieldDef | null, value: unknown): string {
  if (field?.kind === 'checkboxGroup') {
    const picked = field.options.filter((o) => (value as Record<string, boolean> | null)?.[o.key]).map((o) => o.label);
    return picked.length ? picked.join(', ') : 'None';
  }
  if (field?.kind === 'date' && typeof value === 'string' && !Number.isNaN(Date.parse(value))) return formatDate(value);
  if (field?.kind === 'select' && typeof value === 'string') return humanize(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** Read-only spec sheet for a ticket's linked appliance. Known fields render in the same order
 *  and with the same labels as the Add Appliance form; anything else in metadata (e.g. fields
 *  written by serwise/radix that the form doesn't know about) is still shown, humanized. */
export default function DeviceDetails({ device }: { device: TicketDevice }) {
  const fields = DEVICE_KEYS.includes(device.deviceKey as DeviceKey) ? DEVICE_FORM_FIELDS[device.deviceKey as DeviceKey] : [];
  const known = new Set(fields.map((f) => f.name));

  const rows: { label: string; value: string }[] = [
    ...fields
      .filter((f) => f.kind === 'checkboxGroup' || !isEmpty(device.metadata[f.name]))
      .map((f) => ({ label: f.label, value: formatValue(f, device.metadata[f.name]) })),
    ...Object.entries(device.metadata)
      .filter(([key, value]) => !known.has(key) && !isEmpty(value))
      .map(([key, value]) => ({ label: humanize(key), value: formatValue(null, value) })),
  ];

  return (
    <div className="d-flex" style={{ gap: 16, padding: '14px 13px 16px 39px', background: '#FAFAFA', borderBottom: '1px solid #E5E5E5' }}>
      {device.imageUrl && (
        <a href={device.imageUrl} target="_blank" rel="noreferrer" style={{ flexShrink: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- remote Cloudinary URL, no next/image config for it */}
          <img
            src={device.imageUrl}
            alt="Appliance"
            style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 6, border: '1px solid #E5E5E5', display: 'block' }}
          />
        </a>
      )}

      {rows.length > 0 ? (
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px 20px' }}>
          {rows.map((row) => (
            <div key={row.label}>
              <div style={labelStyle}>{row.label}</div>
              <div style={valueStyle}>{row.value}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ ...labelStyle, alignSelf: 'center' }}>No details recorded for this appliance.</div>
      )}
    </div>
  );
}

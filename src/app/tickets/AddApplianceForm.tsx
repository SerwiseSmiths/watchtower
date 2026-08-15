'use client';

import { useEffect, useState, useTransition, type CSSProperties } from 'react';
import type { Ticket } from './mapComplaint';
import { formatDeviceType } from './mapComplaint';
import { addAppliance, fetchCustomerDevices, linkExistingAppliance } from './actions';
import { type DeviceKey, type NexusDeviceSummary } from '@/lib/nexus/devices';
import { DEVICE_TYPE_LABELS, DEVICE_FORM_FIELDS, resolveRequestedDeviceKeys, type FieldDef } from './deviceFormConfig';

type Step = 'type' | 'existing' | 'form';
type FormValues = Record<string, unknown>;

function initialValuesFor(fields: FieldDef[]): FormValues {
  const values: FormValues = {};
  for (const field of fields) {
    if (field.kind === 'checkboxGroup') {
      const group: Record<string, boolean> = {};
      for (const option of field.options) group[option.key] = false;
      values[field.name] = group;
    }
  }
  return values;
}

function buildMetadata(fields: FieldDef[], values: FormValues): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};
  for (const field of fields) {
    const raw = values[field.name];
    if (field.kind === 'number') {
      if (raw === '' || raw === undefined || raw === null) continue;
      metadata[field.name] = Number(raw);
    } else if (field.kind === 'checkboxGroup') {
      metadata[field.name] = raw ?? {};
    } else {
      if (raw === '' || raw === undefined || raw === null) continue;
      metadata[field.name] = raw;
    }
  }
  return metadata;
}

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

function Field({ field, value, onChange }: { field: FieldDef; value: unknown; onChange: (value: unknown) => void }) {
  if (field.kind === 'checkboxGroup') {
    const group = (value as Record<string, boolean>) ?? {};
    return (
      <div style={{ gridColumn: '1 / -1' }}>
        <span style={labelStyle}>{field.label}</span>
        <div className="d-flex flex-wrap" style={{ gap: 10 }}>
          {field.options.map((option) => (
            <label key={option.key} className="d-flex align-items-center" style={{ gap: 5, fontSize: 11, color: '#181818' }}>
              <input
                type="checkbox"
                checked={Boolean(group[option.key])}
                onChange={(e) => onChange({ ...group, [option.key]: e.target.checked })}
              />
              {option.label}
            </label>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <span style={labelStyle}>
        {field.label}
        {'required' in field && field.required ? ' *' : ''}
      </span>
      {field.kind === 'select' ? (
        <select style={inputStyle} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)}>
          <option value="" disabled>
            Select…
          </option>
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          style={inputStyle}
          type={field.kind === 'number' ? 'number' : field.kind === 'date' ? 'date' : 'text'}
          min={field.kind === 'number' ? field.min : undefined}
          max={field.kind === 'number' ? field.max : undefined}
          step={field.kind === 'number' ? (field.step ?? 'any') : undefined}
          value={(value as string | number) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

export default function AddApplianceForm({ ticket, onCancel, onDone }: { ticket: Ticket; onCancel: () => void; onDone: () => void }) {
  const [step, setStep] = useState<Step>('type');
  const [deviceKey, setDeviceKey] = useState<DeviceKey | null>(null);
  const [existingDevices, setExistingDevices] = useState<NexusDeviceSummary[] | null>(null);
  const [values, setValues] = useState<FormValues>({});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const availableTypes = resolveRequestedDeviceKeys(ticket.title).filter((key) => key !== ticket.device?.deviceKey);

  useEffect(() => {
    if (step !== 'existing' || !deviceKey) return;
    let cancelled = false;
    setExistingDevices(null);
    fetchCustomerDevices(ticket.customerId, deviceKey).then((devices) => {
      if (!cancelled) setExistingDevices(devices);
    });
    return () => {
      cancelled = true;
    };
  }, [step, deviceKey, ticket.customerId]);

  function selectType(key: DeviceKey) {
    setDeviceKey(key);
    setError(null);
    setStep('existing');
  }

  function startNewDeviceForm() {
    if (!deviceKey) return;
    setValues(initialValuesFor(DEVICE_FORM_FIELDS[deviceKey]));
    setError(null);
    setStep('form');
  }

  function linkExisting(device: NexusDeviceSummary) {
    setError(null);
    startTransition(async () => {
      try {
        await linkExistingAppliance(ticket.complaintId, device.id, device.deviceKey);
        onDone();
      } catch {
        setError('Failed to link appliance — please try again.');
      }
    });
  }

  function submitNewDevice() {
    if (!deviceKey) return;
    const fields = DEVICE_FORM_FIELDS[deviceKey];
    const missing = fields.find((f) => f.kind !== 'checkboxGroup' && 'required' in f && f.required && !values[f.name]);
    if (missing) {
      setError(`${missing.label} is required`);
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        await addAppliance({
          complaintId: ticket.complaintId,
          customerId: ticket.customerId,
          addressId: ticket.address?.id ?? null,
          deviceKey,
          metadata: buildMetadata(fields, values),
        });
        onDone();
      } catch {
        setError('Failed to add appliance — please try again.');
      }
    });
  }

  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 5, padding: 16 }}>
      {step === 'type' && (
        <>
          <div className="mb-3" style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.03em', color: '#000000' }}>
            Select Appliance Type
          </div>
          <div className="d-flex flex-wrap" style={{ gap: 10 }}>
            {availableTypes.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => selectType(key)}
                style={{ background: '#F2F2F2', border: '1px solid #E5E5E5', borderRadius: 6, padding: '10px 16px', fontSize: 12, fontWeight: 600, color: '#181818' }}
              >
                {DEVICE_TYPE_LABELS[key]}
              </button>
            ))}
            {availableTypes.length === 0 && (
              <div style={{ ...labelStyle, marginBottom: 0 }}>All appliance types requested on this ticket have already been added.</div>
            )}
          </div>
          <button type="button" onClick={onCancel} className="mt-3" style={linkButtonStyle}>
            Cancel
          </button>
        </>
      )}

      {step === 'existing' && deviceKey && (
        <>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.03em', color: '#000000' }}>
              {DEVICE_TYPE_LABELS[deviceKey]} — Customer's Devices
            </span>
            <button type="button" onClick={() => setStep('type')} style={linkButtonStyle}>
              Change Type
            </button>
          </div>

          {existingDevices === null && <div style={labelStyle}>Loading…</div>}

          {existingDevices !== null && existingDevices.length === 0 && (
            <div style={{ ...labelStyle, marginBottom: 12 }}>No existing {DEVICE_TYPE_LABELS[deviceKey].toLowerCase()} found for this customer.</div>
          )}

          {existingDevices !== null && existingDevices.length > 0 && (
            <div className="d-flex flex-column mb-3" style={{ gap: 8 }}>
              {existingDevices.map((device) => {
                const company = typeof device.metadata.company === 'string' ? device.metadata.company : formatDeviceType(device.type);
                const purchaseDate = typeof device.metadata.purchaseDate === 'string' ? device.metadata.purchaseDate : null;
                return (
                  <div
                    key={device.id}
                    className="d-flex align-items-center justify-content-between"
                    style={{ background: '#F2F2F2', borderRadius: 6, padding: '8px 12px' }}
                  >
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#181818' }}>{company}</div>
                      <div style={{ fontSize: 10, color: '#B7B7B7' }}>
                        {[device.address?.title ?? device.address?.societyName, purchaseDate].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => linkExisting(device)}
                      style={{ background: '#181818', color: '#FFFFFF', border: 'none', borderRadius: 5, padding: '6px 14px', fontSize: 11, fontWeight: 600 }}
                    >
                      Add Device
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {error && (
            <div className="mb-3" style={{ fontSize: 11, color: '#FF5E5E', fontWeight: 600 }}>
              {error}
            </div>
          )}

          <div className="d-flex align-items-center" style={{ gap: 10 }}>
            <button
              type="button"
              onClick={startNewDeviceForm}
              style={{ background: '#E5E5E5', color: '#181818', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 12, fontWeight: 600 }}
            >
              + Register New {DEVICE_TYPE_LABELS[deviceKey]}
            </button>
            <button type="button" onClick={onCancel} style={linkButtonStyle}>
              Cancel
            </button>
          </div>
        </>
      )}

      {step === 'form' && deviceKey && (
        <>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.03em', color: '#000000' }}>
              New {DEVICE_TYPE_LABELS[deviceKey]} Details
            </span>
            <button type="button" onClick={() => setStep('existing')} style={linkButtonStyle}>
              Back
            </button>
          </div>

          <div className="d-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {DEVICE_FORM_FIELDS[deviceKey].map((field) => (
              <Field
                key={field.name}
                field={field}
                value={values[field.name]}
                onChange={(value) => setValues((prev) => ({ ...prev, [field.name]: value }))}
              />
            ))}
          </div>

          {error && (
            <div className="mt-3" style={{ fontSize: 11, color: '#FF5E5E', fontWeight: 600 }}>
              {error}
            </div>
          )}

          <div className="d-flex align-items-center mt-3" style={{ gap: 10 }}>
            <button
              type="button"
              disabled={isPending}
              onClick={submitNewDevice}
              style={{ background: '#181818', color: '#FFFFFF', border: 'none', borderRadius: 6, padding: '8px 20px', fontSize: 12, fontWeight: 600 }}
            >
              {isPending ? 'Saving…' : 'Save Appliance'}
            </button>
            <button type="button" onClick={onCancel} style={linkButtonStyle}>
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}

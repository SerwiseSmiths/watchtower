'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { searchCustomers, fetchCustomerDetail, fetchCustomerDevices, createTicketAction } from './actions';
import { DEVICE_KEYS, type DeviceKey, type NexusDeviceSummary } from '@/lib/nexus/devices';
import { DEVICE_TYPE_LABELS } from './deviceFormConfig';
import type { NexusCustomerListItem, NexusCustomerDetail } from '@/lib/nexus/customers';

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

function customerName(customer: NexusCustomerListItem): string {
  return [customer.firstName, customer.lastName].filter(Boolean).join(' ') || customer.phoneNo;
}

export default function AddTicketModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState<NexusCustomerListItem[] | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<NexusCustomerListItem | null>(null);
  const [customerDetail, setCustomerDetail] = useState<NexusCustomerDetail | null>(null);

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [addressId, setAddressId] = useState('');
  const [deviceKey, setDeviceKey] = useState<DeviceKey | ''>('');
  const [existingDevices, setExistingDevices] = useState<NexusDeviceSummary[] | null>(null);
  const [deviceId, setDeviceId] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedCustomer) return;
    const id = setTimeout(() => {
      searchCustomers(customerQuery || undefined).then(setCustomerResults);
    }, 200);
    return () => clearTimeout(id);
  }, [customerQuery, selectedCustomer]);

  function selectCustomer(customer: NexusCustomerListItem) {
    setSelectedCustomer(customer);
    setCustomerResults(null);
    setAddressId('');
    setCustomerDetail(null);
    fetchCustomerDetail(customer.id).then(setCustomerDetail);
  }

  function clearCustomer() {
    setSelectedCustomer(null);
    setCustomerDetail(null);
    setAddressId('');
  }

  useEffect(() => {
    setDeviceId('');
    if (!deviceKey || !selectedCustomer) {
      setExistingDevices(null);
      return;
    }
    setExistingDevices(null);
    fetchCustomerDevices(selectedCustomer.id, deviceKey).then(setExistingDevices);
  }, [deviceKey, selectedCustomer]);

  const activeAddresses = customerDetail?.addresses.filter((a) => !a.isDeleted) ?? [];

  async function handleSave() {
    if (!selectedCustomer) {
      setError('Select a customer');
      return;
    }
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (!addressId) {
      setError('Select an address');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await createTicketAction({
        customerId: selectedCustomer.id,
        title,
        notes: notes || undefined,
        addressId,
        deviceKey: deviceKey || undefined,
        deviceId: deviceId || undefined,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create ticket');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 460, maxHeight: '90vh', overflowY: 'auto', background: '#FFFFFF', borderRadius: 10, padding: '20px 25px' }}>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em', color: '#181818' }}>Add Ticket</span>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: '#B7B7B7', lineHeight: 1 }}>
            ×
          </button>
        </div>

        <div className="d-flex flex-column" style={{ gap: 12 }}>
          <div>
            <div style={fieldLabelStyle}>Customer</div>
            {selectedCustomer ? (
              <div className="d-flex align-items-center justify-content-between" style={{ ...inputStyle, display: 'flex' }}>
                <span>{customerName(selectedCustomer)} — {selectedCustomer.phoneNo}</span>
                <button type="button" onClick={clearCustomer} style={{ background: 'none', border: 'none', fontSize: 12, color: '#B7B7B7', fontWeight: 600 }}>
                  Change
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={customerQuery}
                  onChange={(e) => setCustomerQuery(e.target.value)}
                  placeholder="Search by name or phone number"
                  style={inputStyle}
                />
                {customerResults && (
                  <div className="d-flex flex-column mt-1" style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid #E5E5E5', borderRadius: 6 }}>
                    {customerResults.length === 0 && (
                      <div style={{ padding: 10, fontSize: 12, color: '#B7B7B7' }}>No customers found.</div>
                    )}
                    {customerResults.map((customer) => (
                      <button
                        key={customer.id}
                        type="button"
                        onClick={() => selectCustomer(customer)}
                        className="d-flex flex-column"
                        style={{ background: 'none', border: 'none', textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #F2F2F2' }}
                      >
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#000' }}>{customerName(customer)}</span>
                        <span style={{ fontSize: 10, color: '#B7B7B7' }}>{customer.phoneNo}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {selectedCustomer && (
            <div>
              <div style={fieldLabelStyle}>Address</div>
              <select value={addressId} onChange={(e) => setAddressId(e.target.value)} style={inputStyle}>
                <option value="">{customerDetail ? 'Select address…' : 'Loading…'}</option>
                {activeAddresses.map((address) => (
                  <option key={address.id} value={address.id}>
                    {address.title || 'Address'} — {address.houseNo}, {address.societyName}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <div style={fieldLabelStyle}>Title</div>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. RO not producing water" style={inputStyle} />
          </div>

          <div>
            <div style={fieldLabelStyle}>Notes (Optional)</div>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'none' }} />
          </div>

          <div>
            <div style={fieldLabelStyle}>Appliance Type (Optional)</div>
            <select value={deviceKey} onChange={(e) => setDeviceKey(e.target.value as DeviceKey | '')} style={inputStyle}>
              <option value="">None</option>
              {DEVICE_KEYS.map((key) => (
                <option key={key} value={key}>{DEVICE_TYPE_LABELS[key]}</option>
              ))}
            </select>
          </div>

          {deviceKey && selectedCustomer && (
            <div>
              <div style={fieldLabelStyle}>Existing Appliance (Optional)</div>
              <select value={deviceId} onChange={(e) => setDeviceId(e.target.value)} style={inputStyle}>
                <option value="">{existingDevices === null ? 'Loading…' : 'None'}</option>
                {existingDevices?.map((device) => {
                  const company = typeof device.metadata.company === 'string' ? device.metadata.company : DEVICE_TYPE_LABELS[deviceKey];
                  return (
                    <option key={device.id} value={device.id}>
                      {company} — {device.address?.title ?? device.address?.societyName ?? 'No address'}
                    </option>
                  );
                })}
              </select>
            </div>
          )}
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

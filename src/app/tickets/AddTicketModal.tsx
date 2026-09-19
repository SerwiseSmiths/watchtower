'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { searchCustomers, fetchCustomerDetail, createTicketAction } from './actions';
import { createAddressAction } from '../customers/[id]/actions';
import AddressMapModal from '../customers/[id]/AddressMapModal';
import { DEVICE_KEYS, type DeviceKey } from '@/lib/nexus/devices';
import { DEVICE_TYPE_LABELS } from './deviceFormConfig';
import type { NexusCustomerListItem, NexusCustomerDetail, CustomerAddressInput } from '@/lib/nexus/customers';
import type { NexusRequestedDevice } from '@/lib/nexus/complaints';

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

// Quantity per device type, keyed the same way DEVICE_KEYS is ordered — 0 means
// "not requested". Devices don't need to pre-exist: nexus creates the physical
// Device rows later, once a provider identifies them on-site.
type Quantities = Record<DeviceKey, number>;
const EMPTY_QUANTITIES: Quantities = Object.fromEntries(DEVICE_KEYS.map((k) => [k, 0])) as Quantities;

export default function AddTicketModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState<NexusCustomerListItem[] | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<NexusCustomerListItem | null>(null);
  const [customerDetail, setCustomerDetail] = useState<NexusCustomerDetail | null>(null);

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [addressId, setAddressId] = useState('');
  const [quantities, setQuantities] = useState<Quantities>(EMPTY_QUANTITIES);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showAddAddress, setShowAddAddress] = useState(false);
  const [addingAddress, setAddingAddress] = useState(false);

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

  function setQuantity(key: DeviceKey, qty: number) {
    setQuantities((prev) => ({ ...prev, [key]: Math.max(0, qty) }));
  }

  async function handleSaveNewAddress(input: CustomerAddressInput) {
    if (!selectedCustomer) return;
    setAddingAddress(true);
    try {
      const address = await createAddressAction(selectedCustomer.id, input);
      setCustomerDetail((prev) => (prev ? { ...prev, addresses: [...prev.addresses, address] } : prev));
      setAddressId(address.id);
      setShowAddAddress(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add address');
    } finally {
      setAddingAddress(false);
    }
  }

  const activeAddresses = customerDetail?.addresses.filter((a) => !a.isDeleted) ?? [];
  const requestedDevices: NexusRequestedDevice[] = DEVICE_KEYS.filter((key) => quantities[key] > 0).map((key) => ({
    deviceKey: key,
    quantity: quantities[key],
  }));

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
    if (requestedDevices.length === 0) {
      setError('Select at least one appliance and quantity');
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
        requestedDevices,
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
              <div className="d-flex justify-content-between align-items-center" style={{ marginBottom: 4 }}>
                <div style={{ ...fieldLabelStyle, marginBottom: 0 }}>Address</div>
                <button
                  type="button"
                  onClick={() => setShowAddAddress(true)}
                  style={{ background: 'none', border: 'none', fontSize: 12, fontWeight: 600, color: '#181818' }}
                >
                  + Add New Address
                </button>
              </div>
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
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span style={fieldLabelStyle}>Appliances &amp; Quantity</span>
              <span style={fieldLabelStyle}>{requestedDevices.length} Selected</span>
            </div>
            <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: '-0.03em', color: '#B7B7B7', marginBottom: 8 }}>
              Devices requested in different device-type groups are created as separate tickets.
            </div>
            <div className="d-flex flex-column" style={{ gap: 6 }}>
              {DEVICE_KEYS.map((key) => {
                const qty = quantities[key];
                return (
                  <div
                    key={key}
                    className="d-flex justify-content-between align-items-center"
                    style={{ background: '#EFEFEF', border: '1px solid #E5E5E5', borderRadius: 6, padding: '9px 11px' }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.03em', color: '#000' }}>
                      {DEVICE_TYPE_LABELS[key]}
                    </span>
                    <div className="d-flex align-items-center" style={{ gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => setQuantity(key, qty - 1)}
                        disabled={qty === 0}
                        style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid #B7B7B7', background: '#FFF', fontSize: 14, fontWeight: 700, opacity: qty === 0 ? 0.4 : 1 }}
                      >
                        −
                      </button>
                      <span style={{ width: 16, textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#181818' }}>{qty}</span>
                      <button
                        type="button"
                        onClick={() => setQuantity(key, qty + 1)}
                        style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid #B7B7B7', background: '#FFF', fontSize: 14, fontWeight: 700 }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
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

      {showAddAddress && (
        <AddressMapModal
          initial={{}}
          onSave={handleSaveNewAddress}
          onCancel={() => setShowAddAddress(false)}
          saving={addingAddress}
        />
      )}
    </div>
  );
}

'use client';

import { useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { dmSans } from '../../tickets/fonts';
import { formatDate, formatCurrency } from '../../providers/mapProvider';
import RootSidebar from '@/components/RootSidebar';
import type { NexusCustomerDetail, NexusCustomerAddress, CustomerAddressInput } from '@/lib/nexus/customers';
import {
  updateCustomerAction,
  createAddressAction,
  updateAddressAction,
  archiveAddressAction,
  restoreAddressAction,
} from './actions';
import AddressMapModal from './AddressMapModal';

type Tab = 'basic' | 'subscription' | 'wallet' | 'tickets';

const inputStyle: CSSProperties = {
  width: '100%',
  background: '#FFFFFF',
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

function initialsFor(firstName: string | null, lastName: string | null, fallback: string): string {
  const first = firstName?.trim()?.[0] ?? '';
  const last = lastName?.trim()?.[0] ?? '';
  return (first + last).toUpperCase() || fallback.slice(-2);
}

function addressLines(address: NexusCustomerAddress): { short: string; full: string } {
  const short = `${address.houseNo}, ${address.societyName}`;
  const full = [address.addressLineOne, address.addressLineTwo, address.area, address.city, address.state, address.pinCode]
    .filter(Boolean)
    .join(', ');
  return { short, full };
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        background: active ? '#FFFFFF' : 'transparent',
        border: 'none',
        borderRadius: 5,
        padding: '8px 0',
        fontSize: 10,
        fontWeight: 500,
        letterSpacing: '-0.03em',
        color: '#000000',
      }}
    >
      {label}
    </button>
  );
}

export default function CustomerDetailView({ customer }: { customer: NexusCustomerDetail }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('basic');

  const [firstName, setFirstName] = useState(customer.firstName ?? '');
  const [lastName, setLastName] = useState(customer.lastName ?? '');
  const [phoneNo, setPhoneNo] = useState(customer.phoneNo);
  const [email, setEmail] = useState(customer.email ?? '');
  const [savingBasic, setSavingBasic] = useState(false);
  const [basicError, setBasicError] = useState<string | null>(null);

  const [addingAddress, setAddingAddress] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [savingAddress, setSavingAddress] = useState(false);

  const name = [customer.firstName, customer.lastName].filter(Boolean).join(' ') || customer.phoneNo;
  const activeAddresses = customer.addresses.filter((a) => !a.isDeleted);
  const archivedAddresses = customer.addresses.filter((a) => a.isDeleted);

  async function saveBasicDetails() {
    setSavingBasic(true);
    setBasicError(null);
    try {
      await updateCustomerAction(customer.id, { firstName, lastName, phoneNo, email: email || undefined });
      router.refresh();
    } catch (err) {
      setBasicError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSavingBasic(false);
    }
  }

  async function handleSaveNewAddress(input: CustomerAddressInput) {
    setSavingAddress(true);
    try {
      await createAddressAction(customer.id, input);
      setAddingAddress(false);
      router.refresh();
    } finally {
      setSavingAddress(false);
    }
  }

  async function handleSaveEditedAddress(addressId: string, input: CustomerAddressInput) {
    setSavingAddress(true);
    try {
      await updateAddressAction(customer.id, addressId, input);
      setEditingAddressId(null);
      router.refresh();
    } finally {
      setSavingAddress(false);
    }
  }

  async function handleArchive(addressId: string) {
    await archiveAddressAction(customer.id, addressId);
    router.refresh();
  }

  async function handleRestore(addressId: string) {
    await restoreAddressAction(customer.id, addressId);
    router.refresh();
  }

  return (
    <div className={dmSans.className} style={{ minHeight: '100vh', background: '#F2F2F2', display: 'flex' }}>
      <RootSidebar />

      <main className="flex-grow-1" style={{ padding: '44px 40px', maxWidth: 800 }}>
        <button
          type="button"
          onClick={() => router.push('/customers')}
          style={{ background: 'none', border: 'none', color: '#B7B7B7', fontSize: 12, fontWeight: 600, marginBottom: 15, padding: 0 }}
        >
          ‹ Back to Customers
        </button>

        <div className="d-flex align-items-center justify-content-between mb-3">
          <div className="d-flex align-items-center" style={{ gap: 15 }}>
            {customer.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={customer.avatar} alt={name} style={{ width: 50, height: 50, borderRadius: '50%', objectFit: 'cover', border: '1px solid #000' }} />
            ) : (
              <span
                className="d-flex align-items-center justify-content-center rounded-circle"
                style={{ width: 50, height: 50, background: '#EFEFEF', border: '1px solid #000', fontSize: 16, fontWeight: 600, color: '#454545' }}
              >
                {initialsFor(customer.firstName, customer.lastName, customer.phoneNo)}
              </span>
            )}
            <div>
              <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.03em', color: '#181818' }}>{name}</div>
              <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '-0.03em', color: '#454545' }}>
                Since: {formatDate(customer.createdAt)}
              </div>
            </div>
          </div>

          <div className="d-flex" style={{ gap: 5 }}>
            <a
              href={`tel:${customer.phoneNo}`}
              style={{ background: '#E5E5E5', borderRadius: 5, padding: '6px 14px', fontSize: 10, fontWeight: 600, color: '#181818', textDecoration: 'none' }}
            >
              Call Now
            </a>
            {customer.email && (
              <a
                href={`mailto:${customer.email}`}
                style={{ background: '#E5E5E5', borderRadius: 5, padding: '6px 14px', fontSize: 10, fontWeight: 600, color: '#181818', textDecoration: 'none' }}
              >
                Send Mail
              </a>
            )}
          </div>
        </div>

        <div className="d-flex mb-4" style={{ background: '#D2D2D2', borderRadius: 5, padding: 2, gap: 2 }}>
          <TabButton label="Basic Details" active={tab === 'basic'} onClick={() => setTab('basic')} />
          <TabButton label="Subscription" active={tab === 'subscription'} onClick={() => setTab('subscription')} />
          <TabButton label="Wallet" active={tab === 'wallet'} onClick={() => setTab('wallet')} />
          <TabButton label="Tickets" active={tab === 'tickets'} onClick={() => setTab('tickets')} />
        </div>

        {tab === 'basic' && (
          <>
            <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.03em', color: '#181818', marginBottom: 15 }}>
              Basic Details
            </div>
            <div className="row g-3 mb-4">
              <div className="col-6">
                <div style={fieldLabelStyle}>First Name</div>
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)} style={inputStyle} />
              </div>
              <div className="col-6">
                <div style={fieldLabelStyle}>Last Name</div>
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} style={inputStyle} />
              </div>
              <div className="col-6">
                <div style={fieldLabelStyle}>Phone No.</div>
                <input value={phoneNo} onChange={(e) => setPhoneNo(e.target.value)} style={inputStyle} />
              </div>
              <div className="col-6">
                <div style={fieldLabelStyle}>Mail ID (Optional)</div>
                <input value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
              </div>
            </div>
            {basicError && <div className="mb-2" style={{ color: '#E53935', fontSize: 12, fontWeight: 600 }}>{basicError}</div>}
            <button
              type="button"
              onClick={saveBasicDetails}
              disabled={savingBasic}
              style={{ background: '#181818', color: '#FFF', border: 'none', borderRadius: 6, padding: '10px 20px', fontSize: 13, fontWeight: 600, marginBottom: 30 }}
            >
              {savingBasic ? 'Saving…' : 'Save'}
            </button>

            <div className="d-flex justify-content-between align-items-center mb-3">
              <div className="d-flex align-items-end" style={{ gap: 15 }}>
                <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.03em', color: '#181818' }}>Addresses</span>
                <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '-0.03em', color: '#000' }}>
                  {activeAddresses.length} Found
                </span>
              </div>
              {!addingAddress && (
                <button
                  type="button"
                  onClick={() => setAddingAddress(true)}
                  style={{ background: '#181818', color: '#FFF', border: 'none', borderRadius: 5, padding: '5px 10px', fontSize: 10, fontWeight: 600 }}
                >
                  + Add New
                </button>
              )}
            </div>

            <div className="d-flex flex-column" style={{ gap: 12 }}>
              {activeAddresses.map((address) => {
                const { short, full } = addressLines(address);
                return (
                  <div key={address.id} className="d-flex align-items-start justify-content-between" style={{ gap: 15 }}>
                    <div className="d-flex align-items-start" style={{ gap: 15 }}>
                      <span
                        className="d-flex align-items-center justify-content-center"
                        style={{ width: 36, height: 36, background: '#454545', borderRadius: 5, flexShrink: 0 }}
                      >
                        <span style={{ width: 13, height: 13, background: '#FFF', borderRadius: 2 }} />
                      </span>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.03em', color: '#000' }}>
                          {address.title || 'Address'}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '-0.03em', color: '#000' }}>{short}</div>
                        <div style={{ fontSize: 10.5, fontWeight: 500, letterSpacing: '-0.03em', color: '#B7B7B7', maxWidth: 400 }}>
                          {full}
                        </div>
                      </div>
                    </div>
                    <div className="d-flex" style={{ gap: 8, flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => setEditingAddressId(address.id)}
                        style={{ background: '#F2F2F2', border: 'none', borderRadius: 3, padding: '5px 10px', fontSize: 8, fontWeight: 600 }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleArchive(address.id)}
                        style={{ background: '#F2F2F2', border: 'none', borderRadius: 3, padding: '5px 10px', fontSize: 8, fontWeight: 600 }}
                      >
                        Archive
                      </button>
                    </div>
                  </div>
                );
              })}

              {activeAddresses.length === 0 && (
                <div style={{ fontSize: 12, fontWeight: 600, color: '#B7B7B7' }}>No active addresses.</div>
              )}
            </div>

            {archivedAddresses.length > 0 && (
              <div className="mt-4">
                <div style={{ fontSize: 12, fontWeight: 600, color: '#B7B7B7', marginBottom: 8 }}>
                  Archived ({archivedAddresses.length})
                </div>
                <div className="d-flex flex-column" style={{ gap: 8 }}>
                  {archivedAddresses.map((address) => {
                    const { short } = addressLines(address);
                    return (
                      <div key={address.id} className="d-flex align-items-center justify-content-between" style={{ opacity: 0.6 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#000' }}>
                          {address.title || 'Address'} — {short}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRestore(address.id)}
                          style={{ background: '#F2F2F2', border: 'none', borderRadius: 3, padding: '5px 10px', fontSize: 8, fontWeight: 600 }}
                        >
                          Restore
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'subscription' && (
          <div style={{ fontSize: 12, fontWeight: 600, color: '#B7B7B7' }}>Subscription details coming soon.</div>
        )}

        {tab === 'wallet' && (
          <div>
            <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.03em', color: '#181818', marginBottom: 10 }}>
              Wallet Balance
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: customer.walletBalance >= 0 ? '#0C8D6E' : '#E53935' }}>
              {formatCurrency(customer.walletBalance)}
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#B7B7B7', marginTop: 8 }}>Transaction history coming soon.</div>
          </div>
        )}

        {tab === 'tickets' && (
          <div style={{ fontSize: 12, fontWeight: 600, color: '#B7B7B7' }}>This customer&apos;s tickets coming soon.</div>
        )}
      </main>

      {addingAddress && (
        <AddressMapModal
          initial={{}}
          saving={savingAddress}
          onSave={handleSaveNewAddress}
          onCancel={() => setAddingAddress(false)}
        />
      )}

      {editingAddressId && (
        <AddressMapModal
          initial={customer.addresses.find((a) => a.id === editingAddressId) ?? {}}
          saving={savingAddress}
          onSave={(input) => handleSaveEditedAddress(editingAddressId, input)}
          onDelete={() => {
            handleArchive(editingAddressId);
            setEditingAddressId(null);
          }}
          onCancel={() => setEditingAddressId(null)}
        />
      )}
    </div>
  );
}

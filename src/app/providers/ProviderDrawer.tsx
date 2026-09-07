'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import type { NexusProviderAddress, NexusProviderDetail, DeviceTypeKey } from '@/lib/nexus/providers';
import type { NexusProviderTier } from '@/lib/nexus/providerTiers';
import {
  createProviderAction,
  updateProviderAction,
  fetchProviderDetailAction,
  fetchProviderTiersAction,
  approveProviderBankAccountAction,
} from './actions';
import { CloseIcon } from '../tickets/icons';
import { SkillIcon, SKILL_LABELS, SKILL_ORDER } from './skillIcons';
import AddressFields from './AddressFields';

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
  firstName: string;
  lastName: string;
  phoneNo: string;
  email: string;
  skills: DeviceTypeKey[];
  currentAddress: NexusProviderAddress;
  aadharAddress: NexusProviderAddress;
  adminNotes: string;
  providerTierId: string | null;
  imageBase64?: string;
  imageMimeType?: string;
  imagePreviewUrl: string | null;
  bankName: string;
  accountNumber: string;
  accountHolderName: string;
  ifscCode: string;
  isBankApproved: boolean;
}

const EMPTY_FORM: FormState = {
  firstName: '',
  lastName: '',
  phoneNo: '',
  email: '',
  skills: [],
  currentAddress: {},
  aadharAddress: {},
  adminNotes: '',
  providerTierId: null,
  imagePreviewUrl: null,
  bankName: '',
  accountNumber: '',
  accountHolderName: '',
  ifscCode: '',
  isBankApproved: false,
};

function providerToForm(provider: NexusProviderDetail): FormState {
  return {
    firstName: provider.firstName ?? '',
    lastName: provider.lastName ?? '',
    phoneNo: provider.phoneNo,
    email: provider.email ?? '',
    skills: provider.skills,
    currentAddress: provider.currentAddress ?? {},
    aadharAddress: provider.aadharAddress ?? {},
    adminNotes: provider.adminNotes ?? '',
    providerTierId: provider.providerTierId,
    imagePreviewUrl: provider.avatar,
    bankName: provider.bankAccount?.bankName ?? '',
    accountNumber: provider.bankAccount?.accountNumber ?? '',
    accountHolderName: provider.bankAccount?.accountHolderName ?? '',
    ifscCode: provider.bankAccount?.ifscCode ?? '',
    isBankApproved: provider.bankAccount?.isApproved ?? false,
  };
}

export default function ProviderDrawer({
  open,
  providerId,
  onClose,
}: {
  open: boolean;
  providerId: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [approvingBank, setApprovingBank] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tiers, setTiers] = useState<NexusProviderTier[]>([]);

  useEffect(() => {
    if (!open) return;
    fetchProviderTiersAction()
      .then(setTiers)
      .catch(() => setTiers([]));
  }, [open]);

  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setError(null);

    if (!providerId) {
      setForm(EMPTY_FORM);
      return;
    }

    setLoading(true);
    fetchProviderDetailAction(providerId)
      .then((provider) => setForm(providerToForm(provider)))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load provider'))
      .finally(() => setLoading(false));
  }, [open, providerId]);

  function toggleSkill(skill: DeviceTypeKey) {
    setForm((prev) => ({
      ...prev,
      skills: prev.skills.includes(skill) ? prev.skills.filter((s) => s !== skill) : [...prev.skills, skill],
    }));
  }

  function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const [, base64] = dataUrl.split(',');
      setForm((prev) => ({
        ...prev,
        imageBase64: base64,
        imageMimeType: file.type,
        imagePreviewUrl: dataUrl,
      }));
    };
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.phoneNo.trim()) {
      setError('First name, last name, and phone number are required');
      return;
    }

    const hasBankDetails = form.bankName.trim() && form.accountNumber.trim() && form.accountHolderName.trim() && form.ifscCode.trim();

    setSaving(true);
    setError(null);
    try {
      const payload = {
        firstName: form.firstName,
        lastName: form.lastName,
        phoneNo: form.phoneNo,
        email: form.email || undefined,
        skills: form.skills,
        currentAddress: form.currentAddress,
        aadharAddress: form.aadharAddress,
        adminNotes: form.adminNotes || undefined,
        providerTierId: form.providerTierId,
        imageBase64: form.imageBase64,
        imageMimeType: form.imageMimeType,
        bankAccount: hasBankDetails
          ? {
              bankName: form.bankName,
              accountNumber: form.accountNumber,
              accountHolderName: form.accountHolderName,
              ifscCode: form.ifscCode,
            }
          : undefined,
      };

      if (providerId) {
        await updateProviderAction(providerId, payload);
      } else {
        await createProviderAction(payload);
      }

      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save provider');
    } finally {
      setSaving(false);
    }
  }

  async function handleApproveBank() {
    if (!providerId) return;
    setApprovingBank(true);
    setError(null);
    try {
      await approveProviderBankAccountAction(providerId);
      setForm((p) => ({ ...p, isBankApproved: true }));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve bank details');
    } finally {
      setApprovingBank(false);
    }
  }

  if (!open && !visible) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, pointerEvents: open ? 'auto' : 'none' }}>
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', opacity: visible ? 1 : 0, transition: 'opacity 0.25s ease' }}
      />

      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(768px, 96vw)',
          background: '#FFFFFF',
          borderTopLeftRadius: 10,
          borderBottomLeftRadius: 10,
          transform: `translateX(${visible ? '0' : '100%'})`,
          transition: 'transform 0.28s ease',
          overflowY: 'auto',
          padding: '20px 25px',
        }}
      >
        <div className="d-flex justify-content-between align-items-center mb-4">
          <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', color: '#181818' }}>
            {providerId ? 'Edit Provider' : 'Add Provider'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="d-flex align-items-center justify-content-center"
            style={{ width: 33, height: 33, borderRadius: '50%', border: '2px solid #F3F3F3', background: '#FFF', boxShadow: '0 4px 24px rgba(0,0,0,0.25)' }}
          >
            <CloseIcon />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#B7B7B7' }}>Loading…</div>
        ) : (
          <>
            <div className="row g-3 mb-3">
              <div className="col-6">
                <div style={fieldLabelStyle}>First Name</div>
                <input
                  type="text"
                  value={form.firstName}
                  onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div className="col-6">
                <div style={fieldLabelStyle}>Last Name</div>
                <input
                  type="text"
                  value={form.lastName}
                  onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div className="col-6">
                <div style={fieldLabelStyle}>Phone No.</div>
                <input
                  type="tel"
                  value={form.phoneNo}
                  onChange={(e) => setForm((p) => ({ ...p, phoneNo: e.target.value }))}
                  placeholder="(91) 98241 57811"
                  style={inputStyle}
                />
              </div>
              <div className="col-6">
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

            <div className="row g-3 mb-3">
              <div className="col-6">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span style={fieldLabelStyle}>Skills</span>
                  <span style={fieldLabelStyle}>{form.skills.length} Selected</span>
                </div>
                <div className="d-flex flex-column" style={{ gap: 6 }}>
                  {SKILL_ORDER.map((skill) => {
                    const selected = form.skills.includes(skill);
                    return (
                      <div
                        key={skill}
                        className="d-flex justify-content-between align-items-center"
                        style={{ background: '#EFEFEF', border: '1px solid #E5E5E5', borderRadius: 6, padding: '9px 11px' }}
                      >
                        <div className="d-flex align-items-center" style={{ gap: 10 }}>
                          <SkillIcon type={skill} />
                          <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.03em', color: '#000' }}>
                            {SKILL_LABELS[skill]}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleSkill(skill)}
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

              <div className="col-6 d-flex flex-column" style={{ gap: 15 }}>
                <AddressFields
                  label="Current Address"
                  value={form.currentAddress}
                  onChange={(next) => setForm((p) => ({ ...p, currentAddress: next }))}
                />
                <AddressFields
                  label="Aadhar Address"
                  value={form.aadharAddress}
                  onChange={(next) => setForm((p) => ({ ...p, aadharAddress: next }))}
                />
              </div>
            </div>

            <div className="row g-3 mb-4">
              <div className="col-6">
                <div style={fieldLabelStyle}>Upload Image</div>
                <label
                  className="d-flex align-items-center justify-content-center"
                  style={{
                    height: 80,
                    border: '1px dashed #B7B7B7',
                    borderRadius: 6,
                    background: '#EFEFEF',
                    cursor: 'pointer',
                    overflow: 'hidden',
                  }}
                >
                  {form.imagePreviewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.imagePreviewUrl} alt="Provider" style={{ height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#B7B7B7' }}>+ Edit or Upload From Device</span>
                  )}
                  <input type="file" accept="image/*" onChange={handleImagePick} style={{ display: 'none' }} />
                </label>
              </div>
              <div className="col-6">
                <div style={fieldLabelStyle}>Notes</div>
                <textarea
                  value={form.adminNotes}
                  onChange={(e) => setForm((p) => ({ ...p, adminNotes: e.target.value }))}
                  placeholder="Add Notes here…"
                  rows={3}
                  style={{ ...inputStyle, resize: 'none' }}
                />
              </div>
            </div>

            <div className="row g-3 mb-4">
              <div className="col-6">
                <div style={fieldLabelStyle}>Provider Tier</div>
                <select
                  value={form.providerTierId ?? ''}
                  onChange={(e) => setForm((p) => ({ ...p, providerTierId: e.target.value || null }))}
                  style={inputStyle}
                >
                  <option value="">No tier</option>
                  {tiers.map((tier) => (
                    <option key={tier.id} value={tier.id}>
                      {tier.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="row g-3 mb-4">
              <div className="col-6">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span style={fieldLabelStyle}>Bank Details</span>
                  <button
                    type="button"
                    onClick={handleApproveBank}
                    disabled={!providerId || approvingBank || form.isBankApproved}
                    style={{
                      background: form.isBankApproved ? '#2FAD63' : '#181818',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: 6,
                      padding: '5px 10px',
                      fontSize: 8,
                      fontWeight: 600,
                      letterSpacing: '-0.03em',
                      opacity: !providerId || approvingBank ? 0.6 : 1,
                    }}
                  >
                    {form.isBankApproved ? 'Approved' : approvingBank ? 'Approving…' : 'Approve Details'}
                  </button>
                </div>
                <div className="d-flex flex-column" style={{ gap: 5 }}>
                  <input
                    type="text"
                    value={form.bankName}
                    onChange={(e) => setForm((p) => ({ ...p, bankName: e.target.value, isBankApproved: false }))}
                    placeholder="Complete Bank Name"
                    style={inputStyle}
                  />
                  <input
                    type="text"
                    value={form.accountNumber}
                    onChange={(e) => setForm((p) => ({ ...p, accountNumber: e.target.value, isBankApproved: false }))}
                    placeholder="Account Number"
                    style={inputStyle}
                  />
                  <input
                    type="text"
                    value={form.accountHolderName}
                    onChange={(e) => setForm((p) => ({ ...p, accountHolderName: e.target.value, isBankApproved: false }))}
                    placeholder="Account Holder Name"
                    style={inputStyle}
                  />
                  <input
                    type="text"
                    value={form.ifscCode}
                    onChange={(e) => setForm((p) => ({ ...p, ifscCode: e.target.value, isBankApproved: false }))}
                    placeholder="Bank IFSC Code"
                    style={inputStyle}
                  />
                </div>
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
          </>
        )}
      </div>
    </div>
  );
}

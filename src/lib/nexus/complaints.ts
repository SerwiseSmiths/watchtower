import { nexusFetch } from './client';

export type ComplaintStage = 'ENTRANCE' | 'QR_VALIDATED' | 'ESTIMATION' | 'APPROVAL' | 'PAYMENT' | 'COMPLETED' | 'REJECTED';

export interface NexusPerson {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phoneNo: string;
  email: string | null;
  avatar: string | null;
}

export interface NexusAddress {
  id: string;
  title: string | null;
  houseNo: string;
  societyName: string;
  addressLineOne: string | null;
  addressLineTwo: string | null;
  area: string | null;
  pinCode: string | null;
  city: string | null;
  state: string | null;
}

export interface NexusDevice {
  id: string;
  type: string;
  deviceKey: string;
  imageUrl: string | null;
}

export type QuoteStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface NexusQuoteItem {
  partId?: string;
  name: string;
  unitPrice: number;
  quantity: number;
}

export interface NexusQuote {
  id: string;
  items: NexusQuoteItem[];
  totalAmount: number;
  notes: string | null;
  status: QuoteStatus;
}

export interface NexusComplaint {
  id: string;
  title: string;
  stage: ComplaintStage;
  subscriptionId: string | null;
  providerAccepted: boolean;
  createdAt: string;
  updatedAt: string;
  user: NexusPerson;
  provider: NexusPerson | null;
  address: NexusAddress | null;
  device: NexusDevice | null;
  quote: NexusQuote | null;
}

export async function fetchAllComplaints(): Promise<NexusComplaint[]> {
  const res = await nexusFetch('/complaint');
  const body = await res.json();
  return body.data.complaints as NexusComplaint[];
}

/** Force-advances a complaint's stage as ADMIN — used for the entrance bypass action, which
 *  skips the customer's QR scan and moves ENTRANCE straight to QR_VALIDATED. */
export async function setComplaintStage(complaintId: string, stage: ComplaintStage): Promise<void> {
  await nexusFetch(`/complaint/${complaintId}/stage`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stage }),
  });
}

/** Attaches a device to a complaint as ADMIN — same effect as a provider identifying the
 *  appliance on-site (auto-advances QR_VALIDATED → ESTIMATION). */
export async function linkDeviceToComplaint(complaintId: string, deviceId: string, deviceKey: string): Promise<void> {
  await nexusFetch(`/complaint/${complaintId}/device`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId, deviceKey }),
  });
}

/** Assigns (or reassigns) the provider on a complaint — already ADMIN-only on nexus's side. */
export async function assignProvider(complaintId: string, providerId: string): Promise<void> {
  await nexusFetch(`/complaint/${complaintId}/assign`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ providerId }),
  });
}

/** Approves or rejects a pending quote as ADMIN, on the customer's behalf — same effect as
 *  the customer responding in serwise (approve → PAYMENT/COMPLETED, reject → REJECTED). */
export async function respondToQuote(complaintId: string, approved: boolean, rejectionReason?: string): Promise<void> {
  await nexusFetch(`/complaint/${complaintId}/quote/respond`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approved, ...(rejectionReason && { rejectionReason }) }),
  });
}

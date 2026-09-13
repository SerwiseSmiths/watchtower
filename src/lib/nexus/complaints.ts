import { nexusFetch } from './client';

export type ComplaintStage = 'ENTRANCE' | 'QR_VALIDATED' | 'ESTIMATION' | 'APPROVAL' | 'IN_PROGRESS' | 'PAYMENT' | 'COMPLETED' | 'REJECTED';

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

export interface NexusComplaintDeviceLink {
  device: NexusDevice;
}

export interface NexusRequestedDevice {
  deviceKey: string;
  quantity: number;
}

export interface NexusDeviceTypeGroup {
  key: string;
  name: string;
  deviceTypes: string[];
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

// One dated entry in the complaint's audit trail (see nexus's
// ComplaintService.logComplaintEvent) — e.g. CREATED, STAGE_CHANGED,
// PROVIDER_ASSIGNED, PROVIDER_ACCEPTED, PROVIDER_REJECTED, QUOTE_ADDED,
// QUOTE_APPROVED, QUOTE_REJECTED, REOPENED. fromStage/toStage are only set
// for stage-transition events.
export interface NexusComplaintLog {
  id: string;
  event: string;
  fromStage: ComplaintStage | null;
  toStage: ComplaintStage | null;
  actorId: string | null;
  actorRole: 'CUSTOMER' | 'PROVIDER' | 'ADMIN' | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
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
  // What was originally asked for (type + quantity, no pre-existing Device row
  // required) vs. the physical units actually identified so far on-site.
  group: NexusDeviceTypeGroup | null;
  requestedDevices: NexusRequestedDevice[] | null;
  devices: NexusComplaintDeviceLink[];
  quote: NexusQuote | null;
  logs: NexusComplaintLog[];
}

// Complaints change constantly from outside Watchtower too (radix providers advancing
// stage), so this leans on the shorter time-based fallback rather than tag invalidation alone.
export async function fetchAllComplaints(): Promise<NexusComplaint[]> {
  const res = await nexusFetch('/complaint', {}, { tags: ['complaints'], revalidate: 15 });
  const body = await res.json();
  return body.data.complaints as NexusComplaint[];
}

export interface CreateComplaintInput {
  customerId: string;
  title: string;
  notes?: string;
  addressId: string;
  requestedDevices: NexusRequestedDevice[];
}

/** Creates a complaint on a customer's behalf, as ADMIN. Requested devices spanning
 *  multiple device-type groups are split by nexus into one complaint per group (e.g.
 *  "2 AC + 1 Fridge + 2 RO" becomes one ticket for AC+Fridge and another for RO), so
 *  this can return more than one complaint from a single call. */
export async function createComplaint(input: CreateComplaintInput): Promise<NexusComplaint[]> {
  const res = await nexusFetch('/complaint', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await res.json();
  return (body.data.complaints ?? [body.data.complaint]) as NexusComplaint[];
}

/** Force-advances a complaint's stage as ADMIN — used for the entrance bypass action, which
 *  skips the customer's QR scan and moves ENTRANCE straight to QR_VALIDATED, and for cancelling
 *  a ticket (stage: REJECTED — displays as "Cancelled" in the tickets table). */
export async function setComplaintStage(complaintId: string, stage: ComplaintStage, rejectionReason?: string): Promise<void> {
  await nexusFetch(`/complaint/${complaintId}/stage`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stage, ...(rejectionReason && { rejectionReason }) }),
  });
}

/** Reopens a completed or cancelled complaint as ADMIN, on the customer's behalf — creates a
 *  fresh complaint (parentId pointing to the original) owned by the same customer. */
export async function reopenComplaint(complaintId: string): Promise<NexusComplaint> {
  const res = await nexusFetch(`/complaint/${complaintId}/reopen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const body = await res.json();
  return body.data.complaint as NexusComplaint;
}

/** Attaches an already-existing device to a complaint as ADMIN — same effect as a provider
 *  identifying the appliance on-site (auto-advances QR_VALIDATED → ESTIMATION). */
export async function linkDeviceToComplaint(complaintId: string, deviceId: string): Promise<void> {
  await nexusFetch(`/complaint/${complaintId}/device`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ devices: [{ deviceId }] }),
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

export interface AddQuoteItemInput {
  name: string;
  unitPrice: number;
  quantity: number;
  // Strapi service-part documentId — when set, nexus re-resolves name/price
  // from the CMS at creation time (ignoring whatever this client sends) so
  // the quote snapshots the authoritative catalogue price, not a possibly
  // stale client-side read of it — unless priceOverridden is also set.
  partId?: string;
  // Backup for when the real cost ran higher than the catalogue's listed
  // price — only meaningful alongside partId; trusts this item's unitPrice
  // verbatim instead of letting nexus re-resolve it from the CMS.
  priceOverridden?: boolean;
}

/** Submits a quote as ADMIN on the assigned provider's behalf (e.g. a phoned-in estimate) —
 *  moves the complaint to APPROVAL for the customer to review, same as a provider submitting
 *  one from radix. The complaint must already have a provider assigned. */
export async function addQuote(complaintId: string, items: AddQuoteItemInput[], notes?: string): Promise<NexusComplaint> {
  const res = await nexusFetch(`/complaint/${complaintId}/quote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, ...(notes && { notes }) }),
  });
  const body = await res.json();
  return body.data.complaint as NexusComplaint;
}

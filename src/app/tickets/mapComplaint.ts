import type { ComplaintStage, NexusAddress, NexusComplaint, NexusPerson, NexusQuote, QuoteStatus } from '@/lib/nexus/complaints';

export type TicketStatus = 'Raised' | 'In-Warranty' | 'In Progress' | 'Cancelled' | 'Completed';

export interface TicketAddress {
  id: string;
  short: string;
  full: string;
  pinCode: string | null;
}

export interface TicketDevice {
  id: string;
  type: string;
  deviceKey: string;
}

export interface TicketRequestedDevice {
  deviceKey: string;
  quantity: number;
}

export interface TicketQuoteItem {
  name: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface TicketQuote {
  status: QuoteStatus;
  totalAmount: number;
  items: TicketQuoteItem[];
}

export interface TicketLogEntry {
  id: string;
  event: string;
  fromStage: ComplaintStage | null;
  toStage: ComplaintStage | null;
  createdAt: string;
}

export interface Ticket {
  complaintId: string;
  customerId: string;
  title: string;
  stage: ComplaintStage;
  providerAccepted: boolean;
  subscriptionId: string | null;
  id: string;
  name: string;
  initials: string;
  avatar: string | null;
  phoneNumber: string;
  email: string | null;
  status: TicketStatus;
  assignTo: string;
  assignInitials: string;
  assignId: string | null;
  assignAvatar: string | null;
  assignPhoneNumber: string | null;
  assignEmail: string | null;
  hasProvider: boolean;
  pinCode: string | null;
  address: TicketAddress | null;
  requestedDevices: TicketRequestedDevice[];
  devices: TicketDevice[];
  quote: TicketQuote | null;
  logs: TicketLogEntry[];
  startDateRaw: string;
  updatedAtRaw: string;
  startDate: string;
  endDate: string | null;
}

// Real date/time a given stage was first reached, read off the complaint's
// audit log — falls back to null (caller decides what to show, e.g. only the
// current stage's updatedAt) when no log entry recorded that transition yet
// (complaints created before this log existed).
export function stageReachedAt(logs: TicketLogEntry[], stage: ComplaintStage): string | null {
  const entry = logs.find((log) => log.toStage === stage);
  return entry?.createdAt ?? null;
}

function formatStageLabel(stage: ComplaintStage): string {
  return stage
    .toLowerCase()
    .split('_')
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(' ');
}

// Human-readable one-liner for a raw log row — shown in the ticket detail's
// History section. Falls back to the raw event string for anything not
// explicitly labeled here, so a future event type never renders blank.
export function describeLogEvent(log: TicketLogEntry): string {
  switch (log.event) {
    case 'CREATED':
      return 'Complaint raised';
    case 'STAGE_CHANGED':
      return log.fromStage && log.toStage
        ? `Stage changed: ${formatStageLabel(log.fromStage)} → ${formatStageLabel(log.toStage)}`
        : log.toStage
          ? `Stage changed to ${formatStageLabel(log.toStage)}`
          : 'Stage changed';
    case 'PROVIDER_ASSIGNED':
      return 'Provider assigned';
    case 'PROVIDER_ACCEPTED':
      return 'Provider accepted the job';
    case 'PROVIDER_REJECTED':
      return 'Provider rejected the job';
    case 'QUOTE_ADDED':
      return 'Quote submitted';
    case 'QUOTE_APPROVED':
      return 'Quote approved by customer';
    case 'QUOTE_REJECTED':
      return 'Quote rejected by customer';
    case 'REOPENED':
      return 'Complaint reopened';
    case 'ASSIGNMENT_POPUP_DELIVERED':
      return 'Job alert shown to provider';
    case 'ASSIGNMENT_EXPIRED_REASSIGNING':
      return 'Provider did not respond — reassigning';
    default:
      return log.event;
  }
}

// When a provider was (most recently) assigned — there's no ComplaintStage
// for "assigned" (it's orthogonal to stage), so this reads the dedicated
// PROVIDER_ASSIGNED event instead of a stage transition. Most recent, not
// first, so a reassignment updates the displayed date.
export function providerAssignedAt(logs: TicketLogEntry[]): string | null {
  for (let i = logs.length - 1; i >= 0; i -= 1) {
    if (logs[i].event === 'PROVIDER_ASSIGNED') return logs[i].createdAt;
  }
  return null;
}

function personName(person: NexusPerson | null): string {
  if (!person) return '-';
  return [person.firstName, person.lastName].filter(Boolean).join(' ') || person.phoneNo;
}

function personInitials(person: NexusPerson | null): string {
  if (!person) return '—';
  const first = person.firstName?.trim()?.[0] ?? '';
  const last = person.lastName?.trim()?.[0] ?? '';
  return (first + last).toUpperCase() || person.phoneNo.slice(-2);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Date + time — used for logged events (stage changes, assignment, etc.)
// where exactly when something happened matters, not just which day.
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  const datePart = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const timePart = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${datePart}, ${timePart}`;
}

export function formatDeviceType(type: string): string {
  return type
    .toLowerCase()
    .split('_')
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(' ');
}

function buildAddress(address: NexusAddress | null): TicketAddress | null {
  if (!address) return null;
  const short = address.title || address.societyName;
  const full = [address.houseNo, address.societyName, address.addressLineOne, address.addressLineTwo, address.area, address.city, address.state, address.pinCode]
    .filter(Boolean)
    .join(', ');
  return { id: address.id, short, full, pinCode: address.pinCode };
}

function buildQuote(quote: NexusQuote | null): TicketQuote | null {
  if (!quote) return null;
  return {
    status: quote.status,
    totalAmount: quote.totalAmount,
    items: quote.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: item.unitPrice * item.quantity,
    })),
  };
}

/** Stage → status bucket. A complaint under an active subscription is badged
 *  In-Warranty regardless of stage, unless it's already closed (Completed/Cancelled). */
function resolveStatus(complaint: NexusComplaint): TicketStatus {
  if (complaint.stage === 'REJECTED') return 'Cancelled';
  if (complaint.stage === 'COMPLETED') return 'Completed';
  if (complaint.subscriptionId) return 'In-Warranty';
  if (complaint.stage === 'ENTRANCE') return 'Raised';
  return 'In Progress';
}

export function mapComplaintToTicket(complaint: NexusComplaint): Ticket {
  const isClosed = complaint.stage === 'COMPLETED' || complaint.stage === 'REJECTED';

  return {
    complaintId: complaint.id,
    customerId: complaint.user.id,
    title: complaint.title,
    stage: complaint.stage,
    providerAccepted: complaint.providerAccepted,
    subscriptionId: complaint.subscriptionId,
    id: `#${complaint.id.slice(0, 10).toUpperCase()}`,
    name: personName(complaint.user),
    initials: personInitials(complaint.user),
    avatar: complaint.user.avatar,
    phoneNumber: complaint.user.phoneNo,
    email: complaint.user.email,
    status: resolveStatus(complaint),
    assignTo: personName(complaint.provider),
    assignInitials: personInitials(complaint.provider),
    assignId: complaint.provider?.id ?? null,
    assignAvatar: complaint.provider?.avatar ?? null,
    assignPhoneNumber: complaint.provider?.phoneNo ?? null,
    assignEmail: complaint.provider?.email ?? null,
    hasProvider: complaint.provider !== null,
    pinCode: complaint.address?.pinCode ?? null,
    address: buildAddress(complaint.address),
    requestedDevices: complaint.requestedDevices ?? [],
    devices: complaint.devices.map((link) => ({ id: link.device.id, type: link.device.type, deviceKey: link.device.deviceKey })),
    quote: buildQuote(complaint.quote),
    logs: complaint.logs.map((log) => ({
      id: log.id,
      event: log.event,
      fromStage: log.fromStage,
      toStage: log.toStage,
      createdAt: log.createdAt,
    })),
    startDateRaw: complaint.createdAt,
    updatedAtRaw: complaint.updatedAt,
    startDate: formatDate(complaint.createdAt),
    endDate: isClosed ? formatDate(complaint.updatedAt) : null,
  };
}

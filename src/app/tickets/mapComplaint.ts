import type { ComplaintStage, NexusAddress, NexusComplaint, NexusPerson, NexusQuote, QuoteStatus } from '@/lib/nexus/complaints';

export type TicketStatus = 'Raised' | 'In-Warranty' | 'In Progress' | 'Cancelled' | 'Completed';

export interface TicketAddress {
  id: string;
  short: string;
  full: string;
  pinCode: string | null;
}

export interface TicketDevice {
  type: string;
  deviceKey: string;
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
  device: TicketDevice | null;
  quote: TicketQuote | null;
  startDateRaw: string;
  updatedAtRaw: string;
  startDate: string;
  endDate: string | null;
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
    device: complaint.device ? { type: complaint.device.type, deviceKey: complaint.device.deviceKey } : null,
    quote: buildQuote(complaint.quote),
    startDateRaw: complaint.createdAt,
    updatedAtRaw: complaint.updatedAt,
    startDate: formatDate(complaint.createdAt),
    endDate: isClosed ? formatDate(complaint.updatedAt) : null,
  };
}

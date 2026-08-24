import type { NexusProviderDetail } from '@/lib/nexus/providers';

export interface ProviderRow {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  initials: string;
  avatar: string | null;
  phoneNumber: string;
  email: string | null;
  isActive: boolean;
  skills: string[];
  complaintSuccess: number;
  location: string | null;
  walletBalance: number;
  connectedSince: string;
  connectedSinceRaw: string;
  overdue: number;
}

function initialsFor(firstName: string | null, lastName: string | null, fallback: string): string {
  const first = firstName?.trim()?.[0] ?? '';
  const last = lastName?.trim()?.[0] ?? '';
  return (first + last).toUpperCase() || fallback.slice(-2);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatCurrency(amount: number): string {
  const sign = amount > 0 ? '+' : amount < 0 ? '-' : '';
  return `${sign}₹${Math.abs(amount).toFixed(2)}`;
}

export function mapProviderToRow(provider: NexusProviderDetail): ProviderRow {
  const location = provider.currentAddress
    ? [provider.currentAddress.city, provider.currentAddress.state, provider.currentAddress.country]
        .filter(Boolean)
        .join(', ') || null
    : null;

  return {
    id: provider.id,
    firstName: provider.firstName ?? '',
    lastName: provider.lastName ?? '',
    name: [provider.firstName, provider.lastName].filter(Boolean).join(' ') || provider.phoneNo,
    initials: initialsFor(provider.firstName, provider.lastName, provider.phoneNo),
    avatar: provider.avatar,
    phoneNumber: provider.phoneNo,
    email: provider.email,
    isActive: provider.isActive,
    skills: provider.skills,
    complaintSuccess: provider.stats.complaintSuccess,
    location,
    walletBalance: provider.stats.walletBalance,
    connectedSince: formatDate(provider.createdAt),
    connectedSinceRaw: provider.createdAt,
    overdue: provider.stats.overdue,
  };
}

import { nexusFetch } from './client';
import type { DeviceTypeKey } from './providers';

export type ProviderSignupStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/** A "Join Serwise" request submitted from the website. */
export interface NexusProviderSignup {
  id: string;
  firstName: string;
  lastName: string;
  phoneNo: string;
  city: string;
  deviceTypes: DeviceTypeKey[];
  experienceYears: number | null;
  status: ProviderSignupStatus;
  adminNotes: string | null;
  /** Set once an admin creates a provider with this phone number. */
  providerId: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function listProviderSignups(status?: ProviderSignupStatus): Promise<NexusProviderSignup[]> {
  const query = status ? `?status=${status}` : '';
  const res = await nexusFetch(`/provider-signup${query}`, {}, { tags: ['provider-signups'] });
  const body = await res.json();
  return body.data.requests as NexusProviderSignup[];
}

export async function updateProviderSignup(
  id: string,
  input: { status?: ProviderSignupStatus; adminNotes?: string | null },
): Promise<NexusProviderSignup> {
  const res = await nexusFetch(`/provider-signup/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await res.json();
  return body.data.request as NexusProviderSignup;
}

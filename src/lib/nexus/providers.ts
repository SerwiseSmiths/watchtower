import { nexusFetch } from './client';

export type DeviceTypeKey = 'MASTER_PURIFIER' | 'AIR_CONDITIONER' | 'FRIDGE' | 'WASHING_MACHINE' | 'GEYSER';

export interface NexusProvider {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phoneNo: string;
  email: string | null;
  avatar: string | null;
}

export interface NexusProviderAddress {
  houseNo?: string;
  addressLineOne?: string;
  addressLineTwo?: string;
  area?: string;
  city?: string;
  state?: string;
  pinCode?: string;
  country?: string;
  latitude?: string;
  longitude?: string;
}

export interface NexusProviderStats {
  complaintSuccess: number;
  overdue: number;
  walletBalance: number;
}

export interface NexusProviderDetail {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phoneNo: string;
  email: string | null;
  avatar: string | null;
  isActive: boolean;
  skills: DeviceTypeKey[];
  currentAddress: NexusProviderAddress | null;
  aadharAddress: NexusProviderAddress | null;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
  stats: NexusProviderStats;
}

export interface ProviderInput {
  firstName: string;
  lastName: string;
  phoneNo: string;
  email?: string;
  skills?: DeviceTypeKey[];
  currentAddress?: NexusProviderAddress;
  aadharAddress?: NexusProviderAddress;
  adminNotes?: string;
  imageBase64?: string;
  imageMimeType?: string;
}

/** Lists active providers for a reassignment picker — nexus's ADMIN-only /user/providers. */
export async function listProviders(search?: string): Promise<NexusProvider[]> {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  const res = await nexusFetch(`/user/providers${query}`);
  const body = await res.json();
  return body.data.providers as NexusProvider[];
}

/** Full provider detail + stats (complaintSuccess, overdue, walletBalance) for the Providers table. */
export async function fetchAllProviders(search?: string): Promise<NexusProviderDetail[]> {
  const params = new URLSearchParams({ withStats: 'true' });
  if (search) params.set('search', search);
  const res = await nexusFetch(`/user/providers?${params.toString()}`);
  const body = await res.json();
  return body.data.providers as NexusProviderDetail[];
}

export async function fetchProvider(id: string): Promise<NexusProviderDetail> {
  const res = await nexusFetch(`/user/providers/${id}`);
  const body = await res.json();
  return body.data.provider as NexusProviderDetail;
}

export async function createProvider(input: ProviderInput): Promise<NexusProviderDetail> {
  const res = await nexusFetch('/user/providers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await res.json();
  return body.data.provider as NexusProviderDetail;
}

export async function updateProvider(id: string, input: Partial<ProviderInput> & { isActive?: boolean }): Promise<NexusProviderDetail> {
  const res = await nexusFetch(`/user/providers/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await res.json();
  return body.data.provider as NexusProviderDetail;
}

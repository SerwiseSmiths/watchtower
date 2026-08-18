import { nexusFetch } from './client';

export interface NexusProvider {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phoneNo: string;
  email: string | null;
  avatar: string | null;
}

/** Lists active providers for a reassignment picker — nexus's new ADMIN-only /user/providers. */
export async function listProviders(search?: string): Promise<NexusProvider[]> {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  const res = await nexusFetch(`/user/providers${query}`);
  const body = await res.json();
  return body.data.providers as NexusProvider[];
}

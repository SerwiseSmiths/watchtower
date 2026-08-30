import { nexusFetch } from './client';

/** Admin-configurable provider tier/level, native to Nexus (not Strapi) — label only for now, see ProviderTier in schema.prisma. */
export interface NexusProviderTier {
  id: string;
  name: string;
  order: number;
  isActive: boolean;
  description: string | null;
  color: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderTierInput {
  name: string;
  order?: number;
  isActive?: boolean;
  description?: string;
  color?: string;
}

export async function listProviderTiers(): Promise<NexusProviderTier[]> {
  const res = await nexusFetch('/provider-tiers');
  const body = await res.json();
  return body.data.tiers as NexusProviderTier[];
}

export async function createProviderTier(input: ProviderTierInput): Promise<NexusProviderTier> {
  const res = await nexusFetch('/provider-tiers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await res.json();
  return body.data.tier as NexusProviderTier;
}

export async function updateProviderTier(id: string, input: Partial<ProviderTierInput>): Promise<NexusProviderTier> {
  const res = await nexusFetch(`/provider-tiers/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await res.json();
  return body.data.tier as NexusProviderTier;
}

export async function deleteProviderTier(id: string): Promise<void> {
  await nexusFetch(`/provider-tiers/${id}`, { method: 'DELETE' });
}

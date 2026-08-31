'use server';

import { revalidatePath, updateTag } from 'next/cache';
import {
  listProviderTiers,
  createProviderTier,
  updateProviderTier,
  deleteProviderTier,
  type NexusProviderTier,
  type ProviderTierInput,
} from '@/lib/nexus/providerTiers';
import { logAudit } from '@/lib/audit/log';

async function findTier(id: string): Promise<NexusProviderTier | null> {
  const tiers = await listProviderTiers().catch(() => []);
  return tiers.find((t) => t.id === id) ?? null;
}

export async function createProviderTierAction(input: ProviderTierInput): Promise<NexusProviderTier> {
  const tier = await createProviderTier(input);
  revalidatePath('/provider-tiers');
  updateTag('provider-tiers');
  await logAudit({ module: 'provider-tier', action: 'CREATE', entityId: tier.id, entityLabel: tier.name, after: { ...tier } });
  return tier;
}

export async function updateProviderTierAction(id: string, input: Partial<ProviderTierInput>): Promise<NexusProviderTier> {
  const before = await findTier(id);
  const tier = await updateProviderTier(id, input);
  revalidatePath('/provider-tiers');
  updateTag('provider-tiers');
  await logAudit({
    module: 'provider-tier',
    action: 'UPDATE',
    entityId: id,
    entityLabel: tier.name,
    before: before ? { ...before } : undefined,
    after: { ...tier },
  });
  return tier;
}

export async function deleteProviderTierAction(id: string): Promise<void> {
  const before = await findTier(id);
  await deleteProviderTier(id);
  revalidatePath('/provider-tiers');
  updateTag('provider-tiers');
  await logAudit({
    module: 'provider-tier',
    action: 'DELETE',
    entityId: id,
    entityLabel: before?.name,
    before: before ? { ...before } : undefined,
  });
}

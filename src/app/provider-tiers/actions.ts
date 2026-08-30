'use server';

import { revalidatePath } from 'next/cache';
import {
  createProviderTier,
  updateProviderTier,
  deleteProviderTier,
  type NexusProviderTier,
  type ProviderTierInput,
} from '@/lib/nexus/providerTiers';

export async function createProviderTierAction(input: ProviderTierInput): Promise<NexusProviderTier> {
  const tier = await createProviderTier(input);
  revalidatePath('/provider-tiers');
  return tier;
}

export async function updateProviderTierAction(id: string, input: Partial<ProviderTierInput>): Promise<NexusProviderTier> {
  const tier = await updateProviderTier(id, input);
  revalidatePath('/provider-tiers');
  return tier;
}

export async function deleteProviderTierAction(id: string): Promise<void> {
  await deleteProviderTier(id);
  revalidatePath('/provider-tiers');
}

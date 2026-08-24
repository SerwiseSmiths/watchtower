'use server';

import { revalidatePath } from 'next/cache';
import {
  createProvider,
  updateProvider,
  fetchProvider,
  type NexusProviderDetail,
  type ProviderInput,
} from '@/lib/nexus/providers';
import { autocompleteAddress, type AddressPrediction } from '@/lib/nexus/geocode';

export async function fetchProviderDetailAction(id: string): Promise<NexusProviderDetail> {
  return fetchProvider(id);
}

export async function createProviderAction(input: ProviderInput): Promise<NexusProviderDetail> {
  const provider = await createProvider(input);
  revalidatePath('/providers');
  return provider;
}

export async function updateProviderAction(
  id: string,
  input: Partial<ProviderInput> & { isActive?: boolean },
): Promise<NexusProviderDetail> {
  const provider = await updateProvider(id, input);
  revalidatePath('/providers');
  return provider;
}

export async function searchAddressAction(query: string): Promise<AddressPrediction[]> {
  return autocompleteAddress(query);
}

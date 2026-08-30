'use server';

import { revalidatePath } from 'next/cache';
import {
  createProvider,
  updateProvider,
  fetchProvider,
  approveProviderBankAccount,
  type NexusProviderDetail,
  type NexusProviderBankAccount,
  type ProviderInput,
} from '@/lib/nexus/providers';
import { listProviderTiers, type NexusProviderTier } from '@/lib/nexus/providerTiers';
import { autocompleteAddress, type AddressPrediction } from '@/lib/nexus/geocode';

export async function fetchProviderDetailAction(id: string): Promise<NexusProviderDetail> {
  return fetchProvider(id);
}

export async function fetchProviderTiersAction(): Promise<NexusProviderTier[]> {
  return listProviderTiers();
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

export async function approveProviderBankAccountAction(id: string): Promise<NexusProviderBankAccount> {
  const bankAccount = await approveProviderBankAccount(id);
  revalidatePath('/providers');
  return bankAccount;
}

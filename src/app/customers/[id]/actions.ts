'use server';

import { revalidatePath } from 'next/cache';
import {
  updateCustomer,
  createCustomerAddress,
  updateCustomerAddress,
  archiveCustomerAddress,
  restoreCustomerAddress,
  type NexusCustomerDetail,
  type NexusCustomerAddress,
  type UpdateCustomerInput,
  type CustomerAddressInput,
} from '@/lib/nexus/customers';
import { autocompleteAddress, reverseGeocodeAddress, type AddressPrediction } from '@/lib/nexus/geocode';

export async function searchAddressAction(query: string): Promise<AddressPrediction[]> {
  return autocompleteAddress(query);
}

export async function reverseGeocodeAction(lat: number, lng: number): Promise<AddressPrediction | null> {
  return reverseGeocodeAddress(lat, lng);
}

export async function updateCustomerAction(id: string, input: UpdateCustomerInput): Promise<NexusCustomerDetail> {
  const customer = await updateCustomer(id, input);
  revalidatePath(`/customers/${id}`);
  return customer;
}

export async function createAddressAction(customerId: string, input: CustomerAddressInput): Promise<NexusCustomerAddress> {
  const address = await createCustomerAddress(customerId, input);
  revalidatePath(`/customers/${customerId}`);
  return address;
}

export async function updateAddressAction(
  customerId: string,
  addressId: string,
  input: Partial<CustomerAddressInput>,
): Promise<NexusCustomerAddress> {
  const address = await updateCustomerAddress(customerId, addressId, input);
  revalidatePath(`/customers/${customerId}`);
  return address;
}

export async function archiveAddressAction(customerId: string, addressId: string): Promise<void> {
  await archiveCustomerAddress(customerId, addressId);
  revalidatePath(`/customers/${customerId}`);
}

export async function restoreAddressAction(customerId: string, addressId: string): Promise<void> {
  await restoreCustomerAddress(customerId, addressId);
  revalidatePath(`/customers/${customerId}`);
}

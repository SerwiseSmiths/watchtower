'use server';

import { revalidatePath } from 'next/cache';
import {
  fetchCustomer,
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
import { logAudit } from '@/lib/audit/log';

export async function searchAddressAction(query: string): Promise<AddressPrediction[]> {
  return autocompleteAddress(query);
}

export async function reverseGeocodeAction(lat: number, lng: number): Promise<AddressPrediction | null> {
  return reverseGeocodeAddress(lat, lng);
}

export async function updateCustomerAction(id: string, input: UpdateCustomerInput): Promise<NexusCustomerDetail> {
  const before = await fetchCustomer(id).catch(() => null);
  const customer = await updateCustomer(id, input);
  revalidatePath(`/customers/${id}`);
  await logAudit({
    module: 'customer',
    action: 'UPDATE',
    entityId: id,
    entityLabel: [customer.firstName, customer.lastName].filter(Boolean).join(' ') || customer.phoneNo,
    before: before ? { ...before } : undefined,
    after: { ...customer },
  });
  return customer;
}

export async function createAddressAction(customerId: string, input: CustomerAddressInput): Promise<NexusCustomerAddress> {
  const address = await createCustomerAddress(customerId, input);
  revalidatePath(`/customers/${customerId}`);
  await logAudit({
    module: 'customer-address',
    action: 'CREATE',
    entityId: address.id,
    entityLabel: address.title || `${address.houseNo}, ${address.societyName}`,
    after: { ...address },
  });
  return address;
}

export async function updateAddressAction(
  customerId: string,
  addressId: string,
  input: Partial<CustomerAddressInput>,
): Promise<NexusCustomerAddress> {
  const beforeCustomer = await fetchCustomer(customerId).catch(() => null);
  const before = beforeCustomer?.addresses.find((a) => a.id === addressId) ?? null;
  const address = await updateCustomerAddress(customerId, addressId, input);
  revalidatePath(`/customers/${customerId}`);
  await logAudit({
    module: 'customer-address',
    action: 'UPDATE',
    entityId: addressId,
    entityLabel: address.title || `${address.houseNo}, ${address.societyName}`,
    before: before ? { ...before } : undefined,
    after: { ...address },
  });
  return address;
}

export async function archiveAddressAction(customerId: string, addressId: string): Promise<void> {
  await archiveCustomerAddress(customerId, addressId);
  revalidatePath(`/customers/${customerId}`);
  await logAudit({ module: 'customer-address', action: 'UPDATE', entityId: addressId, changes: { isDeleted: { old: false, new: true } } });
}

export async function restoreAddressAction(customerId: string, addressId: string): Promise<void> {
  await restoreCustomerAddress(customerId, addressId);
  revalidatePath(`/customers/${customerId}`);
  await logAudit({ module: 'customer-address', action: 'UPDATE', entityId: addressId, changes: { isDeleted: { old: true, new: false } } });
}

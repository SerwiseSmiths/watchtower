'use server';

import { revalidatePath } from 'next/cache';
import { setComplaintStage, linkDeviceToComplaint, assignProvider, respondToQuote, createComplaint, type CreateComplaintInput, type NexusComplaint } from '@/lib/nexus/complaints';
import { addDeviceForCustomer, listDevicesForCustomer, type DeviceKey, type NexusDeviceSummary } from '@/lib/nexus/devices';
import { listProviders, type NexusProvider } from '@/lib/nexus/providers';
import { fetchAllCustomers, fetchCustomer, type NexusCustomerListItem, type NexusCustomerDetail } from '@/lib/nexus/customers';

export async function bypassEntrance(complaintId: string) {
  await setComplaintStage(complaintId, 'QR_VALIDATED');
  revalidatePath('/tickets');
}

export interface AddApplianceInput {
  complaintId: string;
  customerId: string;
  addressId: string | null;
  deviceKey: DeviceKey;
  metadata: Record<string, unknown>;
}

/** Creates the device for the customer, then links it to this ticket — the same two
 *  effects a provider gets from radix's add-appliance flow followed by identifying
 *  the device on-site. */
export async function addAppliance(input: AddApplianceInput) {
  const device = await addDeviceForCustomer({
    targetUserId: input.customerId,
    deviceKey: input.deviceKey,
    addressId: input.addressId ?? undefined,
    metadata: input.metadata,
  });
  await linkDeviceToComplaint(input.complaintId, device.id, device.deviceKey);
  revalidatePath('/tickets');
}

export async function fetchCustomerDevices(customerId: string, deviceKey: DeviceKey): Promise<NexusDeviceSummary[]> {
  return listDevicesForCustomer(customerId, deviceKey);
}

export async function linkExistingAppliance(complaintId: string, deviceId: string, deviceKey: string) {
  await linkDeviceToComplaint(complaintId, deviceId, deviceKey);
  revalidatePath('/tickets');
}

export async function fetchProviders(search?: string): Promise<NexusProvider[]> {
  return listProviders(search);
}

export async function reassignProvider(complaintId: string, providerId: string) {
  await assignProvider(complaintId, providerId);
  revalidatePath('/tickets');
}

export async function respondToQuoteAction(complaintId: string, approved: boolean, rejectionReason?: string) {
  await respondToQuote(complaintId, approved, rejectionReason);
  revalidatePath('/tickets');
}

export async function searchCustomers(search?: string): Promise<NexusCustomerListItem[]> {
  return fetchAllCustomers(search);
}

export async function fetchCustomerDetail(customerId: string): Promise<NexusCustomerDetail> {
  return fetchCustomer(customerId);
}

export async function createTicketAction(input: CreateComplaintInput): Promise<NexusComplaint> {
  const complaint = await createComplaint(input);
  revalidatePath('/tickets');
  return complaint;
}

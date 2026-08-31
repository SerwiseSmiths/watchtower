'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { setComplaintStage, linkDeviceToComplaint, assignProvider, respondToQuote, createComplaint, reopenComplaint, type CreateComplaintInput, type NexusComplaint } from '@/lib/nexus/complaints';
import { addDeviceForCustomer, listDevicesForCustomer, type DeviceKey, type NexusDeviceSummary } from '@/lib/nexus/devices';
import { listProviders, type NexusProvider } from '@/lib/nexus/providers';
import { fetchAllCustomers, fetchCustomer, type NexusCustomerListItem, type NexusCustomerDetail } from '@/lib/nexus/customers';
import { logAudit } from '@/lib/audit/log';

export async function bypassEntrance(complaintId: string) {
  await setComplaintStage(complaintId, 'QR_VALIDATED');
  revalidatePath('/tickets');
  updateTag('complaints');
  await logAudit({ module: 'ticket', action: 'UPDATE', entityId: complaintId, changes: { stage: { old: 'ENTRANCE', new: 'QR_VALIDATED' } } });
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
  updateTag('complaints');
  await logAudit({ module: 'ticket', action: 'UPDATE', entityId: input.complaintId, changes: { device: { old: null, new: device.deviceKey } } });
}

export async function fetchCustomerDevices(customerId: string, deviceKey: DeviceKey): Promise<NexusDeviceSummary[]> {
  return listDevicesForCustomer(customerId, deviceKey);
}

export async function linkExistingAppliance(complaintId: string, deviceId: string, deviceKey: string) {
  await linkDeviceToComplaint(complaintId, deviceId, deviceKey);
  revalidatePath('/tickets');
  updateTag('complaints');
  await logAudit({ module: 'ticket', action: 'UPDATE', entityId: complaintId, changes: { device: { old: null, new: deviceKey } } });
}

export async function fetchProviders(search?: string): Promise<NexusProvider[]> {
  return listProviders(search);
}

export async function reassignProvider(complaintId: string, providerId: string) {
  await assignProvider(complaintId, providerId);
  revalidatePath('/tickets');
  updateTag('complaints');
  await logAudit({ module: 'ticket', action: 'UPDATE', entityId: complaintId, changes: { providerId: { old: null, new: providerId } } });
}

export async function respondToQuoteAction(complaintId: string, approved: boolean, rejectionReason?: string) {
  await respondToQuote(complaintId, approved, rejectionReason);
  revalidatePath('/tickets');
  updateTag('complaints');
  await logAudit({
    module: 'ticket',
    action: 'UPDATE',
    entityId: complaintId,
    changes: { quoteStatus: { old: 'PENDING', new: approved ? 'APPROVED' : 'REJECTED' }, ...(rejectionReason && { rejectionReason: { old: null, new: rejectionReason } }) },
  });
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
  updateTag('complaints');
  await logAudit({ module: 'ticket', action: 'CREATE', entityId: complaint.id, entityLabel: complaint.title, after: { ...complaint } });
  return complaint;
}

export async function cancelTicketAction(complaintId: string, reason?: string) {
  await setComplaintStage(complaintId, 'REJECTED', reason);
  revalidatePath('/tickets');
  updateTag('complaints');
  await logAudit({
    module: 'ticket',
    action: 'UPDATE',
    entityId: complaintId,
    changes: { stage: { old: null, new: 'REJECTED' }, ...(reason && { rejectionReason: { old: null, new: reason } }) },
  });
}

export async function reopenTicketAction(complaintId: string): Promise<NexusComplaint> {
  const complaint = await reopenComplaint(complaintId);
  revalidatePath('/tickets');
  updateTag('complaints');
  await logAudit({
    module: 'ticket',
    action: 'CREATE',
    entityId: complaint.id,
    entityLabel: complaint.title,
    after: { ...complaint, reopenedFromComplaintId: complaintId },
  });
  return complaint;
}

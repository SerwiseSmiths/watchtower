'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { setComplaintStage, linkDeviceToComplaint, assignProvider, respondToQuote, addQuote, createComplaint, reopenComplaint, nudgeComplaintOnWhatsApp, type CreateComplaintInput, type NexusComplaint, type AddQuoteItemInput } from '@/lib/nexus/complaints';
import { addDeviceForCustomer, listDevicesForCustomer, type DeviceKey, type NexusDeviceSummary } from '@/lib/nexus/devices';
import { listProviders, type NexusProvider } from '@/lib/nexus/providers';
import { fetchAllCustomers, fetchCustomer, type NexusCustomerListItem, type NexusCustomerDetail } from '@/lib/nexus/customers';
import { listParts, getPart, type NexusServicePart } from '@/lib/nexus/parts';
import { logAudit } from '@/lib/audit/log';
import { fetchWhatsAppStatus, startWhatsAppPairing, logoutWhatsApp, type WhatsAppStatus } from '@/lib/nexus/whatsapp';

export async function bypassEntrance(complaintId: string) {
  await setComplaintStage(complaintId, 'QR_VALIDATED');
  revalidatePath('/tickets');
  updateTag('complaints');
  await logAudit({ module: 'ticket', action: 'UPDATE', entityId: complaintId, changes: { stage: { old: 'ENTRANCE', new: 'QR_VALIDATED' } } });
}

// WhatsApp actions return results instead of throwing — production Next.js
// hides thrown server-action messages, and the UI needs nexus's actual reason
// (not connected, number not on WhatsApp, busy, …).
export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

// Lets nexusFetch's redirect-to-login (expired session) through instead of
// reporting it as an ordinary error.
const errorMessage = (err: unknown) => {
  unstable_rethrow(err);
  return err instanceof Error ? err.message : 'Something went wrong';
};

/** Nudges the customer on WhatsApp to track an open ticket in the app. Nexus owns
 *  the message, the closed-ticket check, and the actual WhatsApp send. */
export async function nudgeCustomerOnWhatsApp(complaintId: string): Promise<ActionResult & { notConnected?: boolean }> {
  try {
    await nudgeComplaintOnWhatsApp(complaintId);
  } catch (err) {
    const error = errorMessage(err);
    // Also covers the number being unlinked from the phone since the page loaded.
    const status = await fetchWhatsAppStatus().catch(() => null);
    return { ok: false, error, notConnected: status ? !status.connected : false };
  }
  revalidatePath('/tickets');
  updateTag('complaints');
  await logAudit({
    module: 'ticket',
    action: 'UPDATE',
    entityId: complaintId,
    changes: { whatsappNudge: { old: null, new: new Date().toISOString() } },
  });
  return { ok: true, data: null };
}

export async function getWhatsAppStatusAction(): Promise<ActionResult<WhatsAppStatus>> {
  try {
    return { ok: true, data: await fetchWhatsAppStatus() };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function startWhatsAppPairingAction(phone: string): Promise<ActionResult<{ code: string }>> {
  try {
    const code = await startWhatsAppPairing(phone);
    await logAudit({ module: 'whatsapp', action: 'UPDATE', entityId: 'sender', changes: { linkStarted: { old: null, new: phone } } });
    return { ok: true, data: { code } };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function logoutWhatsAppAction(): Promise<ActionResult> {
  try {
    const before = await fetchWhatsAppStatus().catch(() => null);
    await logoutWhatsApp();
    await logAudit({ module: 'whatsapp', action: 'UPDATE', entityId: 'sender', changes: { number: { old: before?.number ?? null, new: null } } });
    return { ok: true, data: null };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
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
  await linkDeviceToComplaint(input.complaintId, device.id);
  revalidatePath('/tickets');
  updateTag('complaints');
  await logAudit({ module: 'ticket', action: 'UPDATE', entityId: input.complaintId, changes: { device: { old: null, new: device.deviceKey } } });
}

export async function fetchCustomerDevices(customerId: string, deviceKey: DeviceKey): Promise<NexusDeviceSummary[]> {
  return listDevicesForCustomer(customerId, deviceKey);
}

export async function linkExistingAppliance(complaintId: string, deviceId: string, deviceKey: string) {
  await linkDeviceToComplaint(complaintId, deviceId);
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

export async function fetchServiceParts(deviceType?: string): Promise<NexusServicePart[]> {
  return listParts(deviceType);
}

export async function fetchServicePart(documentId: string): Promise<NexusServicePart | null> {
  return getPart(documentId);
}

export async function addQuoteAction(complaintId: string, items: AddQuoteItemInput[], notes?: string): Promise<NexusComplaint> {
  const complaint = await addQuote(complaintId, items, notes);
  revalidatePath('/tickets');
  updateTag('complaints');
  // Read the total nexus actually persisted, not what these items summed to
  // client-side — catalogue items get re-priced from the CMS server-side, so
  // the submitted total and the real one can differ.
  const totalAmount = complaint.quote?.totalAmount ?? items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  await logAudit({
    module: 'ticket',
    action: 'UPDATE',
    entityId: complaintId,
    changes: { quote: { old: null, new: totalAmount } },
  });
  return complaint;
}

export async function searchCustomers(search?: string): Promise<NexusCustomerListItem[]> {
  return fetchAllCustomers(search);
}

export async function fetchCustomerDetail(customerId: string): Promise<NexusCustomerDetail> {
  return fetchCustomer(customerId);
}

export async function createTicketAction(input: CreateComplaintInput): Promise<NexusComplaint[]> {
  const complaints = await createComplaint(input);
  revalidatePath('/tickets');
  updateTag('complaints');
  for (const complaint of complaints) {
    await logAudit({ module: 'ticket', action: 'CREATE', entityId: complaint.id, entityLabel: complaint.title, after: { ...complaint } });
  }
  return complaints;
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

import { nexusFetch } from './client';

export const DEVICE_KEYS = ['master_purifier', 'air_conditioner', 'fridge', 'washing_machine', 'geyser'] as const;
export type DeviceKey = (typeof DEVICE_KEYS)[number];

export interface NexusDeviceRecord {
  id: string;
  deviceKey: string;
  type: string;
}

export interface NexusDeviceSummary {
  id: string;
  deviceKey: string;
  type: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  address: { id: string; title: string | null; societyName: string } | null;
}

export interface AddDeviceForCustomerInput {
  targetUserId: string;
  deviceKey: DeviceKey;
  addressId?: string;
  metadata: Record<string, unknown>;
}

/** Creates a device owned by the customer, as ADMIN — the same endpoint radix's providers use
 *  (device.route.ts's /for-customer), just with ADMIN added alongside PROVIDER. */
export async function addDeviceForCustomer(input: AddDeviceForCustomerInput): Promise<NexusDeviceRecord> {
  const res = await nexusFetch('/device/for-customer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  const body = await res.json();
  return body.data.device as NexusDeviceRecord;
}

/** Lists a customer's existing devices of one type, as ADMIN — the same lookup radix's
 *  providers use to check for an already-registered appliance before adding a new one. */
export async function listDevicesForCustomer(customerId: string, deviceKey: DeviceKey): Promise<NexusDeviceSummary[]> {
  const res = await nexusFetch(`/device/customer/${customerId}?deviceKey=${deviceKey}`);
  const body = await res.json();
  return body.data.devices as NexusDeviceSummary[];
}

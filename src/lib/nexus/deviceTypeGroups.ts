import { nexusFetch } from './client';
import type { DeviceTypeKey } from './providers';

/** Admin-configurable grouping of device types serviced together by one provider — see
 *  DeviceTypeGroup in nexus's schema.prisma. Every DeviceType belongs to exactly one
 *  active group, even a standalone one (e.g. "Fridge" covering just FRIDGE). */
export interface NexusDeviceTypeGroup {
  // Stable slug auto-generated from `name` at creation time — the identifier
  // every consumer (including this app) uses to reference the group; the
  // internal DB id is never exposed.
  key: string;
  name: string;
  deviceTypes: DeviceTypeKey[];
  createdAt: string;
  updatedAt: string;
}

export interface DeviceTypeGroupInput {
  name: string;
  deviceTypes: DeviceTypeKey[];
}

export async function listDeviceTypeGroups(): Promise<NexusDeviceTypeGroup[]> {
  const res = await nexusFetch('/device-type-groups', {}, { tags: ['device-type-groups'] });
  const body = await res.json();
  return body.data.groups as NexusDeviceTypeGroup[];
}

export async function createDeviceTypeGroup(input: DeviceTypeGroupInput): Promise<NexusDeviceTypeGroup> {
  const res = await nexusFetch('/device-type-groups', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await res.json();
  return body.data.group as NexusDeviceTypeGroup;
}

export async function updateDeviceTypeGroup(key: string, input: Partial<DeviceTypeGroupInput>): Promise<NexusDeviceTypeGroup> {
  const res = await nexusFetch(`/device-type-groups/${key}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await res.json();
  return body.data.group as NexusDeviceTypeGroup;
}

export async function deleteDeviceTypeGroup(key: string): Promise<void> {
  await nexusFetch(`/device-type-groups/${key}`, { method: 'DELETE' });
}

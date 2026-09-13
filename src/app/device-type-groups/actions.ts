'use server';

import { revalidatePath, updateTag } from 'next/cache';
import {
  listDeviceTypeGroups,
  createDeviceTypeGroup,
  updateDeviceTypeGroup,
  deleteDeviceTypeGroup,
  type NexusDeviceTypeGroup,
  type DeviceTypeGroupInput,
} from '@/lib/nexus/deviceTypeGroups';
import { logAudit } from '@/lib/audit/log';

async function findGroup(key: string): Promise<NexusDeviceTypeGroup | null> {
  const groups = await listDeviceTypeGroups().catch(() => []);
  return groups.find((g) => g.key === key) ?? null;
}

export async function createDeviceTypeGroupAction(input: DeviceTypeGroupInput): Promise<NexusDeviceTypeGroup> {
  const group = await createDeviceTypeGroup(input);
  revalidatePath('/device-type-groups');
  updateTag('device-type-groups');
  await logAudit({ module: 'device-type-group', action: 'CREATE', entityId: group.key, entityLabel: group.name, after: { ...group } });
  return group;
}

export async function updateDeviceTypeGroupAction(key: string, input: Partial<DeviceTypeGroupInput>): Promise<NexusDeviceTypeGroup> {
  const before = await findGroup(key);
  const group = await updateDeviceTypeGroup(key, input);
  revalidatePath('/device-type-groups');
  updateTag('device-type-groups');
  await logAudit({
    module: 'device-type-group',
    action: 'UPDATE',
    entityId: key,
    entityLabel: group.name,
    before: before ? { ...before } : undefined,
    after: { ...group },
  });
  return group;
}

export async function deleteDeviceTypeGroupAction(key: string): Promise<void> {
  const before = await findGroup(key);
  await deleteDeviceTypeGroup(key);
  revalidatePath('/device-type-groups');
  updateTag('device-type-groups');
  await logAudit({
    module: 'device-type-group',
    action: 'DELETE',
    entityId: key,
    entityLabel: before?.name,
    before: before ? { ...before } : undefined,
  });
}

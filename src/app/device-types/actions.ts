'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { uploadToCloudinary } from '@/lib/media/cloudinary';
import { createEntity, updateEntity, deleteEntity } from '@/lib/db/entity-repository';

const DEVICE_TYPE_UID = 'api::device-type.device-type';

export interface DeviceTypeInput {
  key: string;
  label: string;
  icon?: number | null;
  buttonImage?: number | null;
  service_parts?: number[];
  subscription_addons?: number[];
}

export async function createDeviceTypeAction(input: DeviceTypeInput) {
  const entity = await createEntity(DEVICE_TYPE_UID, { ...input });
  revalidatePath('/device-types');
  return entity;
}

export async function updateDeviceTypeAction(id: number, input: Partial<DeviceTypeInput>) {
  const entity = await updateEntity(DEVICE_TYPE_UID, id, { ...input });
  revalidatePath('/device-types');
  return entity;
}

export async function deleteDeviceTypeAction(id: number) {
  await deleteEntity(DEVICE_TYPE_UID, id);
  revalidatePath('/device-types');
}

export interface UploadedImage {
  id: number;
  url: string;
  name: string;
}

/** Uploads a brand-new image straight to Cloudinary + the files table — used by the icon/button
 *  image pickers so an admin isn't limited to files already sitting in the Media Library. */
export async function uploadDeviceTypeImageAction(formData: FormData): Promise<UploadedImage> {
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) throw new Error('No file provided');

  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = file.type || 'application/octet-stream';
  const uploaded = await uploadToCloudinary(buffer, mime);
  const ext = file.name.includes('.') ? `.${file.name.split('.').pop()}` : null;

  const created = await prisma.files.create({
    data: {
      name: file.name,
      ext,
      mime,
      size: Math.round((uploaded.bytes / 1024) * 100) / 100,
      width: uploaded.width,
      height: uploaded.height,
      url: uploaded.url,
      provider: 'cloudinary',
      provider_metadata: { public_id: uploaded.publicId, resource_type: uploaded.resourceType },
      folder_path: '/',
      created_at: new Date(),
      updated_at: new Date(),
      published_at: new Date(),
    },
  });

  return { id: created.id, url: created.url ?? uploaded.url, name: created.name ?? file.name };
}

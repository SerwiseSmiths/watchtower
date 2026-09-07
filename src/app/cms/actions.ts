'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { uploadToCloudinary } from '@/lib/media/cloudinary';
import { createEntity, updateEntity, deleteEntity, findSingleType } from '@/lib/db/entity-repository';
import { BOTTOM_TAB_UID, COMPLAINT_PAGE_UID, GLOBAL_CONFIG_UID, WELCOME_BONUS_UID, PAGE_UID } from './content-types';

async function saveSingleType(uid: string, data: Record<string, unknown>) {
  const existing = await findSingleType(uid, { status: 'draft' });
  const saved = existing ? await updateEntity(uid, existing.id as number, data) : await createEntity(uid, data);
  revalidatePath('/cms');
  return saved;
}

export async function saveBottomTabAction(data: Record<string, unknown>) {
  return saveSingleType(BOTTOM_TAB_UID, data);
}

export async function saveComplaintPageAction(data: Record<string, unknown>) {
  return saveSingleType(COMPLAINT_PAGE_UID, data);
}

export async function saveGlobalConfigAction(data: Record<string, unknown>) {
  return saveSingleType(GLOBAL_CONFIG_UID, data);
}

export async function saveWelcomeBonusAction(data: Record<string, unknown>) {
  return saveSingleType(WELCOME_BONUS_UID, data);
}

export async function createPageAction(data: Record<string, unknown>) {
  const created = await createEntity(PAGE_UID, data);
  revalidatePath('/cms');
  return created;
}

export async function updatePageAction(id: number, data: Record<string, unknown>) {
  const updated = await updateEntity(PAGE_UID, id, data);
  revalidatePath('/cms');
  return updated;
}

export async function deletePageAction(id: number) {
  await deleteEntity(PAGE_UID, id);
  revalidatePath('/cms');
}

export interface UploadedImage {
  id: number;
  url: string;
  name: string;
}

export async function uploadCmsImageAction(formData: FormData): Promise<UploadedImage> {
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

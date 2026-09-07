'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { deleteFromCloudinary, uploadToCloudinary } from '@/lib/media/cloudinary';

export async function uploadMediaAction(formData: FormData) {
  const files = formData.getAll('files') as File[];
  const folderIdRaw = formData.get('folderId');
  const folderId = typeof folderIdRaw === 'string' && folderIdRaw ? Number.parseInt(folderIdRaw, 10) : null;

  for (const file of files) {
    if (!(file instanceof File) || file.size === 0) continue;
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

    if (folderId != null) {
      await prisma.files_folder_lnk.create({ data: { file_id: created.id, folder_id: folderId } });
    }
  }

  revalidatePath('/admin/media-library');
}

export async function updateMediaAction(
  id: number,
  data: { name: string; alternativeText: string; caption: string },
) {
  await prisma.files.update({
    where: { id },
    data: {
      name: data.name,
      alternative_text: data.alternativeText || null,
      caption: data.caption || null,
      updated_at: new Date(),
    },
  });
  revalidatePath('/admin/media-library');
}

export interface DeleteMediaResult {
  deletedIds: number[];
  blockedIds: number[];
}

/** Refuses to delete a file that's still referenced by any entity, matching Strapi's real
 * "this asset is being used" guard rather than silently breaking existing content. */
export async function deleteMediaAction(ids: number[]): Promise<DeleteMediaResult> {
  const deletedIds: number[] = [];
  const blockedIds: number[] = [];

  for (const id of ids) {
    const usageCount = await prisma.files_related_mph.count({ where: { file_id: id } });
    if (usageCount > 0) {
      blockedIds.push(id);
      continue;
    }
    const file = await prisma.files.findUnique({ where: { id } });
    if (file?.provider === 'cloudinary' && file.provider_metadata) {
      const meta = file.provider_metadata as { public_id?: string; resource_type?: string };
      if (meta.public_id) {
        try {
          await deleteFromCloudinary(meta.public_id, meta.resource_type ?? 'image');
        } catch {
          // Cloudinary asset already gone / unreachable — still remove the DB row below.
        }
      }
    }
    await prisma.files_folder_lnk.deleteMany({ where: { file_id: id } });
    await prisma.files.delete({ where: { id } });
    deletedIds.push(id);
  }

  revalidatePath('/admin/media-library');
  return { deletedIds, blockedIds };
}

export async function createFolderAction(name: string) {
  const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'folder';
  await prisma.upload_folders.create({
    data: {
      name,
      path: `/${slug}-${Math.floor(Math.random() * 1e9)}`,
      created_at: new Date(),
      updated_at: new Date(),
      published_at: new Date(),
    },
  });
  revalidatePath('/admin/media-library');
}

/** Files inside the folder are unlinked (become root-level), not deleted — matches Strapi's own
 * "delete folder" behavior of never taking assets down with it. */
export async function deleteFolderAction(id: number) {
  await prisma.files_folder_lnk.deleteMany({ where: { folder_id: id } });
  await prisma.upload_folders.delete({ where: { id } });
  revalidatePath('/admin/media-library');
}

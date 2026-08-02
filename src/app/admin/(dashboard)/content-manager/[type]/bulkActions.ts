'use server';

import { revalidatePath } from 'next/cache';
import { resolveContentTypeSlug } from '@/lib/content-schema/registry';
import { deleteEntity, findEntityByDocumentId, publishEntity, unpublishEntity } from '@/lib/db/entity-repository';

async function resolveDraftId(schemaUid: string, documentId: string): Promise<number | undefined> {
  const entity = await findEntityByDocumentId(schemaUid, documentId, { status: 'draft' });
  return entity?.id as number | undefined;
}

async function forEachEntity(slug: string, documentIds: string[], action: (uid: string, id: number) => Promise<unknown>) {
  const schema = resolveContentTypeSlug(slug);
  if (!schema) throw new Error(`Unknown content type "${slug}"`);
  for (const documentId of documentIds) {
    const id = await resolveDraftId(schema.uid, documentId);
    if (id != null) await action(schema.uid, id);
  }
  revalidatePath(`/admin/content-manager/${slug}`);
}

export async function bulkDeleteAction(slug: string, documentIds: string[]) {
  await forEachEntity(slug, documentIds, deleteEntity);
}

export async function bulkPublishAction(slug: string, documentIds: string[]) {
  await forEachEntity(slug, documentIds, publishEntity);
}

export async function bulkUnpublishAction(slug: string, documentIds: string[]) {
  await forEachEntity(slug, documentIds, unpublishEntity);
}

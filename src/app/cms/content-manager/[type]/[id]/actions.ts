'use server';

import { revalidatePath } from 'next/cache';
import { requireRootSession } from '@/lib/auth/require-root-session';
import { ensureSchemaRegistry } from '@/lib/content-schema/registry';
import {
  createEntity,
  deleteEntity,
  duplicateEntity,
  findEntityByDocumentId,
  findSingleType,
  publishEntity,
  unpublishEntity,
  updateEntity,
} from '@/lib/db/entity-repository';
import { resolveCmsContentTypeSlug } from '../../../content-types';

async function resolveExistingId(slug: string, id: string): Promise<number | null> {
  const schema = resolveCmsContentTypeSlug(slug);
  if (!schema) throw new Error('Unknown content type');
  if (schema.kind === 'singleType') {
    const existing = await findSingleType(schema.uid, { status: 'draft' });
    return (existing?.id as number) ?? null;
  }
  const existing = await findEntityByDocumentId(schema.uid, id, { status: 'draft' });
  return (existing?.id as number) ?? null;
}

export async function saveEntityAction(slug: string, id: string, data: Record<string, unknown>) {
  await requireRootSession();
  await ensureSchemaRegistry();
  const schema = resolveCmsContentTypeSlug(slug);
  if (!schema) throw new Error('Unknown content type');

  const existingId = id === 'new' ? null : await resolveExistingId(slug, id);
  const saved = existingId != null ? await updateEntity(schema.uid, existingId, data) : await createEntity(schema.uid, data);

  const path = schema.kind === 'singleType' ? `/cms/content-manager/${slug}/edit` : `/cms/content-manager/${slug}/${saved!.documentId}`;
  revalidatePath(path);
  return { documentId: saved!.documentId as string };
}

export async function publishEntityAction(slug: string, id: string) {
  await requireRootSession();
  await ensureSchemaRegistry();
  const schema = resolveCmsContentTypeSlug(slug);
  if (!schema) throw new Error('Unknown content type');
  const existingId = await resolveExistingId(slug, id);
  if (existingId == null) throw new Error('Entity not found');
  await publishEntity(schema.uid, existingId);
  revalidatePath(`/cms/content-manager/${slug}/${schema.kind === 'singleType' ? 'edit' : id}`);
}

export async function unpublishEntityAction(slug: string, id: string) {
  await requireRootSession();
  await ensureSchemaRegistry();
  const schema = resolveCmsContentTypeSlug(slug);
  if (!schema) throw new Error('Unknown content type');
  const existingId = await resolveExistingId(slug, id);
  if (existingId == null) throw new Error('Entity not found');
  await unpublishEntity(schema.uid, existingId);
  revalidatePath(`/cms/content-manager/${slug}/${schema.kind === 'singleType' ? 'edit' : id}`);
}

export async function deleteEntityAction(slug: string, id: string) {
  await requireRootSession();
  await ensureSchemaRegistry();
  const schema = resolveCmsContentTypeSlug(slug);
  if (!schema) throw new Error('Unknown content type');
  const existingId = await resolveExistingId(slug, id);
  if (existingId == null) throw new Error('Entity not found');
  await deleteEntity(schema.uid, existingId);
  revalidatePath(`/cms/content-manager/${slug}`);
}

/** Only meaningful for collectionType entries — singleTypes have exactly one logical entity. */
export async function duplicateEntityAction(slug: string, documentId: string) {
  await requireRootSession();
  await ensureSchemaRegistry();
  const schema = resolveCmsContentTypeSlug(slug);
  if (!schema) throw new Error('Unknown content type');
  const duplicated = await duplicateEntity(schema.uid, documentId);
  revalidatePath(`/cms/content-manager/${slug}`);
  return { documentId: duplicated!.documentId as string };
}

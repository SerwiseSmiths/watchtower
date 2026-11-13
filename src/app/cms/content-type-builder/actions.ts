'use server';

import { revalidatePath } from 'next/cache';
import { requireRootSession } from '@/lib/auth/require-root-session';
import { prisma } from '@/lib/db/prisma';
import { applySchemaPlan, isSchemaEditingEnabled } from '@/lib/content-schema/apply';
import { componentCollectionName, findReferences, planSchemaChange, SchemaValidationError, snake } from '@/lib/content-schema/ddl';
import type { RawComponentSchema, RawSchema } from '@/lib/content-schema/loader';
import { ensureSchemaRegistry, getRegistrySnapshot } from '@/lib/content-schema/registry';
import { contentTypeUid, type RegistrySnapshot } from '@/lib/content-schema/store';
import { isCmsContentType, protectedComponentUids } from '../content-types';

export type SchemaEdit =
  | { kind: 'saveContentType'; isNew: boolean; schema: RawSchema }
  | { kind: 'deleteContentType'; uid: string }
  | { kind: 'saveComponent'; isNew: boolean; uid: string; schema: RawComponentSchema }
  | { kind: 'deleteComponent'; uid: string };

export type SchemaEditResult =
  | { ok: true; changes: { description: string; destructive: boolean }[] }
  | { ok: false; error: string };

const COMPONENT_UID = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/;
const API_NAME = /^[a-z][a-z0-9-]*$/;

function fail(message: string): never {
  throw new SchemaValidationError(message);
}

function nextSnapshot(before: RegistrySnapshot, edit: SchemaEdit): { after: RegistrySnapshot; uid?: string } {
  switch (edit.kind) {
    case 'saveContentType': {
      const { info } = edit.schema;
      if (!API_NAME.test(info.singularName) || !API_NAME.test(info.pluralName)) fail('API IDs must be lowercase letters, digits and dashes, starting with a letter');
      if (info.singularName === info.pluralName) fail('The singular and plural API IDs must be different');
      if (!info.displayName.trim()) fail('Display name is required');
      const uid = contentTypeUid(edit.schema);
      const existing = before.contentTypes.find((c) => contentTypeUid(c) === uid);
      if (edit.isNew) {
        if (existing) fail(`A content type with the API ID "${info.singularName}" already exists`);
        if (before.contentTypes.some((c) => c.info.pluralName === info.pluralName || c.info.singularName === info.pluralName)) {
          fail(`The plural API ID "${info.pluralName}" is already used`);
        }
        const schema: RawSchema = { ...edit.schema, collectionName: snake(info.pluralName) };
        return { after: { ...before, contentTypes: [...before.contentTypes, schema] }, uid };
      }
      if (!existing) fail('That content type no longer exists');
      if (!isCmsContentType(uid)) fail('Core data types are managed on the Pricing / Device Types screens');
      // Table, kind, API IDs and draft & publish are fixed once created — only info + fields change.
      const schema: RawSchema = {
        ...existing,
        info: { ...existing.info, displayName: info.displayName, description: info.description },
        attributes: edit.schema.attributes,
      };
      return { after: { ...before, contentTypes: before.contentTypes.map((c) => (contentTypeUid(c) === uid ? schema : c)) }, uid };
    }
    case 'deleteContentType': {
      if (!isCmsContentType(edit.uid)) fail('Core data types cannot be deleted here');
      const refs = findReferences(before, edit.uid);
      if (refs.length) fail(`Still used by: ${refs.join(', ')}. Remove those fields first.`);
      return { after: { ...before, contentTypes: before.contentTypes.filter((c) => contentTypeUid(c) !== edit.uid) } };
    }
    case 'saveComponent': {
      if (!COMPONENT_UID.test(edit.uid)) fail('Component category and name must be lowercase letters, digits and dashes');
      if (!edit.schema.info.displayName.trim()) fail('Display name is required');
      if (protectedComponentUids(before).has(edit.uid)) fail('This component belongs to core data and is managed in code');
      const existing = before.components.find((c) => c.uid === edit.uid);
      if (edit.isNew) {
        if (existing) fail(`The component ${edit.uid} already exists`);
        const schema: RawComponentSchema = { ...edit.schema, collectionName: componentCollectionName(edit.uid) };
        return { after: { ...before, components: [...before.components, { uid: edit.uid, schema }] }, uid: edit.uid };
      }
      if (!existing) fail('That component no longer exists');
      const schema: RawComponentSchema = { ...existing.schema, info: { ...existing.schema.info, ...edit.schema.info }, attributes: edit.schema.attributes };
      return { after: { ...before, components: before.components.map((c) => (c.uid === edit.uid ? { uid: c.uid, schema } : c)) }, uid: edit.uid };
    }
    case 'deleteComponent': {
      if (protectedComponentUids(before).has(edit.uid)) fail('This component belongs to core data and is managed in code');
      const refs = findReferences(before, edit.uid);
      if (refs.length) fail(`Still used by: ${refs.join(', ')}. Remove those fields first.`);
      return { after: { ...before, components: before.components.filter((c) => c.uid !== edit.uid) } };
    }
  }
}

/** All pending edits (the type on screen plus any components edited inline) are folded into one
 *  target schema, so they're planned and applied together in a single transaction — like Strapi's
 *  builder, where one Save covers every changed type and component. */
async function prepare(edits: SchemaEdit[]) {
  await requireRootSession();
  if (!isSchemaEditingEnabled()) fail('Schema editing is disabled in this environment. Make the change on dev, then run `yarn cms:sync-schema`.');
  if (edits.length === 0) fail('Nothing to save');
  await ensureSchemaRegistry({ force: true });
  const before = getRegistrySnapshot();
  if (before.source !== 'db') fail('The schema registry tables are missing on this database — apply prisma/manual-migrations/0004_cms_schema_registry.sql first.');
  let after = before;
  for (const edit of edits) after = nextSnapshot(after, edit).after;
  return { before, plan: planSchemaChange(before, after) };
}

function toResult(err: unknown): SchemaEditResult {
  if (err instanceof SchemaValidationError) return { ok: false, error: err.message };
  console.error('[content-type-builder]', err);
  return { ok: false, error: err instanceof Error ? err.message : 'Something went wrong' };
}

/** Dry run: what the save would do, for the confirmation dialog. Nothing is written. */
export async function previewSchemaEditAction(edits: SchemaEdit[]): Promise<SchemaEditResult> {
  try {
    const { plan } = await prepare(edits);
    return { ok: true, changes: plan.changes.map(({ description, destructive }) => ({ description, destructive })) };
  } catch (err) {
    return toResult(err);
  }
}

export async function applySchemaEditAction(edits: SchemaEdit[]): Promise<SchemaEditResult> {
  try {
    const { before, plan } = await prepare(edits);
    await applySchemaPlan(prisma, before, plan);
    await ensureSchemaRegistry({ force: true });
    revalidatePath('/cms', 'layout');
    return { ok: true, changes: plan.changes.map(({ description, destructive }) => ({ description, destructive })) };
  } catch (err) {
    return toResult(err);
  }
}

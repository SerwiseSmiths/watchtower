import { prisma } from '../db/prisma';
import { toComponentSchema, toContentTypeSchema, type RawComponentSchema, type RawSchema } from './loader';
import { readSchemaVersion, readSnapshot, staticSnapshot, type RegistrySnapshot } from './store';
import type { ComponentSchema, ContentTypeSchema, RelationTableMap } from './types';

/**
 * Content-type registry. Schemas live in the DB (see store.ts) so the Content-Type Builder can add
 * and change types at runtime; every serverless instance keeps a normalized in-memory copy and
 * re-checks `watchtower_cms_schema_state.version` at most every CHECK_INTERVAL_MS.
 *
 * Getters are synchronous, so every entry point (page, server action, route handler) must
 * `await ensureSchemaRegistry()` first. entity-repository's exported functions do it themselves.
 * Before the first load (or on a DB without the registry tables) the getters fall back to the
 * static schemas in `content-schemas/`.
 */

const CHECK_INTERVAL_MS = 2_000;

interface Registry {
  snapshot: RegistrySnapshot;
  contentTypes: ContentTypeSchema[];
  contentTypesByUid: Map<string, ContentTypeSchema>;
  components: ComponentSchema[];
  componentsByUid: Map<string, ComponentSchema>;
}

function build(snapshot: RegistrySnapshot): Registry {
  const contentTypes = snapshot.contentTypes.map(toContentTypeSchema);
  const components = snapshot.components.map(({ uid, schema }) => toComponentSchema(uid, schema));
  return {
    snapshot,
    contentTypes,
    contentTypesByUid: new Map(contentTypes.map((c) => [c.uid, c])),
    components,
    componentsByUid: new Map(components.map((c) => [c.uid, c])),
  };
}

let registry: Registry | null = null;
let lastCheckedAt = 0;
let inflight: Promise<void> | null = null;

function current(): Registry {
  return (registry ??= build(staticSnapshot()));
}

async function refresh(): Promise<void> {
  const version = await readSchemaVersion(prisma);
  if (version == null) {
    if (registry?.snapshot.source !== 'static') registry = build(staticSnapshot());
  } else if (!registry || registry.snapshot.source !== 'db' || registry.snapshot.version !== version) {
    const snapshot = await readSnapshot(prisma);
    registry = build(snapshot ?? staticSnapshot());
  }
  lastCheckedAt = Date.now();
}

export async function ensureSchemaRegistry(options: { force?: boolean } = {}): Promise<void> {
  if (!options.force && registry && Date.now() - lastCheckedAt < CHECK_INTERVAL_MS) return;
  inflight ??= refresh().finally(() => {
    inflight = null;
  });
  await inflight;
}

/** Raw (Strapi schema.json shaped) definitions — what the Content-Type Builder edits and saves. */
export function getRegistrySnapshot(): RegistrySnapshot {
  return current().snapshot;
}

export function getRawContentType(uid: string): RawSchema | undefined {
  return current().snapshot.contentTypes.find((c) => `api::${c.info.singularName}.${c.info.singularName}` === uid);
}

export function getRawComponent(uid: string): RawComponentSchema | undefined {
  return current().snapshot.components.find((c) => c.uid === uid)?.schema;
}

export function getContentType(uid: string): ContentTypeSchema {
  const schema = current().contentTypesByUid.get(uid);
  if (!schema) throw new Error(`Unknown content-type uid: ${uid}`);
  return schema;
}

export function findContentType(uid: string): ContentTypeSchema | undefined {
  return current().contentTypesByUid.get(uid);
}

export function getContentTypeByPluralName(pluralName: string): ContentTypeSchema | undefined {
  return current().contentTypes.find((c) => c.pluralName === pluralName);
}

export function getContentTypeBySingularName(singularName: string): ContentTypeSchema | undefined {
  return current().contentTypes.find((c) => c.singularName === singularName);
}

/** Resolves a URL slug to its content type — plural name for collection types, singular for single types. */
export function resolveContentTypeSlug(slug: string): ContentTypeSchema | null {
  const collection = getContentTypeByPluralName(slug);
  if (collection?.kind === 'collectionType') return collection;
  const single = getContentTypeBySingularName(slug);
  if (single?.kind === 'singleType') return single;
  return null;
}

export function slugForContentType(schema: ContentTypeSchema): string {
  return schema.kind === 'collectionType' ? schema.pluralName : schema.singularName;
}

export function getComponent(uid: string): ComponentSchema {
  const schema = current().componentsByUid.get(uid);
  if (!schema) throw new Error(`Unknown component uid: ${uid}`);
  return schema;
}

export function allContentTypes(): ContentTypeSchema[] {
  return current().contentTypes;
}

export function allComponents(): ComponentSchema[] {
  return current().components;
}

export function getSchemaVersion(): number {
  return current().snapshot.version;
}

/** The `<collectionName>_cmps` polymorphic link table Strapi creates for any content-type/component with component or dynamiczone fields. */
export function cmpsTableName(collectionName: string): string {
  return `${collectionName}_cmps`;
}

export function getRelationTable(ownerUid: string, attributeName: string): RelationTableMap {
  const key = `${ownerUid}.${attributeName}`;
  const table = current().snapshot.relationTables[key];
  if (!table) throw new Error(`No relation table mapping for ${key}`);
  return table;
}

/** camelCase -> snake_case, matching how Strapi derives Postgres column names from attribute keys. */
export function toColumnName(attributeName: string): string {
  return attributeName.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

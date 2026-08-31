import { randomBytes } from 'crypto';
import { prisma } from './prisma';
import { cmpsTableName, getComponent, getContentType, getRelationTable, toColumnName } from '../content-schema/registry';
import type { ContentTypeSchema, FieldSchema } from '../content-schema/types';
import { logAudit } from '@/lib/audit/log';

type Row = Record<string, unknown>;
type PrismaModel = {
  findMany: (args?: unknown) => Promise<Row[]>;
  findUnique: (args?: unknown) => Promise<Row | null>;
  count: (args?: unknown) => Promise<number>;
  create: (args: { data: Row }) => Promise<Row>;
  update: (args: { where: { id: number }; data: Row }) => Promise<Row>;
  delete: (args: { where: { id: number } }) => Promise<Row>;
  deleteMany: (args: { where: Row }) => Promise<{ count: number }>;
};

const prismaAny = prisma as unknown as Record<string, PrismaModel>;

/**
 * Caps the number of Prisma queries in flight at once, regardless of how deeply nested
 * the call site is (a single content-type row can fan out into many queries — media,
 * components, and each component's own relations). Two failure modes without this:
 *   - Unbounded concurrency (plain Promise.all) blows past the DB's connection_limit and
 *     the pool times out (P2024) once a content type has more than a handful of rows
 *     with relations/media.
 *   - Full serialization (one query at a time) avoids that crash but is extremely slow
 *     against a remote pooled DB (Neon) where every round trip pays real network
 *     latency — a page hydrating dozens of rows this way can take over a minute.
 * A small concurrency cap gets real parallelism back while staying under the pool limit.
 */
class Semaphore {
  private active = 0;
  private queue: (() => void)[] = [];

  constructor(private readonly limit: number) {}

  async acquire(): Promise<() => void> {
    if (this.active < this.limit) {
      this.active++;
      return () => this.release();
    }
    return new Promise((resolve) => {
      this.queue.push(() => {
        this.active++;
        resolve(() => this.release());
      });
    });
  }

  private release() {
    this.active--;
    const next = this.queue.shift();
    if (next) next();
  }
}

// One less than the DB's connection_limit (5) — leaves headroom for a concurrent
// unrelated request on the same serverless instance.
const dbSemaphore = new Semaphore(4);

async function withDbLimit<T>(fn: () => Promise<T>): Promise<T> {
  const release = await dbSemaphore.acquire();
  try {
    return await fn();
  } finally {
    release();
  }
}

function model(tableName: string): PrismaModel {
  const m = prismaAny[tableName];
  if (!m) throw new Error(`No Prisma model for table "${tableName}" — did you run \`yarn prisma:pull\`?`);
  return {
    findMany: (args) => withDbLimit(() => m.findMany(args)),
    findUnique: (args) => withDbLimit(() => m.findUnique(args)),
    count: (args) => withDbLimit(() => m.count(args)),
    create: (args) => withDbLimit(() => m.create(args)),
    update: (args) => withDbLimit(() => m.update(args)),
    delete: (args) => withDbLimit(() => m.delete(args)),
    deleteMany: (args) => withDbLimit(() => m.deleteMany(args)),
  };
}

async function hydrateMedia(ownerUid: string, ownerId: number, fieldName: string, multiple: boolean) {
  const links = await model('files_related_mph').findMany({
    where: { related_id: ownerId, related_type: ownerUid, field: fieldName },
    orderBy: { order: 'asc' },
  });
  const fileIds = links.map((l) => l.file_id as number | null).filter((id): id is number => id != null);
  if (fileIds.length === 0) return multiple ? [] : null;
  const files = await model('files').findMany({ where: { id: { in: fileIds } } });
  const filesById = new Map(files.map((f) => [f.id as number, f]));
  const ordered = fileIds.map((id) => filesById.get(id)).filter((f): f is Row => !!f);
  return multiple ? ordered : (ordered[0] ?? null);
}

async function hydrateComponentField(
  ownerCollectionName: string,
  ownerId: number,
  fieldName: string,
  componentUid: string,
  repeatable: boolean,
) {
  const links = await model(cmpsTableName(ownerCollectionName)).findMany({
    where: { entity_id: ownerId, field: fieldName },
    orderBy: { order: 'asc' },
  });
  const component = getComponent(componentUid);
  const ids = links.map((l) => l.cmp_id as number | null).filter((id): id is number => id != null);
  if (ids.length === 0) return repeatable ? [] : null;
  const rows = await model(component.collectionName).findMany({ where: { id: { in: ids } } });
  const rowsById = new Map(rows.map((r) => [r.id as number, r]));
  const ordered = ids.map((id) => rowsById.get(id)).filter((r): r is Row => !!r);
  const hydrated = await Promise.all(
    ordered.map((row) => hydrateAttributes(componentUid, component.collectionName, row, component.attributes)),
  );
  return repeatable ? hydrated : (hydrated[0] ?? null);
}

async function hydrateDynamicZone(ownerCollectionName: string, ownerId: number, fieldName: string) {
  const links = await model(cmpsTableName(ownerCollectionName)).findMany({
    where: { entity_id: ownerId, field: fieldName },
    orderBy: { order: 'asc' },
  });
  const results: Row[] = [];
  for (const link of links) {
    const cmpId = link.cmp_id as number | null;
    const componentType = link.component_type as string | null;
    if (cmpId == null || !componentType) continue;
    const component = getComponent(componentType);
    const row = await model(component.collectionName).findUnique({ where: { id: cmpId } });
    if (!row) continue;
    const hydrated = await hydrateAttributes(componentType, component.collectionName, row, component.attributes);
    results.push({ __component: componentType, ...hydrated });
  }
  return results;
}

function shallowScalars(row: Row, attributes: Record<string, FieldSchema>): Row {
  const result: Row = {
    id: row.id,
    documentId: row.document_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
  };
  for (const [name, field] of Object.entries(attributes)) {
    if (field.kind !== 'scalar') continue;
    const raw = row[toColumnName(name)];
    result[name] = field.type === 'decimal' && raw != null ? Number(raw) : raw;
  }
  return result;
}

/** Reverse-looks-up which owner rows are linked to a given target id — used by the list view's
 * relation filter ("device type is X") without needing a real Prisma relation defined on the
 * hand-curated `_lnk` tables. */
export async function findOwnerIdsByRelationTarget(ownerUid: string, fieldName: string, targetId: number): Promise<number[]> {
  const map = getRelationTable(ownerUid, fieldName);
  const links = await model(map.table).findMany({ where: { [map.targetColumn]: targetId } });
  return links.map((l) => l[map.ownerColumn] as number | null).filter((id): id is number => id != null);
}

async function hydrateRelation(ownerUid: string, ownerId: number, fieldName: string, targetUid: string) {
  const map = getRelationTable(ownerUid, fieldName);
  const orderBy = map.targetOrderColumn ? { orderBy: { [map.targetOrderColumn]: 'asc' } } : {};
  const links = await model(map.table).findMany({ where: { [map.ownerColumn]: ownerId }, ...orderBy });
  const targetIds = links.map((l) => l[map.targetColumn] as number | null).filter((id): id is number => id != null);
  if (targetIds.length === 0) return [];
  const targetType = getContentType(targetUid);
  const rows = await model(targetType.collectionName).findMany({ where: { id: { in: targetIds } } });
  const rowsById = new Map(rows.map((r) => [r.id as number, r]));
  const ordered = targetIds.map((id) => rowsById.get(id)).filter((r): r is Row => !!r);
  return ordered.map((row) => shallowScalars(row, targetType.attributes));
}

/**
 * Resolves every attribute on a content-type or component row into its
 * business-level shape: scalars re-keyed from their snake_case DB column to
 * the schema's attribute name, media resolved via `files_related_mph`,
 * components/dynamic zones via `<table>_cmps`, relations via the curated
 * `_lnk` table map. Works identically for content types and components since
 * both use the same underlying link-table conventions.
 */
export async function hydrateAttributes(
  ownerUid: string,
  collectionName: string,
  row: Row,
  attributes: Record<string, FieldSchema>,
): Promise<Row> {
  const hydrated: Row = {
    id: row.id,
    documentId: row.document_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
  };
  for (const [name, field] of Object.entries(attributes)) {
    switch (field.kind) {
      case 'scalar': {
        const raw = row[toColumnName(name)];
        // Prisma's `decimal` columns come back as Decimal.js instances, which aren't plain
        // serializable values (React Flight/RSC rejects them when passed to a Client Component,
        // unlike JSON.stringify which silently calls toJSON() on them via the REST/GraphQL routes).
        hydrated[name] = field.type === 'decimal' && raw != null ? Number(raw) : raw;
        break;
      }
      case 'media':
        hydrated[name] = await hydrateMedia(ownerUid, row.id as number, name, field.multiple);
        break;
      case 'component':
        hydrated[name] = await hydrateComponentField(collectionName, row.id as number, name, field.component, field.repeatable);
        break;
      case 'dynamiczone':
        hydrated[name] = await hydrateDynamicZone(collectionName, row.id as number, name);
        break;
      case 'relation':
        hydrated[name] = await hydrateRelation(ownerUid, row.id as number, name, field.target);
        break;
    }
  }
  return hydrated;
}

/**
 * Same output shape as calling `hydrateAttributes` once per row, but batched across every
 * row in a list: media and relation fields each cost exactly 2 queries total (one link-table
 * lookup with `owner IN (...)`, one target lookup with `id IN (...)`) instead of 2 queries
 * PER ROW. This is what a list of any real size needs — `hydrateAttributes` fans out
 * correctly, but it's an N+1: 174 service parts each pulling their own `device_types`
 * relation was ~350 separate round trips to a remote pooled DB (Neon), which is what made
 * `/pricing` take 13+ seconds even with the connection-pool semaphore in place (that capped
 * concurrency so it didn't crash, but did nothing about the query COUNT).
 * Component/dynamiczone fields aren't batched here (their own nested attributes can include
 * further relations, e.g. a repeatable component's own relation field, which would need
 * another layer of batching) — those still hydrate per-row, bounded by the same semaphore.
 */
async function hydrateAttributesForRows(
  ownerUid: string,
  collectionName: string,
  rows: Row[],
  attributes: Record<string, FieldSchema>,
): Promise<Row[]> {
  if (rows.length === 0) return [];

  const rowIds = rows.map((r) => r.id as number);
  const byId = new Map<number, Row>(
    rows.map((row) => [
      row.id as number,
      { id: row.id, documentId: row.document_id, createdAt: row.created_at, updatedAt: row.updated_at, publishedAt: row.published_at },
    ]),
  );

  for (const [name, field] of Object.entries(attributes)) {
    if (field.kind === 'scalar') {
      for (const row of rows) {
        const raw = row[toColumnName(name)];
        byId.get(row.id as number)![name] = field.type === 'decimal' && raw != null ? Number(raw) : raw;
      }
      continue;
    }

    if (field.kind === 'media') {
      const links = await model('files_related_mph').findMany({
        where: { related_id: { in: rowIds }, related_type: ownerUid, field: name },
        orderBy: { order: 'asc' },
      });
      const fileIds = [...new Set(links.map((l) => l.file_id as number | null).filter((id): id is number => id != null))];
      const files = fileIds.length ? await model('files').findMany({ where: { id: { in: fileIds } } }) : [];
      const filesById = new Map(files.map((f) => [f.id as number, f]));
      const linksByOwner = new Map<number, Row[]>();
      for (const link of links) {
        const ownerId = link.related_id as number;
        (linksByOwner.get(ownerId) ?? linksByOwner.set(ownerId, []).get(ownerId)!).push(link);
      }
      for (const row of rows) {
        const ownerLinks = linksByOwner.get(row.id as number) ?? [];
        const ordered = ownerLinks.map((l) => filesById.get(l.file_id as number)).filter((f): f is Row => !!f);
        byId.get(row.id as number)![name] = field.multiple ? ordered : (ordered[0] ?? null);
      }
      continue;
    }

    if (field.kind === 'relation') {
      const map = getRelationTable(ownerUid, name);
      const links = await model(map.table).findMany({
        where: { [map.ownerColumn]: { in: rowIds } },
        ...(map.targetOrderColumn ? { orderBy: { [map.targetOrderColumn]: 'asc' as const } } : {}),
      });
      const targetIds = [...new Set(links.map((l) => l[map.targetColumn] as number | null).filter((id): id is number => id != null))];
      const targetType = getContentType(field.target);
      const targets = targetIds.length ? await model(targetType.collectionName).findMany({ where: { id: { in: targetIds } } }) : [];
      const targetsById = new Map(targets.map((t) => [t.id as number, shallowScalars(t, targetType.attributes)]));
      const linksByOwner = new Map<number, Row[]>();
      for (const link of links) {
        const ownerId = link[map.ownerColumn] as number;
        (linksByOwner.get(ownerId) ?? linksByOwner.set(ownerId, []).get(ownerId)!).push(link);
      }
      for (const row of rows) {
        const ownerLinks = linksByOwner.get(row.id as number) ?? [];
        const ordered = ownerLinks.map((l) => targetsById.get(l[map.targetColumn] as number)).filter((t): t is Row => !!t);
        byId.get(row.id as number)![name] = ordered;
      }
      continue;
    }

    // component / dynamiczone — still per-row (bounded by the model() semaphore).
    await Promise.all(
      rows.map(async (row) => {
        const value =
          field.kind === 'component'
            ? await hydrateComponentField(collectionName, row.id as number, name, field.component, field.repeatable)
            : await hydrateDynamicZone(collectionName, row.id as number, name);
        byId.get(row.id as number)![name] = value;
      }),
    );
  }

  return rows.map((row) => byId.get(row.id as number)!);
}

function adminUserLabel(user: Row | undefined): string | null {
  if (!user) return null;
  const name = `${user.firstname ?? ''} ${user.lastname ?? ''}`.trim();
  return name || (user.email as string | undefined) || null;
}

/** Resolves the `created_by_id`/`updated_by_id` columns (present on every content-type/component
 * table but deliberately left out of `hydrateAttributes`'s business-shape output) into admin display
 * names, for the edit view's "Information" sidebar panel. */
export async function getEntityAuthorNames(
  collectionName: string,
  id: number,
): Promise<{ createdBy: string | null; updatedBy: string | null }> {
  const row = await model(collectionName).findUnique({ where: { id } });
  const createdById = row?.created_by_id as number | null | undefined;
  const updatedById = row?.updated_by_id as number | null | undefined;
  const ids = [createdById, updatedById].filter((v): v is number => typeof v === 'number');
  if (ids.length === 0) return { createdBy: null, updatedBy: null };

  const users = await model('admin_users').findMany({ where: { id: { in: ids } } });
  const usersById = new Map(users.map((u) => [u.id as number, u]));
  return {
    createdBy: createdById != null ? adminUserLabel(usersById.get(createdById)) : null,
    updatedBy: updatedById != null ? adminUserLabel(usersById.get(updatedById)) : null,
  };
}

export interface ListOptions {
  status?: 'draft' | 'published';
  page?: number;
  pageSize?: number;
  filters?: Row;
  sortField?: string;
  sortDir?: 'asc' | 'desc';
  fields?: string[];
}

/**
 * Matches Strapi's real REST/GraphQL default: when `status` isn't explicitly given, only published
 * content is served. Admin-panel callers that need to see drafts (editing, relation pickers, the
 * document-aware list view) must pass `status: 'draft'` explicitly — otherwise, for a draftAndPublish
 * type that has both a draft and a published row per document, an unspecified status used to return
 * BOTH rows (double-counted, and leaking unpublished drafts to public API consumers).
 */
function statusWhere(schema: ContentTypeSchema, status?: 'draft' | 'published') {
  if (!schema.draftAndPublish) return {};
  if (status === 'draft') return { published_at: null };
  return { published_at: { not: null } };
}

/** Restricts the hydrated result to `id`/`documentId` plus the requested scalar attribute names. */
function pickFields(row: Row, fields: string[] | undefined): Row {
  if (!fields || fields.length === 0) return row;
  const picked: Row = { id: row.id, documentId: row.documentId };
  for (const name of fields) if (name in row) picked[name] = row[name];
  return picked;
}

export async function listEntities(contentTypeUid: string, options: ListOptions = {}) {
  const schema = getContentType(contentTypeUid);
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? 25;
  const where = { ...statusWhere(schema, options.status), ...(options.filters ?? {}) };
  const orderBy = options.sortField ? { [toColumnName(options.sortField)]: options.sortDir ?? 'asc' } : { id: 'asc' as const };

  const [rows, total] = await Promise.all([
    model(schema.collectionName).findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    model(schema.collectionName).count({ where }),
  ]);

  // Batched across the whole page of rows (see hydrateAttributesForRows) rather than the
  // per-row hydrateAttributes — for a list, media/relation fields would otherwise be an N+1.
  const hydratedRows = await hydrateAttributesForRows(schema.uid, schema.collectionName, rows, schema.attributes);
  const data = hydratedRows.map((row) => pickFields(row, options.fields));

  return {
    data,
    meta: { pagination: { page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)), total } },
  };
}

/**
 * For the admin list view: given a page of draft rows' documentIds, returns the subset that also
 * have a published sibling row — used to render an accurate Published/Draft badge without querying
 * per-row. Only meaningful for draftAndPublish content types.
 */
export async function getPublishedDocumentIds(contentTypeUid: string, documentIds: string[]): Promise<Set<string>> {
  if (documentIds.length === 0) return new Set();
  const schema = getContentType(contentTypeUid);
  const rows = await model(schema.collectionName).findMany({
    where: { document_id: { in: documentIds }, published_at: { not: null } },
  });
  return new Set(rows.map((r) => r.document_id as string));
}

export async function findEntity(contentTypeUid: string, id: number, options: { status?: 'draft' | 'published' } = {}) {
  const schema = getContentType(contentTypeUid);
  const where: Row = { id, ...statusWhere(schema, options.status) };
  const rows = await model(schema.collectionName).findMany({ where, take: 1 });
  const row = rows[0];
  if (!row) return null;
  return hydrateAttributes(schema.uid, schema.collectionName, row, schema.attributes);
}

/**
 * Strapi v5's REST API addresses single entities by `documentId` in the URL,
 * not the internal numeric id — this is what nexus/serwise actually call.
 * Without an explicit status, prefers the published row (matching Strapi's
 * default `find`/`findOne` behavior of serving published content).
 */
export async function findEntityByDocumentId(contentTypeUid: string, documentId: string, options: { status?: 'draft' | 'published' } = {}) {
  const schema = getContentType(contentTypeUid);
  const where: Row = { document_id: documentId, ...statusWhere(schema, options.status) };
  // A document has at most 2 rows (draft + published) — fetch both and pick in JS rather than
  // relying on the DB's NULLS FIRST/LAST default for `published_at`, which varies by sort direction.
  const rows = await model(schema.collectionName).findMany({ where, take: 2 });
  if (rows.length === 0) return null;
  const row = options.status ? rows[0] : (rows.find((r) => r.published_at != null) ?? rows[0]);
  return hydrateAttributes(schema.uid, schema.collectionName, row, schema.attributes);
}

/** For singleType content types — there's exactly one logical entity (the first/only row). */
export async function findSingleType(contentTypeUid: string, options: { status?: 'draft' | 'published' } = {}) {
  const schema = getContentType(contentTypeUid);
  const where = statusWhere(schema, options.status);
  const rows = await model(schema.collectionName).findMany({ where, orderBy: { id: 'asc' }, take: 1 });
  const row = rows[0];
  if (!row) return null;
  return hydrateAttributes(schema.uid, schema.collectionName, row, schema.attributes);
}

// ---------------------------------------------------------------------------
// Write path
// ---------------------------------------------------------------------------

const DOCUMENT_ID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

function generateDocumentId(length = 24): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += DOCUMENT_ID_ALPHABET[bytes[i] % DOCUMENT_ID_ALPHABET.length];
  return out;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** Builds the {column: value} object for the main table's own create/update call — scalar fields only. */
function buildScalarData(attributes: Record<string, FieldSchema>, data: Row): Row {
  const result: Row = {};
  for (const [name, field] of Object.entries(attributes)) {
    if (field.kind !== 'scalar') continue;
    if (Object.prototype.hasOwnProperty.call(data, name)) {
      result[toColumnName(name)] = data[name];
    } else if (field.type === 'uid' && field.targetField && data[field.targetField] != null) {
      result[toColumnName(name)] = slugify(String(data[field.targetField]));
    } else if (!Object.prototype.hasOwnProperty.call(data, name) && field.default !== undefined) {
      result[toColumnName(name)] = field.default;
    }
  }
  return result;
}

function toIdArray(value: unknown): number[] {
  if (value == null) return [];
  const arr = Array.isArray(value) ? value : [value];
  return arr
    .map((v) => (typeof v === 'object' && v !== null ? (v as Row).id : v))
    .filter((v): v is number => typeof v === 'number');
}

async function writeMedia(ownerUid: string, ownerId: number, fieldName: string, value: unknown) {
  await model('files_related_mph').deleteMany({ where: { related_id: ownerId, related_type: ownerUid, field: fieldName } });
  const fileIds = toIdArray(value);
  for (let i = 0; i < fileIds.length; i++) {
    await model('files_related_mph').create({
      data: { file_id: fileIds[i], related_id: ownerId, related_type: ownerUid, field: fieldName, order: i + 1 },
    });
  }
}

/** Deletes a component row and everything it owns (nested components, its own media links) — recursively. */
async function deleteComponentRow(componentUid: string, componentRow: Row) {
  const component = getComponent(componentUid);
  const componentId = componentRow.id as number;
  for (const [name, field] of Object.entries(component.attributes)) {
    if (field.kind === 'media') {
      await model('files_related_mph').deleteMany({ where: { related_id: componentId, related_type: componentUid, field: name } });
    } else if (field.kind === 'component' || field.kind === 'dynamiczone') {
      const links = await model(cmpsTableName(component.collectionName)).findMany({ where: { entity_id: componentId, field: name } });
      for (const link of links) {
        const nestedUid = field.kind === 'component' ? field.component : (link.component_type as string);
        const nestedComponent = getComponent(nestedUid);
        const nestedRow = await model(nestedComponent.collectionName).findUnique({ where: { id: link.cmp_id as number } });
        if (nestedRow) await deleteComponentRow(nestedUid, nestedRow);
      }
      // the _cmps link rows themselves cascade-delete when componentRow is deleted below (entity_id FK ON DELETE CASCADE)
    }
  }
  await model(component.collectionName).delete({ where: { id: componentId } });
}

async function clearComponentField(ownerCollectionName: string, ownerId: number, fieldName: string) {
  const links = await model(cmpsTableName(ownerCollectionName)).findMany({ where: { entity_id: ownerId, field: fieldName } });
  for (const link of links) {
    const componentUid = link.component_type as string;
    const component = getComponent(componentUid);
    const row = await model(component.collectionName).findUnique({ where: { id: link.cmp_id as number } });
    if (row) await deleteComponentRow(componentUid, row);
  }
}

async function writeComponentRow(componentUid: string, itemData: Row): Promise<number> {
  const component = getComponent(componentUid);
  const scalarData = buildScalarData(component.attributes, itemData);
  const row = await model(component.collectionName).create({ data: scalarData });
  await writeNestedFields(componentUid, component.collectionName, row.id as number, component.attributes, itemData);
  return row.id as number;
}

async function writeComponentField(
  ownerUid: string,
  ownerCollectionName: string,
  ownerId: number,
  fieldName: string,
  componentUid: string,
  repeatable: boolean,
  value: unknown,
) {
  await clearComponentField(ownerCollectionName, ownerId, fieldName);
  const items = value == null ? [] : Array.isArray(value) ? value : [value];
  if (!repeatable && items.length > 1) items.length = 1;
  for (let i = 0; i < items.length; i++) {
    const cmpId = await writeComponentRow(componentUid, items[i] as Row);
    await model(cmpsTableName(ownerCollectionName)).create({
      data: { entity_id: ownerId, cmp_id: cmpId, component_type: componentUid, field: fieldName, order: i + 1 },
    });
  }
}

async function writeDynamicZone(ownerCollectionName: string, ownerId: number, fieldName: string, value: unknown) {
  await clearComponentField(ownerCollectionName, ownerId, fieldName);
  const items = (Array.isArray(value) ? value : []) as Array<Row & { __component: string }>;
  for (let i = 0; i < items.length; i++) {
    const { __component: componentUid, ...rest } = items[i];
    const cmpId = await writeComponentRow(componentUid, rest);
    await model(cmpsTableName(ownerCollectionName)).create({
      data: { entity_id: ownerId, cmp_id: cmpId, component_type: componentUid, field: fieldName, order: i + 1 },
    });
  }
}

async function writeRelation(ownerUid: string, ownerId: number, fieldName: string, value: unknown) {
  const map = getRelationTable(ownerUid, fieldName);
  await model(map.table).deleteMany({ where: { [map.ownerColumn]: ownerId } });
  const targetIds = toIdArray(value);
  for (let i = 0; i < targetIds.length; i++) {
    const data: Row = { [map.ownerColumn]: ownerId, [map.targetColumn]: targetIds[i] };
    if (map.targetOrderColumn) data[map.targetOrderColumn] = i + 1;
    await model(map.table).create({ data });
  }
}

/** Writes every non-scalar field present in `data` as a side effect once the owning row already exists. */
async function writeNestedFields(
  ownerUid: string,
  collectionName: string,
  ownerId: number,
  attributes: Record<string, FieldSchema>,
  data: Row,
) {
  for (const [name, field] of Object.entries(attributes)) {
    if (!Object.prototype.hasOwnProperty.call(data, name)) continue;
    switch (field.kind) {
      case 'media':
        await writeMedia(ownerUid, ownerId, name, data[name]);
        break;
      case 'component':
        await writeComponentField(ownerUid, collectionName, ownerId, name, field.component, field.repeatable, data[name]);
        break;
      case 'dynamiczone':
        await writeDynamicZone(collectionName, ownerId, name, data[name]);
        break;
      case 'relation':
        await writeRelation(ownerUid, ownerId, name, data[name]);
        break;
    }
  }
}

/** Best-effort human-readable label for an audit-log entry — tries the common
 *  "display name" attributes before falling back to the raw id. */
function labelFor(row: Row): string | undefined {
  const candidate = (row.label ?? row.name ?? row.key ?? row.title) as string | undefined;
  return candidate ?? undefined;
}

export async function createEntity(contentTypeUid: string, data: Row) {
  const schema = getContentType(contentTypeUid);
  const now = new Date();
  const scalarData = buildScalarData(schema.attributes, data);
  const row = await model(schema.collectionName).create({
    data: {
      document_id: generateDocumentId(),
      ...scalarData,
      created_at: now,
      updated_at: now,
      published_at: schema.draftAndPublish ? null : now,
    },
  });
  await writeNestedFields(schema.uid, schema.collectionName, row.id as number, schema.attributes, data);
  const created = await findEntity(contentTypeUid, row.id as number);
  await logAudit({
    module: schema.singularName,
    action: 'CREATE',
    entityId: String(row.id),
    entityLabel: created ? labelFor(created) : undefined,
    after: created ?? undefined,
  });
  return created;
}

export async function updateEntity(contentTypeUid: string, id: number, data: Row) {
  const schema = getContentType(contentTypeUid);
  const before = await findEntity(contentTypeUid, id);
  const scalarData = buildScalarData(schema.attributes, data);
  await model(schema.collectionName).update({ where: { id }, data: { ...scalarData, updated_at: new Date() } });
  await writeNestedFields(schema.uid, schema.collectionName, id, schema.attributes, data);
  const after = await findEntity(contentTypeUid, id);
  await logAudit({
    module: schema.singularName,
    action: 'UPDATE',
    entityId: String(id),
    entityLabel: (after && labelFor(after)) ?? (before && labelFor(before)),
    before: before ?? undefined,
    after: after ?? undefined,
  });
  return after;
}

/** Finds which scalar attribute owns a Prisma unique-constraint violation's target column, so the
 * caller can report something like `"slug" must be unique` instead of a raw Postgres error. */
function uniqueViolationField(schema: ContentTypeSchema, err: unknown): string | null {
  if (typeof err !== 'object' || err === null || (err as { code?: string }).code !== 'P2002') return null;
  const target = (err as { meta?: { target?: string[] | string } }).meta?.target;
  const columns = Array.isArray(target) ? target : typeof target === 'string' ? [target] : [];
  for (const [name, field] of Object.entries(schema.attributes)) {
    if (field.kind === 'scalar' && columns.includes(toColumnName(name))) return name;
  }
  return null;
}

/**
 * Clones a document's draft into a brand-new document (fresh `document_id`, always created as a
 * draft even for draftAndPublish types — matching Strapi's own "Duplicate" action). Proactively
 * dodges the most common unique-constraint collisions (uid fields, `unique: true` scalars) the way
 * Strapi's real duplicate flow does; if a collision still slips through, throws a message naming the
 * offending field instead of a raw Postgres error, for the caller to surface as a failure dialog.
 */
export async function duplicateEntity(contentTypeUid: string, documentId: string) {
  const schema = getContentType(contentTypeUid);
  const source = await findEntityByDocumentId(contentTypeUid, documentId, { status: 'draft' });
  if (!source) throw new Error('Entity not found');

  const clone: Row = { ...source };
  delete clone.id;
  delete clone.documentId;
  delete clone.createdAt;
  delete clone.updatedAt;
  delete clone.publishedAt;

  const suffix = generateDocumentId(6);
  for (const [name, field] of Object.entries(schema.attributes)) {
    if (field.kind !== 'scalar' || typeof clone[name] !== 'string') continue;
    if (field.type === 'uid') clone[name] = `${clone[name]}-copy-${suffix}`;
    else if (field.unique) clone[name] = `${clone[name]} (copy)`;
  }

  try {
    return await createEntity(contentTypeUid, clone);
  } catch (err) {
    const conflictField = uniqueViolationField(schema, err);
    if (conflictField) throw new Error(`Could not duplicate this entry: the "${conflictField}" field must be unique.`);
    throw err;
  }
}

export async function deleteEntity(contentTypeUid: string, id: number) {
  const schema = getContentType(contentTypeUid);
  const before = await findEntity(contentTypeUid, id);
  for (const [name, field] of Object.entries(schema.attributes)) {
    if (field.kind === 'media') {
      await model('files_related_mph').deleteMany({ where: { related_id: id, related_type: schema.uid, field: name } });
    } else if (field.kind === 'component' || field.kind === 'dynamiczone') {
      await clearComponentField(schema.collectionName, id, name);
    }
    // relations clean up via ON DELETE CASCADE on the `_lnk` tables' owner FK.
  }
  await model(schema.collectionName).delete({ where: { id } });
  await logAudit({
    module: schema.singularName,
    action: 'DELETE',
    entityId: String(id),
    entityLabel: before ? labelFor(before) : undefined,
    before: before ?? undefined,
  });
}

/**
 * Publishes a draft row: creates (or overwrites) the sibling row sharing the
 * same `document_id` with `published_at` set, deep-copying every owned
 * component (fresh rows — draft and published versions never share component
 * rows, matching Strapi's document model) while relation targets are
 * referenced, not duplicated.
 */
export async function publishEntity(contentTypeUid: string, draftId: number) {
  const schema = getContentType(contentTypeUid);
  if (!schema.draftAndPublish) throw new Error(`${contentTypeUid} does not have draftAndPublish enabled`);

  const draftRow = await model(schema.collectionName).findUnique({ where: { id: draftId } });
  if (!draftRow) throw new Error(`Draft entity ${draftId} not found`);
  const draft = await hydrateAttributes(schema.uid, schema.collectionName, draftRow, schema.attributes);

  const existingPublished = (
    await model(schema.collectionName).findMany({
      where: { document_id: draftRow.document_id, published_at: { not: null } },
      take: 1,
    })
  )[0];

  const now = new Date();
  const scalarData = buildScalarData(schema.attributes, draft);

  let publishedId: number;
  if (existingPublished) {
    publishedId = existingPublished.id as number;
    for (const [name, field] of Object.entries(schema.attributes)) {
      if (field.kind === 'media') await model('files_related_mph').deleteMany({ where: { related_id: publishedId, related_type: schema.uid, field: name } });
      else if (field.kind === 'component' || field.kind === 'dynamiczone') await clearComponentField(schema.collectionName, publishedId, name);
    }
    await model(schema.collectionName).update({ where: { id: publishedId }, data: { ...scalarData, updated_at: now, published_at: now } });
  } else {
    const created = await model(schema.collectionName).create({
      data: { document_id: draftRow.document_id, ...scalarData, created_at: now, updated_at: now, published_at: now },
    });
    publishedId = created.id as number;
  }

  await writeNestedFields(schema.uid, schema.collectionName, publishedId, schema.attributes, draft);
  return findEntity(contentTypeUid, publishedId);
}

/** Removes the published sibling of `draftId`'s document, leaving the draft untouched. */
export async function unpublishEntity(contentTypeUid: string, draftId: number) {
  const schema = getContentType(contentTypeUid);
  if (!schema.draftAndPublish) throw new Error(`${contentTypeUid} does not have draftAndPublish enabled`);

  const draftRow = await model(schema.collectionName).findUnique({ where: { id: draftId } });
  if (!draftRow) throw new Error(`Draft entity ${draftId} not found`);

  const published = (
    await model(schema.collectionName).findMany({
      where: { document_id: draftRow.document_id, published_at: { not: null } },
      take: 1,
    })
  )[0];
  if (!published) return;
  await deleteEntity(contentTypeUid, published.id as number);
}

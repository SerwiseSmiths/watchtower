import { prisma } from './prisma';
import { cmpsTableName, getComponent, getContentType, getRelationTable, toColumnName } from '../content-schema/registry';
import type { ComponentSchema, ContentTypeSchema, FieldSchema } from '../content-schema/types';

type Row = Record<string, unknown>;
type PrismaModel = {
  findMany: (args?: unknown) => Promise<Row[]>;
  findUnique: (args?: unknown) => Promise<Row | null>;
  count: (args?: unknown) => Promise<number>;
};

const prismaAny = prisma as unknown as Record<string, PrismaModel>;

function model(tableName: string): PrismaModel {
  const m = prismaAny[tableName];
  if (!m) throw new Error(`No Prisma model for table "${tableName}" — did you run \`yarn prisma:pull\`?`);
  return m;
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
  const result: Row = { id: row.id, document_id: row.document_id };
  for (const [name, field] of Object.entries(attributes)) {
    if (field.kind === 'scalar') result[name] = row[toColumnName(name)];
  }
  return result;
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
  const hydrated: Row = { id: row.id, document_id: row.document_id };
  for (const [name, field] of Object.entries(attributes)) {
    switch (field.kind) {
      case 'scalar':
        hydrated[name] = row[toColumnName(name)];
        break;
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

export interface ListOptions {
  status?: 'draft' | 'published';
  page?: number;
  pageSize?: number;
}

function statusWhere(schema: ContentTypeSchema, status?: 'draft' | 'published') {
  if (!schema.draftAndPublish) return {};
  if (status === 'draft') return { published_at: null };
  if (status === 'published') return { published_at: { not: null } };
  return {};
}

export async function listEntities(contentTypeUid: string, options: ListOptions = {}) {
  const schema = getContentType(contentTypeUid);
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? 25;
  const where = statusWhere(schema, options.status);

  const [rows, total] = await Promise.all([
    model(schema.collectionName).findMany({
      where,
      orderBy: { id: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    model(schema.collectionName).count({ where }),
  ]);

  const data = await Promise.all(rows.map((row) => hydrateAttributes(schema.uid, schema.collectionName, row, schema.attributes)));

  return {
    data,
    meta: { pagination: { page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)), total } },
  };
}

export async function findEntity(contentTypeUid: string, id: number, options: { status?: 'draft' | 'published' } = {}) {
  const schema = getContentType(contentTypeUid);
  const where: Row = { id, ...statusWhere(schema, options.status) };
  const rows = await model(schema.collectionName).findMany({ where, take: 1 });
  const row = rows[0];
  if (!row) return null;
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

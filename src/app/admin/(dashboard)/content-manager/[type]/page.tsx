import { notFound, redirect } from 'next/navigation';
import { getContentType, resolveContentTypeSlug, toColumnName } from '@/lib/content-schema/registry';
import { findOwnerIdsByRelationTarget, getPublishedDocumentIds, listEntities } from '@/lib/db/entity-repository';
import type { FieldSchema, ScalarType } from '@/lib/content-schema/types';
import ListView, { type FilterCondition, type RelationFilterOption } from './ListView';

const SEARCHABLE_SCALAR_TYPES = new Set(['string', 'text', 'uid']);
const LABEL_FIELD_CANDIDATES = ['name', 'title', 'label', 'key'];

function labelFor(row: Record<string, unknown>): string {
  for (const field of LABEL_FIELD_CANDIDATES) {
    if (typeof row[field] === 'string' && row[field]) return row[field] as string;
  }
  return String(row.documentId ?? row.id);
}

function coerceFilterValue(type: ScalarType, raw: string): unknown {
  if (type === 'integer') return Number.parseInt(raw, 10);
  if (type === 'decimal') return Number.parseFloat(raw);
  if (type === 'boolean') return raw === 'true';
  if (type === 'date' || type === 'datetime') return new Date(raw);
  return raw;
}

async function buildFilterClause(
  ownerUid: string,
  condition: FilterCondition,
  attributes: Record<string, FieldSchema>,
): Promise<Record<string, unknown> | null> {
  const field = attributes[condition.field];
  if (!field) return null;

  if (field.kind === 'relation' && condition.operator === 'relEq') {
    const targetId = Number.parseInt(condition.value, 10);
    if (Number.isNaN(targetId)) return null;
    const ownerIds = await findOwnerIdsByRelationTarget(ownerUid, condition.field, targetId);
    return { id: { in: ownerIds } };
  }

  if (field.kind !== 'scalar') return null;
  const type = field.type;
  const column = toColumnName(condition.field);
  const value = coerceFilterValue(type, condition.value);

  switch (condition.operator) {
    case 'contains':
      return { [column]: { contains: value, mode: 'insensitive' } };
    case 'notContains':
      return { NOT: { [column]: { contains: value, mode: 'insensitive' } } };
    case 'eq':
      return { [column]: value };
    case 'notEq':
      return { NOT: { [column]: value } };
    case 'gt':
      return { [column]: { gt: value } };
    case 'gte':
      return { [column]: { gte: value } };
    case 'lt':
      return { [column]: { lt: value } };
    case 'lte':
      return { [column]: { lte: value } };
    default:
      return null;
  }
}

function parseFilters(raw: string | undefined): FilterCondition[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (f): f is FilterCondition =>
        f && typeof f.field === 'string' && typeof f.operator === 'string' && typeof f.value === 'string',
    );
  } catch {
    return [];
  }
}

export default async function ContentTypeListPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ page?: string; q?: string; sortField?: string; sortDir?: string; filters?: string; columns?: string }>;
}) {
  const { type } = await params;
  const schema = resolveContentTypeSlug(type);
  if (!schema) notFound();

  if (schema.kind === 'singleType') {
    redirect(`/admin/content-manager/${type}/edit`);
  }

  const { page: pageParam, q, sortField, sortDir, filters: filtersParam, columns } = await searchParams;
  const visibleColumns = columns ? columns.split(',').filter(Boolean) : undefined;
  const page = pageParam ? parseInt(pageParam, 10) || 1 : 1;
  const appliedFilters = parseFilters(filtersParam);

  const andClauses: Record<string, unknown>[] = [];
  if (q?.trim()) {
    const searchableColumns = Object.entries(schema.attributes)
      .filter(([, field]) => field.kind === 'scalar' && SEARCHABLE_SCALAR_TYPES.has(field.type))
      .map(([name]) => toColumnName(name));
    if (searchableColumns.length > 0) {
      andClauses.push({ OR: searchableColumns.map((column) => ({ [column]: { contains: q.trim(), mode: 'insensitive' } })) });
    }
  }
  for (const condition of appliedFilters) {
    const clause = await buildFilterClause(schema.uid, condition, schema.attributes);
    if (clause) andClauses.push(clause);
  }
  const filters = andClauses.length > 0 ? { AND: andClauses } : undefined;

  // Always list the draft row — every document has exactly one, so this gives one row per document
  // (an unfiltered/published-default query would return both the draft and published row for the
  // same document as separate table rows). The real published/draft badge is computed below.
  const result = await listEntities(schema.uid, {
    page,
    pageSize: 20,
    filters,
    sortField: sortField || undefined,
    sortDir: sortDir === 'desc' ? 'desc' : 'asc',
    status: schema.draftAndPublish ? 'draft' : undefined,
  });

  const publishedIds = schema.draftAndPublish
    ? await getPublishedDocumentIds(
        schema.uid,
        result.data.map((row) => (row as { documentId: string }).documentId),
      )
    : new Set<string>();
  const data = result.data.map((row) => ({
    ...(row as Record<string, unknown>),
    isPublished: publishedIds.has((row as { documentId: string }).documentId),
  }));

  // Lightweight option lists (id + label only) for the Filters popover's relation pickers —
  // separate from the full relationOptions the edit view fetches, which also need targetSlug.
  const relationFilterOptions: Record<string, RelationFilterOption[]> = {};
  for (const [name, field] of Object.entries(schema.attributes)) {
    if (field.kind !== 'relation') continue;
    const targetSchema = getContentType(field.target);
    const targetList = await listEntities(field.target, { pageSize: 200, status: targetSchema.draftAndPublish ? 'draft' : undefined });
    relationFilterOptions[name] = targetList.data.map((row) => ({
      id: (row as { id: number }).id,
      label: labelFor(row as Record<string, unknown>),
    }));
  }

  return (
    <ListView
      displayName={schema.displayName}
      slug={type}
      attributes={schema.attributes}
      draftAndPublish={schema.draftAndPublish}
      data={data as never}
      pagination={result.meta.pagination}
      query={q ?? ''}
      sortField={sortField ?? ''}
      sortDir={sortDir === 'desc' ? 'desc' : 'asc'}
      appliedFilters={appliedFilters}
      visibleColumns={visibleColumns}
      relationFilterOptions={relationFilterOptions}
    />
  );
}

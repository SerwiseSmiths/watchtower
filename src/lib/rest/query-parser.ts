import type { ContentTypeSchema } from '../content-schema/types';
import { toColumnName } from '../content-schema/registry';

/**
 * Parses Strapi's REST query-string DSL (bracket-notation nested params) into
 * a flat object, e.g. `filters[visibility][$eq]=ACTIVE&pagination[pageSize]=10`
 * -> `{ filters: { visibility: { $eq: 'ACTIVE' } }, pagination: { pageSize: '10' } }`.
 * `populate` is intentionally not parsed into a shape here — this engine
 * always fully hydrates media/components/dynamic zones/relations regardless
 * of what's requested (a superset of Strapi's default lazy populate; see
 * PROGRESS.md for the tradeoff).
 */
function parseNestedQuery(searchParams: URLSearchParams): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [rawKey, value] of searchParams.entries()) {
    const keys = rawKey.split('[').map((k) => k.replace(']', ''));
    let cursor = result;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (typeof cursor[key] !== 'object' || cursor[key] === null) cursor[key] = {};
      cursor = cursor[key] as Record<string, unknown>;
    }
    cursor[keys[keys.length - 1]] = value;
  }
  return result;
}

const OPERATOR_MAP: Record<string, string> = {
  $eq: 'equals',
  $ne: 'not',
  $in: 'in',
  $notIn: 'notIn',
  $contains: 'contains',
  $gt: 'gt',
  $gte: 'gte',
  $lt: 'lt',
  $lte: 'lte',
};

function coerceFilterValue(value: unknown, columnType: string): unknown {
  const toScalar = (v: unknown) => {
    if (typeof v !== 'string') return v;
    if (columnType === 'integer') return parseInt(v, 10);
    if (columnType === 'decimal') return parseFloat(v);
    if (columnType === 'boolean') return v === 'true';
    return v;
  };
  if (Array.isArray(value)) return value.map(toScalar);
  if (typeof value === 'string' && value.includes(',')) return value.split(',').map(toScalar);
  return toScalar(value);
}

/** Builds a Prisma `where` object from Strapi's `filters[field][$operator]=value` query params. */
export function buildFiltersWhere(schema: ContentTypeSchema, rawFilters: unknown): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (!rawFilters || typeof rawFilters !== 'object') return where;

  for (const [attrName, condition] of Object.entries(rawFilters as Record<string, unknown>)) {
    const field = schema.attributes[attrName];
    if (!field || field.kind !== 'scalar') continue; // only scalar-column filters are supported directly in SQL
    const column = toColumnName(attrName);

    if (typeof condition === 'object' && condition !== null) {
      const opConditions: Record<string, unknown> = {};
      for (const [op, value] of Object.entries(condition as Record<string, unknown>)) {
        const prismaOp = OPERATOR_MAP[op];
        if (!prismaOp) continue;
        opConditions[prismaOp] = coerceFilterValue(value, field.type);
      }
      where[column] = opConditions;
    } else {
      where[column] = coerceFilterValue(condition, field.type);
    }
  }
  return where;
}

export interface ParsedQuery {
  filters: Record<string, unknown>;
  fields?: string[];
  sortField?: string;
  sortDir: 'asc' | 'desc';
  page: number;
  pageSize: number;
  status?: 'draft' | 'published';
}

export function parseQuery(schema: ContentTypeSchema, searchParams: URLSearchParams): ParsedQuery {
  const parsed = parseNestedQuery(searchParams);

  const filters = buildFiltersWhere(schema, parsed.filters);

  let fields: string[] | undefined;
  if (Array.isArray(parsed.fields)) fields = parsed.fields as string[];
  else if (typeof parsed.fields === 'string') fields = parsed.fields.split(',');
  else if (parsed.fields && typeof parsed.fields === 'object') fields = Object.values(parsed.fields as Record<string, string>);

  let sortField: string | undefined;
  let sortDir: 'asc' | 'desc' = 'asc';
  const rawSort = parsed.sort ?? searchParams.get('sort');
  const sortStr = Array.isArray(rawSort)
    ? rawSort[0]
    : rawSort && typeof rawSort === 'object'
      ? Object.values(rawSort as Record<string, string>)[0]
      : rawSort;
  if (typeof sortStr === 'string') {
    const [field, dir] = sortStr.split(':');
    sortField = field;
    if (dir === 'desc' || dir === 'asc') sortDir = dir;
  }

  const pagination = (parsed.pagination as Record<string, string>) ?? {};
  const page = parseInt((pagination.page as string) ?? (searchParams.get('page') as string) ?? '1', 10) || 1;
  const pageSize = parseInt((pagination.pageSize as string) ?? (searchParams.get('pageSize') as string) ?? '25', 10) || 25;

  const status = (parsed.status as string) === 'draft' ? 'draft' : (parsed.status as string) === 'published' ? 'published' : undefined;

  return { filters, fields, sortField, sortDir, page, pageSize, status };
}

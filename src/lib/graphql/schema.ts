import { createSchema } from 'graphql-yoga';
import { toColumnName } from '../content-schema/registry';
import { allComponents, allContentTypes, getContentType } from '../content-schema/registry';
import type { ComponentSchema, ContentTypeSchema, FieldSchema, ScalarType } from '../content-schema/types';
import { findEntityByDocumentId, findSingleType, listEntities } from '../db/entity-repository';
import { camelCase, componentGraphQLName, contentTypeGraphQLName } from './naming';

function scalarGraphQLType(type: ScalarType): string {
  switch (type) {
    case 'integer':
      return 'Int';
    case 'decimal':
      return 'Float';
    case 'boolean':
      return 'Boolean';
    default:
      return 'String'; // string/text/uid/enumeration/date/datetime — see PROGRESS.md simplifications
  }
}

function filterInputName(type: ScalarType): string {
  if (type === 'integer') return 'IntFilterInput';
  if (type === 'decimal') return 'FloatFilterInput';
  if (type === 'boolean') return 'BooleanFilterInput';
  return 'StringFilterInput';
}

interface BuildContext {
  dynamicZoneUnions: Map<string, string[]>; // unionTypeName -> member component type names
}

function buildFieldsSDL(attributes: Record<string, FieldSchema>, ownerTypeName: string, ctx: BuildContext): string {
  const lines: string[] = [];
  for (const [name, field] of Object.entries(attributes)) {
    switch (field.kind) {
      case 'scalar':
        lines.push(`  ${name}: ${scalarGraphQLType(field.type)}`);
        break;
      case 'media':
        lines.push(`  ${name}: ${field.multiple ? '[UploadFile!]' : 'UploadFile'}`);
        break;
      case 'component': {
        const typeName = componentGraphQLName(field.component);
        lines.push(`  ${name}: ${field.repeatable ? `[${typeName}!]` : typeName}`);
        break;
      }
      case 'dynamiczone': {
        const unionName = `${ownerTypeName}${pascalField(name)}DynamicZone`;
        ctx.dynamicZoneUnions.set(unionName, field.components.map(componentGraphQLName));
        lines.push(`  ${name}: [${unionName}!]`);
        break;
      }
      case 'relation': {
        const target = getContentType(field.target);
        const typeName = contentTypeGraphQLName(target.singularName);
        const isMany = field.relation === 'oneToMany' || field.relation === 'manyToMany';
        lines.push(`  ${name}: ${isMany ? `[${typeName}!]` : typeName}`);
        break;
      }
    }
  }
  return lines.join('\n');
}

function pascalField(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function buildFiltersInputSDL(schema: ContentTypeSchema): { name: string; sdl: string } {
  const name = `${contentTypeGraphQLName(schema.singularName)}FiltersInput`;
  const lines: string[] = [];
  for (const [attrName, field] of Object.entries(schema.attributes)) {
    if (field.kind !== 'scalar') continue;
    lines.push(`  ${attrName}: ${filterInputName(field.type)}`);
  }
  return { name, sdl: `input ${name} {\n${lines.join('\n')}\n}` };
}

function buildComponentTypeSDL(component: ComponentSchema, ctx: BuildContext): string {
  const typeName = componentGraphQLName(component.uid);
  return `type ${typeName} {\n${buildFieldsSDL(component.attributes, typeName, ctx)}\n}`;
}

function buildContentTypeSDL(schema: ContentTypeSchema, ctx: BuildContext): string {
  const typeName = contentTypeGraphQLName(schema.singularName);
  const systemFields = '  id: ID\n  documentId: String\n  createdAt: String\n  updatedAt: String\n  publishedAt: String';
  return `type ${typeName} {\n${systemFields}\n${buildFieldsSDL(schema.attributes, typeName, ctx)}\n}`;
}

const STATIC_SDL = `
scalar JSON

enum PublicationStatus {
  DRAFT
  PUBLISHED
}

input PaginationArg {
  page: Int
  pageSize: Int
}

input StringFilterInput {
  eq: String
  ne: String
  in: [String]
  notIn: [String]
  contains: String
}

input IntFilterInput {
  eq: Int
  ne: Int
  in: [Int]
  notIn: [Int]
  gt: Int
  gte: Int
  lt: Int
  lte: Int
}

input FloatFilterInput {
  eq: Float
  ne: Float
  in: [Float]
  notIn: [Float]
  gt: Float
  gte: Float
  lt: Float
  lte: Float
}

input BooleanFilterInput {
  eq: Boolean
  ne: Boolean
}

type UploadFile {
  id: ID
  documentId: String
  name: String
  alternativeText: String
  caption: String
  width: Int
  height: Int
  mime: String
  size: Float
  url: String
}
`;

function statusArgToOption(status: unknown): 'draft' | 'published' | undefined {
  if (status === 'DRAFT') return 'draft';
  if (status === 'PUBLISHED') return 'published';
  return undefined;
}

type FilterCondition = Record<string, unknown> | unknown;

const GRAPHQL_OPERATOR_MAP: Record<string, string> = {
  eq: 'equals',
  ne: 'not',
  in: 'in',
  notIn: 'notIn',
  contains: 'contains',
  gt: 'gt',
  gte: 'gte',
  lt: 'lt',
  lte: 'lte',
};

function buildGraphQLFiltersWhere(schema: ContentTypeSchema, rawFilters: Record<string, FilterCondition> | undefined): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (!rawFilters) return where;
  for (const [attrName, condition] of Object.entries(rawFilters)) {
    const field = schema.attributes[attrName];
    if (!field || field.kind !== 'scalar' || condition == null || typeof condition !== 'object') continue;
    const column = toColumnName(attrName);
    const opConditions: Record<string, unknown> = {};
    for (const [op, value] of Object.entries(condition as Record<string, unknown>)) {
      const prismaOp = GRAPHQL_OPERATOR_MAP[op];
      if (prismaOp) opConditions[prismaOp] = value;
    }
    where[column] = opConditions;
  }
  return where;
}

interface CollectionArgs {
  filters?: Record<string, FilterCondition>;
  pagination?: { page?: number; pageSize?: number };
  sort?: string[];
  status?: 'DRAFT' | 'PUBLISHED';
}

async function resolveCollection(uid: string, args: CollectionArgs) {
  const schema = getContentType(uid);
  const filters = buildGraphQLFiltersWhere(schema, args.filters);
  const [sortField, sortDirRaw] = (args.sort?.[0] ?? '').split(':');
  const result = await listEntities(uid, {
    filters,
    page: args.pagination?.page,
    pageSize: args.pagination?.pageSize ?? 100,
    sortField: sortField || undefined,
    sortDir: sortDirRaw === 'desc' ? 'desc' : 'asc',
    status: statusArgToOption(args.status),
  });
  return result.data;
}

/** Builds the full executable GraphQL schema from the content-schema registry — mirrors Strapi's shadowCRUD-generated schema for the query names existing consumers already call. */
export function buildGraphQLSchema() {
  const ctx: BuildContext = { dynamicZoneUnions: new Map() };
  const contentTypes = allContentTypes();
  const components = allComponents();

  const componentSDL = components.map((c) => buildComponentTypeSDL(c, ctx));
  const contentTypeSDL = contentTypes.map((c) => buildContentTypeSDL(c, ctx));
  const filterInputs = contentTypes.filter((c) => c.kind === 'collectionType').map((c) => buildFiltersInputSDL(c));

  const queryFields: string[] = [];
  const resolvers: Record<string, unknown> = {};
  const Query: Record<string, unknown> = {};

  for (const schema of contentTypes) {
    const typeName = contentTypeGraphQLName(schema.singularName);
    if (schema.kind === 'collectionType') {
      const fieldName = camelCase(schema.pluralName);
      const filtersInputName = `${typeName}FiltersInput`;
      queryFields.push(
        `  ${fieldName}(filters: ${filtersInputName}, pagination: PaginationArg, sort: [String], status: PublicationStatus): [${typeName}!]!`,
      );
      Query[fieldName] = (_: unknown, args: CollectionArgs) => resolveCollection(schema.uid, args);
    } else {
      const fieldName = camelCase(schema.singularName);
      queryFields.push(`  ${fieldName}(status: PublicationStatus): ${typeName}`);
      Query[fieldName] = (_: unknown, args: { status?: 'DRAFT' | 'PUBLISHED' }) =>
        findSingleType(schema.uid, { status: statusArgToOption(args.status) });
    }
  }

  // documentId lookup is useful for future single-entity queries even though no current consumer needs it yet.
  void findEntityByDocumentId;

  const unionSDL = Array.from(ctx.dynamicZoneUnions.entries()).map(
    ([unionName, members]) => `union ${unionName} = ${members.join(' | ')}`,
  );
  for (const [unionName] of ctx.dynamicZoneUnions) {
    resolvers[unionName] = {
      __resolveType: (obj: { __component?: string }) => (obj.__component ? componentGraphQLName(obj.__component) : null),
    };
  }

  const typeDefs = [
    STATIC_SDL,
    ...componentSDL,
    ...contentTypeSDL,
    ...filterInputs.map((f) => f.sdl),
    ...unionSDL,
    `type Query {\n${queryFields.join('\n')}\n}`,
  ].join('\n\n');

  return createSchema({
    typeDefs,
    resolvers: { Query, ...resolvers },
  });
}

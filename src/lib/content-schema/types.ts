export type ScalarType =
  | 'string'
  | 'text'
  | 'integer'
  | 'decimal'
  | 'boolean'
  | 'enumeration'
  | 'uid'
  | 'date'
  | 'datetime'
  | 'json';

export interface ScalarField {
  kind: 'scalar';
  type: ScalarType;
  required?: boolean;
  unique?: boolean;
  default?: unknown;
  min?: number;
  max?: number;
  enum?: string[];
  targetField?: string;
}

export interface MediaField {
  kind: 'media';
  multiple: boolean;
  required?: boolean;
  allowedTypes?: string[];
}

export interface ComponentField {
  kind: 'component';
  component: string;
  repeatable: boolean;
  required?: boolean;
  min?: number;
  max?: number;
}

export interface DynamicZoneField {
  kind: 'dynamiczone';
  components: string[];
  required?: boolean;
}

export type RelationCardinality = 'oneToOne' | 'oneToMany' | 'manyToOne' | 'manyToMany';

export interface RelationField {
  kind: 'relation';
  relation: RelationCardinality;
  target: string;
  mappedBy?: string;
  inversedBy?: string;
}

export type FieldSchema = ScalarField | MediaField | ComponentField | DynamicZoneField | RelationField;

export interface ContentTypeSchema {
  uid: string;
  kind: 'collectionType' | 'singleType';
  collectionName: string;
  singularName: string;
  pluralName: string;
  displayName: string;
  description?: string;
  draftAndPublish: boolean;
  attributes: Record<string, FieldSchema>;
}

export interface ComponentSchema {
  uid: string;
  collectionName: string;
  displayName: string;
  description?: string;
  attributes: Record<string, FieldSchema>;
}

/**
 * Exact join-table shape for a relation attribute, resolved against the real
 * introspected DB (Strapi truncates+hashes long `_lnk` table names, so these
 * are curated by hand from `prisma/schema.prisma` rather than derived by a
 * naming algorithm — there are only a handful of relations in this schema).
 */
export interface RelationTableMap {
  table: string;
  ownerColumn: string;
  targetColumn: string;
  ownerOrderColumn?: string;
  targetOrderColumn?: string;
}

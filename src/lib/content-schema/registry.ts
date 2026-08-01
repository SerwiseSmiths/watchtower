import { componentSchemas, contentTypeSchemas } from './loader';
import { relationTables } from './relation-tables';
import type { ComponentSchema, ContentTypeSchema, RelationTableMap } from './types';

const contentTypesByUid = new Map<string, ContentTypeSchema>(contentTypeSchemas.map((c) => [c.uid, c]));
const componentsByUid = new Map<string, ComponentSchema>(componentSchemas.map((c) => [c.uid, c]));

export function getContentType(uid: string): ContentTypeSchema {
  const schema = contentTypesByUid.get(uid);
  if (!schema) throw new Error(`Unknown content-type uid: ${uid}`);
  return schema;
}

export function getContentTypeByPluralName(pluralName: string): ContentTypeSchema | undefined {
  return contentTypeSchemas.find((c) => c.pluralName === pluralName);
}

export function getContentTypeBySingularName(singularName: string): ContentTypeSchema | undefined {
  return contentTypeSchemas.find((c) => c.singularName === singularName);
}

export function getComponent(uid: string): ComponentSchema {
  const schema = componentsByUid.get(uid);
  if (!schema) throw new Error(`Unknown component uid: ${uid}`);
  return schema;
}

export function allContentTypes(): ContentTypeSchema[] {
  return contentTypeSchemas;
}

export function allComponents(): ComponentSchema[] {
  return componentSchemas;
}

/** The `<collectionName>_cmps` polymorphic link table Strapi creates for any content-type/component with component or dynamiczone fields. */
export function cmpsTableName(collectionName: string): string {
  return `${collectionName}_cmps`;
}

export function getRelationTable(ownerUid: string, attributeName: string): RelationTableMap {
  const key = `${ownerUid}.${attributeName}`;
  const table = relationTables[key];
  if (!table) throw new Error(`No relation table mapping for ${key} — add it to relation-tables.ts`);
  return table;
}

/** camelCase -> snake_case, matching how Strapi derives Postgres column names from attribute keys. */
export function toColumnName(attributeName: string): string {
  return attributeName.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

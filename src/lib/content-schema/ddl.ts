import { createHash } from 'crypto';
import type { RawAttribute, RawComponentSchema, RawSchema } from './loader';
import { contentTypeUid, type RegistrySnapshot } from './store';
import type { RelationTableMap } from './types';

/**
 * Turns "registry before" → "registry after" into the SQL that makes the database match, following
 * the table conventions Strapi 5 used for this DB (see prisma/manual-migrations/0003_*.sql):
 *   content type  → <collection> (id, document_id, <scalars>, timestamps, created_by/updated_by, locale)
 *   component     → <collection> (id, <scalars>)
 *   component / dynamic-zone fields → <collection>_cmps link table
 *   media         → shared files_related_mph (no DDL)
 *   relation      → <owner>_<attr>_lnk join table
 *
 * Used by the Content-Type Builder (one type/component at a time) and by the dev→prod schema sync
 * (whole registry). Pure: it only plans; apply.ts executes.
 */

export interface SchemaChange {
  description: string;
  /** Deletes stored data (drops a table/column/links) — the UI asks for explicit confirmation. */
  destructive: boolean;
  sql: string[];
}

export interface SchemaPlan {
  changes: SchemaChange[];
  /** The target registry, with join-table mappings filled in for any newly created relations. */
  target: RegistrySnapshot;
}

export class SchemaValidationError extends Error {}

const IDENT = /^[a-z_][a-z0-9_]*$/;
const ATTRIBUTE_NAME = /^[A-Za-z][A-Za-z0-9_]*$/;
const RESERVED_ATTRIBUTES = new Set([
  'id', 'documentId', 'document_id', 'createdAt', 'created_at', 'updatedAt', 'updated_at', 'publishedAt',
  'published_at', 'createdBy', 'created_by', 'updatedBy', 'updated_by', 'locale', 'localizations', 'meta',
]);

const COLOR_CUSTOM_FIELD = 'plugin::color-picker.color';

export function toColumnName(attributeName: string): string {
  return attributeName.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

export function q(identifier: string): string {
  if (!IDENT.test(identifier) || identifier.length > 63) throw new SchemaValidationError(`Invalid database identifier "${identifier}"`);
  return `"${identifier}"`;
}

function literal(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/** Postgres caps identifiers at 63 chars; Strapi shortens long names with a hash the same way. */
export function shortIdentifier(name: string): string {
  if (name.length <= 63) return name;
  const hash = createHash('sha256').update(name).digest('hex').slice(0, 6);
  return `${name.slice(0, 56)}_${hash}`;
}

export function snake(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase();
}

export function pluralize(word: string): string {
  if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/.test(word)) return `${word}es`;
  return `${word}s`;
}

/** Strapi's component table name: components_<category>_<plural of name>. */
export function componentCollectionName(uid: string): string {
  const [category, name] = uid.split('.');
  return shortIdentifier(`components_${snake(category)}_${pluralize(snake(name))}`);
}

/** SQL column type for a raw attribute, or null for attributes that live outside the row (media, components, relations). */
export function columnType(attr: RawAttribute): string | null {
  switch (attr.type) {
    case 'string':
    case 'uid':
    case 'enumeration':
    case 'email':
      return 'VARCHAR(255)';
    case 'customField':
      if (attr.customField === COLOR_CUSTOM_FIELD) return 'VARCHAR(255)';
      throw new SchemaValidationError(`Unsupported custom field ${attr.customField}`);
    case 'text':
      return 'TEXT';
    case 'integer':
      return 'INTEGER';
    case 'decimal':
      return 'NUMERIC(10,2)';
    case 'boolean':
      return 'BOOLEAN';
    case 'date':
      return 'DATE';
    case 'datetime':
      return 'TIMESTAMP(6)';
    case 'json':
      return 'JSONB';
    case 'media':
    case 'component':
    case 'dynamiczone':
    case 'relation':
      return null;
    default:
      throw new SchemaValidationError(`Unsupported field type "${attr.type}"`);
  }
}

// ─── Owners: content types and components share most of the planning ───────────────────────────

interface Owner {
  uid: string;
  kind: 'contentType' | 'component';
  label: string;
  collectionName: string;
  /** Singular snake name used for join-table columns (`<singular>_id`). */
  singular: string;
  attributes: Record<string, RawAttribute>;
}

function contentTypeOwner(raw: RawSchema): Owner {
  return {
    uid: contentTypeUid(raw),
    kind: 'contentType',
    label: raw.info.displayName,
    collectionName: raw.collectionName,
    singular: snake(raw.info.singularName),
    attributes: raw.attributes as Record<string, RawAttribute>,
  };
}

function componentOwner(uid: string, raw: RawComponentSchema): Owner {
  return {
    uid,
    kind: 'component',
    label: raw.info.displayName,
    collectionName: raw.collectionName,
    singular: snake(uid.split('.')[1]),
    attributes: raw.attributes as Record<string, RawAttribute>,
  };
}

function ownersOf(snapshot: RegistrySnapshot): Map<string, Owner> {
  const owners = new Map<string, Owner>();
  for (const raw of snapshot.contentTypes) owners.set(contentTypeUid(raw), contentTypeOwner(raw));
  for (const { uid, schema } of snapshot.components) owners.set(uid, componentOwner(uid, schema));
  return owners;
}

const ownsComponents = (owner: Owner) => Object.values(owner.attributes).some((a) => a.type === 'component' || a.type === 'dynamiczone');
const isOwningRelation = (attr: RawAttribute) => attr.type === 'relation' && !attr.mappedBy;

function relationMapFor(owner: Owner, attrName: string, attr: RawAttribute, targets: Map<string, Owner>): RelationTableMap {
  const target = targets.get(attr.target!);
  if (!target) throw new SchemaValidationError(`Relation "${attrName}" on ${owner.label} points at unknown type ${attr.target}`);
  const targetSingular = target.singular === owner.singular ? `inv_${target.singular}` : target.singular;
  const toMany = attr.relation === 'oneToMany' || attr.relation === 'manyToMany';
  const fromMany = attr.relation === 'manyToOne' || attr.relation === 'manyToMany';
  return {
    table: shortIdentifier(`${owner.collectionName}_${snake(attrName)}_lnk`),
    ownerColumn: `${owner.singular}_id`,
    targetColumn: `${targetSingular}_id`,
    ...(toMany ? { targetOrderColumn: `${targetSingular}_ord` } : {}),
    ...(fromMany && owner.kind === 'contentType' ? { ownerOrderColumn: `${owner.singular}_ord` } : {}),
  };
}

function createRelationTableSql(map: RelationTableMap, ownerTable: string, targetTable: string): string[] {
  const t = map.table;
  const cols = [
    'id SERIAL PRIMARY KEY',
    `${q(map.ownerColumn)} INTEGER`,
    `${q(map.targetColumn)} INTEGER`,
    ...(map.targetOrderColumn ? [`${q(map.targetOrderColumn)} DOUBLE PRECISION`] : []),
    ...(map.ownerOrderColumn ? [`${q(map.ownerOrderColumn)} DOUBLE PRECISION`] : []),
    `CONSTRAINT ${q(shortIdentifier(`${t}_fk`))} FOREIGN KEY (${q(map.ownerColumn)}) REFERENCES ${q(ownerTable)}(id) ON DELETE CASCADE`,
    `CONSTRAINT ${q(shortIdentifier(`${t}_ifk`))} FOREIGN KEY (${q(map.targetColumn)}) REFERENCES ${q(targetTable)}(id) ON DELETE CASCADE`,
    `CONSTRAINT ${q(shortIdentifier(`${t}_uq`))} UNIQUE (${q(map.ownerColumn)}, ${q(map.targetColumn)})`,
  ];
  return [`CREATE TABLE IF NOT EXISTS ${q(t)} (\n  ${cols.join(',\n  ')}\n)`];
}

function createCmpsTableSql(collection: string): string[] {
  const cmps = shortIdentifier(`${collection}_cmps`);
  return [
    `CREATE TABLE IF NOT EXISTS ${q(cmps)} (
  id SERIAL PRIMARY KEY,
  entity_id INTEGER,
  cmp_id INTEGER,
  component_type VARCHAR(255),
  field VARCHAR(255),
  "order" DOUBLE PRECISION,
  CONSTRAINT ${q(shortIdentifier(`${collection}_entity_fk`))} FOREIGN KEY (entity_id) REFERENCES ${q(collection)}(id) ON DELETE CASCADE,
  CONSTRAINT ${q(shortIdentifier(`${collection}_uq`))} UNIQUE (entity_id, cmp_id, field, component_type)
)`,
    `CREATE INDEX IF NOT EXISTS ${q(shortIdentifier(`${collection}_component_type_idx`))} ON ${q(cmps)}(component_type)`,
    `CREATE INDEX IF NOT EXISTS ${q(shortIdentifier(`${collection}_field_idx`))} ON ${q(cmps)}(field)`,
  ];
}

function createOwnerTableSql(owner: Owner): string[] {
  const t = owner.collectionName;
  const scalarCols = Object.entries(owner.attributes)
    .map(([name, attr]) => [toColumnName(name), columnType(attr)] as const)
    .filter((entry): entry is readonly [string, string] => entry[1] != null)
    .map(([col, type]) => `${q(col)} ${type}`);

  if (owner.kind === 'component') {
    return [`CREATE TABLE IF NOT EXISTS ${q(t)} (\n  ${['id SERIAL PRIMARY KEY', ...scalarCols].join(',\n  ')}\n)`];
  }
  const cols = [
    'id SERIAL PRIMARY KEY',
    'document_id VARCHAR(255)',
    ...scalarCols,
    'created_at TIMESTAMP(6)',
    'updated_at TIMESTAMP(6)',
    'published_at TIMESTAMP(6)',
    'created_by_id INTEGER',
    'updated_by_id INTEGER',
    'locale VARCHAR(255)',
    `CONSTRAINT ${q(shortIdentifier(`${t}_created_by_id_fk`))} FOREIGN KEY (created_by_id) REFERENCES admin_users(id) ON DELETE SET NULL`,
    `CONSTRAINT ${q(shortIdentifier(`${t}_updated_by_id_fk`))} FOREIGN KEY (updated_by_id) REFERENCES admin_users(id) ON DELETE SET NULL`,
  ];
  return [
    `CREATE TABLE IF NOT EXISTS ${q(t)} (\n  ${cols.join(',\n  ')}\n)`,
    `CREATE INDEX IF NOT EXISTS ${q(shortIdentifier(`${t}_documents_idx`))} ON ${q(t)}(document_id, locale, published_at)`,
  ];
}

/** Deletes the component rows (and their links) a component/dynamic-zone field owned. */
function deleteComponentFieldSql(owner: Owner, fieldName: string, componentUids: string[], targets: Map<string, Owner>): string[] {
  const cmps = q(shortIdentifier(`${owner.collectionName}_cmps`));
  const statements: string[] = [];
  for (const uid of componentUids) {
    const component = targets.get(uid);
    if (component) {
      statements.push(
        `DELETE FROM ${q(component.collectionName)} WHERE id IN (SELECT cmp_id FROM ${cmps} WHERE field = ${literal(fieldName)} AND component_type = ${literal(uid)})`,
      );
    }
  }
  statements.push(`DELETE FROM ${cmps} WHERE field = ${literal(fieldName)} AND component_type IN (${componentUids.map(literal).join(', ')})`);
  return statements;
}

// ─── Validation ─────────────────────────────────────────────────────────────────────────────────

function validateTarget(target: RegistrySnapshot): void {
  const owners = ownersOf(target);
  const tables = new Map<string, string>();

  for (const owner of owners.values()) {
    q(owner.collectionName);
    const clash = tables.get(owner.collectionName);
    if (clash) throw new SchemaValidationError(`${owner.label} and ${clash} would share the table "${owner.collectionName}"`);
    tables.set(owner.collectionName, owner.label);

    const columns = new Set<string>();
    for (const [name, attr] of Object.entries(owner.attributes)) {
      if (!ATTRIBUTE_NAME.test(name)) throw new SchemaValidationError(`"${name}" on ${owner.label}: field names must start with a letter and use only letters, digits and _`);
      if (RESERVED_ATTRIBUTES.has(name)) throw new SchemaValidationError(`"${name}" is a reserved field name`);
      const col = toColumnName(name);
      if (columns.has(col)) throw new SchemaValidationError(`Two fields on ${owner.label} map to the same column "${col}"`);
      columns.add(col);
      columnType(attr); // throws on unsupported types

      if (attr.type === 'enumeration' && (!attr.enum || attr.enum.length === 0)) {
        throw new SchemaValidationError(`Enumeration "${name}" on ${owner.label} needs at least one value`);
      }
      if (attr.type === 'component' && (!attr.component || !owners.has(attr.component))) {
        throw new SchemaValidationError(`"${name}" on ${owner.label} uses a component that doesn't exist (${attr.component})`);
      }
      if (attr.type === 'dynamiczone') {
        if (!attr.components?.length) throw new SchemaValidationError(`Dynamic zone "${name}" on ${owner.label} needs at least one component`);
        const missing = attr.components.filter((c) => !owners.has(c));
        if (missing.length) throw new SchemaValidationError(`Dynamic zone "${name}" on ${owner.label} uses missing components: ${missing.join(', ')}`);
      }
      if (attr.type === 'relation' && (!attr.target || !owners.has(attr.target) || owners.get(attr.target)!.kind !== 'contentType')) {
        throw new SchemaValidationError(`Relation "${name}" on ${owner.label} must point at an existing content type`);
      }
      if (owner.kind === 'component' && attr.type === 'dynamiczone') {
        throw new SchemaValidationError(`Components can't contain dynamic zones (${owner.label}.${name})`);
      }
    }
  }
}

// ─── Planning ───────────────────────────────────────────────────────────────────────────────────

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function planSchemaChange(before: RegistrySnapshot, after: RegistrySnapshot): SchemaPlan {
  validateTarget(after);

  const beforeOwners = ownersOf(before);
  const afterOwners = ownersOf(after);
  const relationTables: Record<string, RelationTableMap> = { ...before.relationTables };

  const creates: SchemaChange[] = [];
  const alters: SchemaChange[] = [];
  const drops: SchemaChange[] = [];

  // Created owners: table first, then link tables (after every new table exists).
  const linkCreates: SchemaChange[] = [];
  for (const owner of afterOwners.values()) {
    const previous = beforeOwners.get(owner.uid);
    if (previous) {
      if (previous.collectionName !== owner.collectionName) throw new SchemaValidationError(`Renaming ${owner.label}'s table isn't supported`);
      continue;
    }
    const sql = createOwnerTableSql(owner);
    if (ownsComponents(owner)) sql.push(...createCmpsTableSql(owner.collectionName));
    creates.push({ description: `Create ${owner.kind === 'component' ? 'component' : 'content type'} "${owner.label}" (table ${owner.collectionName})`, destructive: false, sql });
    for (const [name, attr] of Object.entries(owner.attributes)) {
      if (!isOwningRelation(attr)) continue;
      const map = relationMapFor(owner, name, attr, afterOwners);
      relationTables[`${owner.uid}.${name}`] = map;
      linkCreates.push({
        description: `Create relation ${owner.label}.${name} → ${afterOwners.get(attr.target!)!.label}`,
        destructive: false,
        sql: createRelationTableSql(map, owner.collectionName, afterOwners.get(attr.target!)!.collectionName),
      });
    }
  }

  // Changed owners: field-by-field.
  for (const owner of afterOwners.values()) {
    const previous = beforeOwners.get(owner.uid);
    if (!previous) continue;
    const t = owner.collectionName;
    let needsCmps = !ownsComponents(previous) && ownsComponents(owner);

    for (const [name, attr] of Object.entries(owner.attributes)) {
      const old = previous.attributes[name];
      const col = toColumnName(name);
      if (!old) {
        const type = columnType(attr);
        if (type) alters.push({ description: `Add field ${owner.label}.${name}`, destructive: false, sql: [`ALTER TABLE ${q(t)} ADD COLUMN IF NOT EXISTS ${q(col)} ${type}`] });
        else if (isOwningRelation(attr)) {
          const map = relationMapFor(owner, name, attr, afterOwners);
          relationTables[`${owner.uid}.${name}`] = map;
          linkCreates.push({
            description: `Add relation ${owner.label}.${name} → ${afterOwners.get(attr.target!)!.label}`,
            destructive: false,
            sql: createRelationTableSql(map, t, afterOwners.get(attr.target!)!.collectionName),
          });
        } else if (attr.type === 'component' || attr.type === 'dynamiczone') {
          needsCmps = true;
          alters.push({ description: `Add field ${owner.label}.${name}`, destructive: false, sql: [] });
        } else {
          alters.push({ description: `Add field ${owner.label}.${name}`, destructive: false, sql: [] });
        }
        continue;
      }
      if (sameJson(old, attr)) continue;
      // Changed field: only settings that don't change storage are allowed.
      if (old.type !== attr.type || columnType(old) !== columnType(attr)) {
        throw new SchemaValidationError(`Can't change the type of ${owner.label}.${name} — delete it and add a new field instead`);
      }
      if (attr.type === 'relation' && (old.target !== attr.target || old.relation !== attr.relation)) {
        throw new SchemaValidationError(`Can't change the target or kind of relation ${owner.label}.${name} — delete it and add a new one`);
      }
      if (attr.type === 'component' && old.component !== attr.component) {
        throw new SchemaValidationError(`Can't change which component ${owner.label}.${name} uses — delete it and add a new field`);
      }
      const sql: string[] = [];
      let destructive = false;
      if (attr.type === 'dynamiczone') {
        const removed = (old.components ?? []).filter((c) => !(attr.components ?? []).includes(c));
        if (removed.length) {
          destructive = true;
          sql.push(...deleteComponentFieldSql(owner, name, removed, beforeOwners));
        }
      }
      if (attr.type === 'media' && old.multiple && !attr.multiple) {
        // Keep only the first file per entry when a field goes from multiple → single.
        destructive = true;
        sql.push(
          `DELETE FROM files_related_mph WHERE related_type = ${literal(owner.uid)} AND field = ${literal(name)} AND "order" > 1`,
        );
      }
      alters.push({ description: `Update field ${owner.label}.${name}`, destructive, sql });
    }
    if (needsCmps) alters.unshift({ description: `Add component links table for ${owner.label}`, destructive: false, sql: createCmpsTableSql(t) });

    for (const [name, old] of Object.entries(previous.attributes)) {
      if (owner.attributes[name]) continue;
      const description = `Delete field ${owner.label}.${name} and its data`;
      const type = columnType(old);
      if (type) {
        drops.push({ description, destructive: true, sql: [`ALTER TABLE ${q(t)} DROP COLUMN IF EXISTS ${q(toColumnName(name))}`] });
      } else if (old.type === 'media') {
        drops.push({ description, destructive: true, sql: [`DELETE FROM files_related_mph WHERE related_type = ${literal(owner.uid)} AND field = ${literal(name)}`] });
      } else if (old.type === 'component' || old.type === 'dynamiczone') {
        const uids = old.type === 'component' ? [old.component!] : old.components ?? [];
        drops.push({ description, destructive: true, sql: deleteComponentFieldSql(previous, name, uids, beforeOwners) });
      } else if (old.type === 'relation') {
        const key = `${owner.uid}.${name}`;
        const map = before.relationTables[key];
        delete relationTables[key];
        drops.push({ description, destructive: true, sql: map && !old.mappedBy ? [`DROP TABLE IF EXISTS ${q(map.table)}`] : [] });
      }
    }
  }

  // Removed owners: their link tables, then the table itself.
  for (const owner of beforeOwners.values()) {
    if (afterOwners.has(owner.uid)) continue;
    const sql: string[] = [];
    for (const [name, attr] of Object.entries(owner.attributes)) {
      const key = `${owner.uid}.${name}`;
      const map = before.relationTables[key];
      if (map && attr.type === 'relation' && !attr.mappedBy) sql.push(`DROP TABLE IF EXISTS ${q(map.table)}`);
      delete relationTables[key];
      // Component rows this owner's entries own (components may be shared, so delete by link, not table).
      if (attr.type === 'component' || attr.type === 'dynamiczone') {
        const uids = (attr.type === 'component' ? [attr.component!] : attr.components ?? []).filter((uid) => afterOwners.has(uid));
        if (uids.length) sql.push(...deleteComponentFieldSql(owner, name, uids, beforeOwners));
      }
    }
    // Links pointing at this owner from other owners' _cmps tables (components) are removed by the
    // referencing owners' own field deletion — validateTarget guarantees nothing references it now.
    sql.push(`DELETE FROM files_related_mph WHERE related_type = ${literal(owner.uid)}`);
    sql.push(`DROP TABLE IF EXISTS ${q(shortIdentifier(`${owner.collectionName}_cmps`))}`);
    sql.push(`DROP TABLE IF EXISTS ${q(owner.collectionName)}`);
    drops.push({
      description: owner.kind === 'component' ? `Delete component "${owner.label}" and its stored data` : `Delete content type "${owner.label}" and all its entries`,
      destructive: true,
      sql,
    });
  }

  return {
    changes: [...creates, ...linkCreates, ...alters, ...drops].filter((c) => c.sql.length > 0 || !c.destructive),
    target: { ...after, relationTables },
  };
}

/** Owners that reference a component or content type — used to block deletes that would dangle. */
export function findReferences(snapshot: RegistrySnapshot, uid: string): string[] {
  const refs: string[] = [];
  for (const owner of ownersOf(snapshot).values()) {
    if (owner.uid === uid) continue;
    for (const [name, attr] of Object.entries(owner.attributes)) {
      if (
        (attr.type === 'component' && attr.component === uid) ||
        (attr.type === 'dynamiczone' && attr.components?.includes(uid)) ||
        (attr.type === 'relation' && attr.target === uid)
      ) {
        refs.push(`${owner.label}.${name}`);
      }
    }
  }
  return refs;
}

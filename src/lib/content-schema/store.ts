import type { PrismaClient } from '@prisma/client';
import { staticRawComponents, staticRawContentTypes, type RawComponentSchema, type RawSchema } from './loader';
import { relationTables as staticRelationTables } from './relation-tables';
import type { RelationTableMap } from './types';

/**
 * DB persistence for the content-type registry. Tables (see
 * prisma/manual-migrations/0004_cms_schema_registry.sql):
 *   watchtower_cms_content_types (uid, schema jsonb)  — raw Strapi schema.json per content type
 *   watchtower_cms_components    (uid, schema jsonb)  — raw Strapi component json
 *   watchtower_cms_relation_tables (key, map jsonb)   — `${ownerUid}.${attr}` → join-table shape
 *   watchtower_cms_schema_state  (version)            — bumped on every schema change
 */

type RawClient = Pick<PrismaClient, '$queryRawUnsafe' | '$executeRawUnsafe'>;

export interface RegistrySnapshot {
  version: number;
  source: 'db' | 'static';
  contentTypes: RawSchema[];
  components: { uid: string; schema: RawComponentSchema }[];
  relationTables: Record<string, RelationTableMap>;
}

export function contentTypeUid(raw: RawSchema): string {
  return `api::${raw.info.singularName}.${raw.info.singularName}`;
}

export function staticSnapshot(): RegistrySnapshot {
  return {
    version: 0,
    source: 'static',
    contentTypes: staticRawContentTypes,
    components: staticRawComponents,
    relationTables: staticRelationTables,
  };
}

function isMissingTable(err: unknown): boolean {
  const text = String((err as { message?: string })?.message ?? err);
  return text.includes('42P01') || /relation "watchtower_cms_[a-z_]+" does not exist/.test(text);
}

/** null when the registry tables haven't been created on this database yet. */
export async function readSchemaVersion(client: RawClient): Promise<number | null> {
  try {
    const rows = await client.$queryRawUnsafe<{ version: bigint | number }[]>('SELECT version FROM watchtower_cms_schema_state WHERE id = 1');
    return rows[0] ? Number(rows[0].version) : null;
  } catch (err) {
    if (isMissingTable(err)) return null;
    throw err;
  }
}

/** First load on a database whose registry tables are still empty: copy the static schemas in. */
export async function seedFromStatic(client: RawClient): Promise<void> {
  const seed = staticSnapshot();
  for (const raw of seed.contentTypes) {
    await client.$executeRawUnsafe(
      'INSERT INTO watchtower_cms_content_types (uid, schema) VALUES ($1, $2) ON CONFLICT (uid) DO NOTHING',
      contentTypeUid(raw),
      JSON.stringify(raw),
    );
  }
  for (const { uid, schema } of seed.components) {
    await client.$executeRawUnsafe(
      'INSERT INTO watchtower_cms_components (uid, schema) VALUES ($1, $2) ON CONFLICT (uid) DO NOTHING',
      uid,
      JSON.stringify(schema),
    );
  }
  for (const [key, map] of Object.entries(seed.relationTables)) {
    await client.$executeRawUnsafe(
      'INSERT INTO watchtower_cms_relation_tables (key, map) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
      key,
      JSON.stringify(map),
    );
  }
}

export async function readSnapshot(client: RawClient, options: { seedIfEmpty?: boolean } = {}): Promise<RegistrySnapshot | null> {
  const version = await readSchemaVersion(client);
  if (version == null) return null;

  let contentTypes = await client.$queryRawUnsafe<{ schema: RawSchema }[]>('SELECT schema FROM watchtower_cms_content_types ORDER BY uid');
  if (contentTypes.length === 0) {
    if (options.seedIfEmpty === false) return null;
    await seedFromStatic(client);
    contentTypes = await client.$queryRawUnsafe<{ schema: RawSchema }[]>('SELECT schema FROM watchtower_cms_content_types ORDER BY uid');
  }
  const components = await client.$queryRawUnsafe<{ uid: string; schema: RawComponentSchema }[]>('SELECT uid, schema FROM watchtower_cms_components ORDER BY uid');
  const relationRows = await client.$queryRawUnsafe<{ key: string; map: RelationTableMap }[]>('SELECT key, map FROM watchtower_cms_relation_tables');

  return {
    version,
    source: 'db',
    contentTypes: contentTypes.map((r) => r.schema),
    components,
    relationTables: Object.fromEntries(relationRows.map((r) => [r.key, r.map])),
  };
}

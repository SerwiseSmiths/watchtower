import type { PrismaClient } from '@prisma/client';
import type { SchemaPlan } from './ddl';
import { contentTypeUid, type RegistrySnapshot } from './store';

type TxClient = Pick<PrismaClient, '$executeRawUnsafe'>;

/** Editing schemas runs DDL, so it's only on where explicitly enabled (dev/local); prod gets
 *  changes through `yarn cms:sync-schema`. */
export function isSchemaEditingEnabled(): boolean {
  return process.env.CMS_SCHEMA_EDITING === 'true';
}

async function writeRegistryRows(tx: TxClient, before: RegistrySnapshot, after: RegistrySnapshot): Promise<void> {
  const beforeTypes = new Map(before.contentTypes.map((c) => [contentTypeUid(c), c]));
  const afterTypes = new Map(after.contentTypes.map((c) => [contentTypeUid(c), c]));
  for (const [uid, schema] of afterTypes) {
    if (JSON.stringify(beforeTypes.get(uid)) === JSON.stringify(schema) && before.source === 'db') continue;
    await tx.$executeRawUnsafe(
      `INSERT INTO watchtower_cms_content_types (uid, schema, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (uid) DO UPDATE SET schema = EXCLUDED.schema, updated_at = now()`,
      uid,
      JSON.stringify(schema),
    );
  }
  for (const uid of beforeTypes.keys()) {
    if (!afterTypes.has(uid)) await tx.$executeRawUnsafe('DELETE FROM watchtower_cms_content_types WHERE uid = $1', uid);
  }

  const beforeComponents = new Map(before.components.map((c) => [c.uid, c.schema]));
  const afterComponents = new Map(after.components.map((c) => [c.uid, c.schema]));
  for (const [uid, schema] of afterComponents) {
    if (JSON.stringify(beforeComponents.get(uid)) === JSON.stringify(schema) && before.source === 'db') continue;
    await tx.$executeRawUnsafe(
      `INSERT INTO watchtower_cms_components (uid, schema, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (uid) DO UPDATE SET schema = EXCLUDED.schema, updated_at = now()`,
      uid,
      JSON.stringify(schema),
    );
  }
  for (const uid of beforeComponents.keys()) {
    if (!afterComponents.has(uid)) await tx.$executeRawUnsafe('DELETE FROM watchtower_cms_components WHERE uid = $1', uid);
  }

  for (const [key, map] of Object.entries(after.relationTables)) {
    if (JSON.stringify(before.relationTables[key]) === JSON.stringify(map) && before.source === 'db') continue;
    await tx.$executeRawUnsafe(
      'INSERT INTO watchtower_cms_relation_tables (key, map) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET map = EXCLUDED.map',
      key,
      JSON.stringify(map),
    );
  }
  for (const key of Object.keys(before.relationTables)) {
    if (!(key in after.relationTables)) await tx.$executeRawUnsafe('DELETE FROM watchtower_cms_relation_tables WHERE key = $1', key);
  }
}

/**
 * Runs the plan's DDL and the registry update in ONE transaction (Postgres DDL is transactional),
 * so a failure halfway leaves neither the tables nor the registry changed. Bumps the schema version
 * last so every server instance reloads on its next request.
 */
export async function applySchemaPlan(client: PrismaClient, before: RegistrySnapshot, plan: SchemaPlan): Promise<void> {
  await client.$transaction(
    async (tx) => {
      for (const change of plan.changes) {
        for (const sql of change.sql) await tx.$executeRawUnsafe(sql);
      }
      await writeRegistryRows(tx, before, plan.target);
      await tx.$executeRawUnsafe('UPDATE watchtower_cms_schema_state SET version = version + 1, updated_at = now() WHERE id = 1');
    },
    { timeout: 120_000, maxWait: 15_000 },
  );
}

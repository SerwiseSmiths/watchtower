/**
 * Copies Content-Type Builder schema changes from one database to another (normally
 * watchtower-dev → watchtower prod). Content (entries) is never copied — only types, fields and
 * the tables behind them.
 *
 *   SOURCE_DATABASE_URL=<dev url> TARGET_DATABASE_URL=<prod url> yarn cms:sync-schema            # dry run
 *   SOURCE_DATABASE_URL=...      TARGET_DATABASE_URL=...      yarn cms:sync-schema --apply    # apply
 *   ... --apply --allow-data-loss   # also needed when the plan drops fields/types
 *   ... --sql                       # print the SQL statements too
 *
 * "Before" is what the target database ACTUALLY has: registry rows (or the bundled
 * content-schemas/ files if the registry isn't there yet), minus any table or column missing from
 * the target. So tables that were only ever created on dev get created on the target too.
 * The dry run is read-only.
 */
import { neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import path from 'path';
import ws from 'ws';
import { applySchemaPlan } from '../src/lib/content-schema/apply';
import { columnType, planSchemaChange, toColumnName } from '../src/lib/content-schema/ddl';
import type { RawAttribute } from '../src/lib/content-schema/loader';
import { readSnapshot, staticSnapshot, type RegistrySnapshot } from '../src/lib/content-schema/store';

neonConfig.webSocketConstructor = ws;

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const allowDataLoss = args.has('--allow-data-loss');
const showSql = args.has('--sql');

function client(url: string | undefined, name: string): PrismaClient {
  if (!url) throw new Error(`${name} is not set`);
  return new PrismaClient({ adapter: new PrismaNeon({ connectionString: url }) });
}

const dbName = (url: string) => new URL(url).pathname.slice(1);

/** Narrows a registry snapshot to the tables/columns that really exist in this database. */
async function actualState(db: PrismaClient, registry: RegistrySnapshot): Promise<RegistrySnapshot> {
  const rows = await db.$queryRawUnsafe<{ t: string; c: string }[]>(
    `SELECT table_name::text AS t, column_name::text AS c FROM information_schema.columns WHERE table_schema = 'public'`,
  );
  const columns = new Map<string, Set<string>>();
  for (const { t, c } of rows) (columns.get(t) ?? columns.set(t, new Set()).get(t)!).add(c);

  const keepAttributes = (table: string, attributes: Record<string, RawAttribute>) =>
    Object.fromEntries(
      Object.entries(attributes).filter(([name, attr]) => columnType(attr) == null || columns.get(table)!.has(toColumnName(name))),
    );

  return {
    ...registry,
    contentTypes: registry.contentTypes
      .filter((c) => columns.has(c.collectionName))
      .map((c) => ({ ...c, attributes: keepAttributes(c.collectionName, c.attributes as Record<string, RawAttribute>) })),
    components: registry.components
      .filter((c) => columns.has(c.schema.collectionName))
      .map((c) => ({ uid: c.uid, schema: { ...c.schema, attributes: keepAttributes(c.schema.collectionName, c.schema.attributes as Record<string, RawAttribute>) } })),
    relationTables: Object.fromEntries(Object.entries(registry.relationTables).filter(([, map]) => columns.has(map.table))),
  };
}

async function ensureRegistryTables(db: PrismaClient) {
  const sql = readFileSync(path.join(__dirname, '../prisma/manual-migrations/0004_cms_schema_registry.sql'), 'utf8')
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const statement of sql) await db.$executeRawUnsafe(statement);
}

async function main() {
  const sourceUrl = process.env.SOURCE_DATABASE_URL;
  const targetUrl = process.env.TARGET_DATABASE_URL;
  const source = client(sourceUrl, 'SOURCE_DATABASE_URL');
  const target = client(targetUrl, 'TARGET_DATABASE_URL');
  try {
    console.log(`Source: ${dbName(sourceUrl!)}   Target: ${dbName(targetUrl!)}   Mode: ${apply ? 'APPLY' : 'dry run'}\n`);
    if (dbName(sourceUrl!) === dbName(targetUrl!) && new URL(sourceUrl!).host === new URL(targetUrl!).host) {
      throw new Error('Source and target are the same database');
    }

    const desired = await readSnapshot(source, { seedIfEmpty: false });
    if (!desired) throw new Error('The source database has no schema registry (apply 0004 there and open /cms once).');

    const targetRegistry = (await readSnapshot(target, { seedIfEmpty: false })) ?? staticSnapshot();
    const before = await actualState(target, targetRegistry);
    const plan = planSchemaChange(before, desired);

    if (plan.changes.length === 0) console.log('No table changes — target already matches.');
    for (const change of plan.changes) {
      console.log(`${change.destructive ? '⚠ DATA LOSS' : '•'} ${change.description}`);
      if (showSql) for (const sql of change.sql) console.log(`    ${sql.replace(/\n/g, '\n    ')};`);
    }
    console.log('\nThe target registry will match the source exactly (types, components, relations).');

    const destructive = plan.changes.filter((c) => c.destructive);
    if (!apply) {
      console.log('\nDry run — nothing was changed. Re-run with --apply to apply.');
      return;
    }
    if (destructive.length && !allowDataLoss) {
      throw new Error(`${destructive.length} change(s) delete data on ${dbName(targetUrl!)}. Re-run with --allow-data-loss if that is intended.`);
    }

    await ensureRegistryTables(target);
    // Registry rows are rewritten from `before` (the target's actual state), so every row is upserted.
    await applySchemaPlan(target, { ...before, source: 'static' }, plan);
    console.log(`\nApplied to ${dbName(targetUrl!)}. Running apps pick it up within a few seconds.`);
  } finally {
    await Promise.all([source.$disconnect(), target.$disconnect()]);
  }
}

main().catch((err) => {
  console.error(`\n✗ ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});

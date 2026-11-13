/**
 * One-off content move (2026-11-01): the Complaint Page and Login single types become ordinary
 * pages so they're edited with everything else:
 *   Complaint Page (serwise app popup)  → Page     "Complaint Detail" (handle complaint-detail)
 *                                          blocks: advertisement, resolution-steps, info-blocks
 *   Login (website login drawer)        → Web Page "Login" (handle login)
 *                                          blocks: web.login
 * Both are created and published. Existing pages with those handles are left alone (never
 * overwritten), so it's safe to re-run. The old single types are not deleted — installed app
 * builds still read them.
 *
 * Needs the new components on the target DB first (dev: already applied; prod: `yarn cms:sync-schema`).
 *   npx tsx --env-file=.env scripts/cms-move-singletons.ts            # dry run
 *   npx tsx --env-file=.env scripts/cms-move-singletons.ts --apply
 */
import { ensureSchemaRegistry, getComponent } from '../src/lib/content-schema/registry';
import { createEntity, findSingleType, listEntities, publishEntity } from '../src/lib/db/entity-repository';
import { prisma } from '../src/lib/db/prisma';

const apply = process.argv.includes('--apply');

type Row = Record<string, unknown>;

const PAGE_UID = 'api::page.page';
const WEB_PAGE_UID = 'api::web-page.web-page';
const SYSTEM_FIELDS = new Set(['id', 'documentId', 'createdAt', 'updatedAt', 'publishedAt', 'locale', 'createdBy', 'updatedBy']);

/** Repository writes end with Next's revalidateTag, which throws outside a request — the DB write
 *  has already committed by then, so only that specific error is ignored. */
async function ignoreRevalidate<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof Error && /static generation store missing|revalidateTag|outside a request scope/i.test(err.message)) return undefined;
    throw err;
  }
}

function content(row: Row | null | undefined): Row {
  return Object.fromEntries(Object.entries(row ?? {}).filter(([key]) => !SYSTEM_FIELDS.has(key)));
}

async function findPage(uid: string, handle: string): Promise<Row | null> {
  const result = await listEntities(uid, { status: 'draft', filters: { handle }, pageSize: 1 });
  return (result.data[0] as Row | undefined) ?? null;
}

async function createAndPublish(uid: string, label: string, data: Row) {
  const handle = data.handle as string;
  if (await findPage(uid, handle)) {
    console.log(`• ${label}: a page with handle "${handle}" already exists — left as is.`);
    return;
  }
  const blocks = (data.blocks as Row[]).map((b) => b.__component).join(', ');
  if (!apply) {
    console.log(`• ${label}: would create + publish "${data.title}" (${handle}) with blocks: ${blocks}`);
    return;
  }
  await ignoreRevalidate(() => createEntity(uid, data));
  const draft = await findPage(uid, handle);
  if (!draft) throw new Error(`${label}: page was not created`);
  await ignoreRevalidate(() => publishEntity(uid, draft.id as number));
  console.log(`✓ ${label}: created + published "${data.title}" (${handle}) with blocks: ${blocks}`);
}

async function main() {
  await ensureSchemaRegistry({ force: true });
  for (const uid of ['blocks.resolution-steps', 'blocks.info-blocks', 'web.login']) {
    try {
      getComponent(uid);
    } catch {
      throw new Error(`Component ${uid} isn't in this database's schema yet — run \`yarn cms:sync-schema --apply\` first.`);
    }
  }
  console.log(`Database: ${new URL(process.env.DATABASE_URL!).pathname.slice(1)}   Mode: ${apply ? 'APPLY' : 'dry run'}\n`);

  const complaint = await findSingleType('api::complaint-page.complaint-page');
  const complaintBlocks: Row[] = [];
  if (complaint?.advertisement) complaintBlocks.push({ __component: 'blocks.advertisement', ...content(complaint.advertisement as Row) });
  complaintBlocks.push({ __component: 'blocks.resolution-steps', steps: ((complaint?.resolutionSteps as Row[]) ?? []).map(content) });
  complaintBlocks.push({ __component: 'blocks.info-blocks', items: ((complaint?.infoBlocks as Row[]) ?? []).map(content) });
  await createAndPublish(PAGE_UID, 'Complaint Page → Page', { title: 'Complaint Detail', handle: 'complaint-detail', blocks: complaintBlocks });

  const login = await findSingleType('api::login.login');
  await createAndPublish(WEB_PAGE_UID, 'Login → Web Page', {
    title: 'Login',
    handle: 'login',
    blocks: [{ __component: 'web.login', ...content(login) }],
  });

  if (!apply) console.log('\nDry run — nothing written. Re-run with --apply.');
}

main()
  .catch((err) => {
    console.error(`\n✗ ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

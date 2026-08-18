import { publishEntityAction, saveEntityAction, unpublishEntityAction } from '../src/app/admin/(dashboard)/content-manager/[type]/[id]/actions';
import { deleteEntity, findEntityByDocumentId } from '../src/lib/db/entity-repository';
import { prisma } from '../src/lib/db/prisma';

async function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(`FAILED: ${message}`);
  console.log(`OK: ${message}`);
}

/**
 * revalidatePath() requires Next's request-scoped context, which a standalone
 * script doesn't have — it always throws "static generation store missing"
 * *after* the actual repository write already completed. Swallow only that
 * specific error so this script can verify the real work each action does.
 */
async function callIgnoringRevalidateError<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof Error && err.message.includes('static generation store missing')) return undefined;
    throw err;
  }
}

async function main() {
  let documentId: string | undefined;
  try {
    const draftBefore = await callIgnoringRevalidateError(() =>
      saveEntityAction('subscription-plans', 'new', {
        key: 'ADMIN_ACTION_TEST',
        name: 'Admin Action Test Plan',
        annual_price: 500,
        monthly_price: 50,
        max_services: 1,
        duration_months: 12,
      }),
    );
    // saveEntityAction's own return value may be lost to the swallowed error, so look it up.
    const created = await prisma.subscription_plans.findFirst({ where: { key: 'ADMIN_ACTION_TEST' } });
    documentId = created?.document_id ?? undefined;
    await assert(!!documentId, 'saveEntityAction created a new entry');
    void draftBefore;

    const draft = await findEntityByDocumentId('api::subscription-plan.subscription-plan', documentId!, { status: 'draft' });
    await assert(draft?.name === 'Admin Action Test Plan', 'created entry has correct scalar data');

    await callIgnoringRevalidateError(() => saveEntityAction('subscription-plans', documentId!, { name: 'Admin Action Test Plan Updated' }));
    const updated = await findEntityByDocumentId('api::subscription-plan.subscription-plan', documentId!, { status: 'draft' });
    await assert(updated?.name === 'Admin Action Test Plan Updated', 'saveEntityAction updated an existing entry');

    await callIgnoringRevalidateError(() => publishEntityAction('subscription-plans', documentId!));
    const published = await findEntityByDocumentId('api::subscription-plan.subscription-plan', documentId!, { status: 'published' });
    await assert(published != null, 'publishEntityAction created a published row');

    await callIgnoringRevalidateError(() => unpublishEntityAction('subscription-plans', documentId!));
    const unpublished = await findEntityByDocumentId('api::subscription-plan.subscription-plan', documentId!, { status: 'published' });
    await assert(unpublished === null, 'unpublishEntityAction removed the published row');

    console.log('\nAll admin-action checks passed.');
  } finally {
    if (documentId) {
      const draft = await findEntityByDocumentId('api::subscription-plan.subscription-plan', documentId, { status: 'draft' });
      if (draft) await deleteEntity('api::subscription-plan.subscription-plan', draft.id as number);
    }
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

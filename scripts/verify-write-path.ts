import { createEntity, deleteEntity, findEntity, publishEntity, unpublishEntity, updateEntity } from '../src/lib/db/entity-repository';
import { prisma } from '../src/lib/db/prisma';

async function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(`FAILED: ${message}`);
  console.log(`OK: ${message}`);
}

async function main() {
  let dtId: number | undefined;
  let planId: number | undefined;

  try {
    // 1. simple content type, no components/media/relations: device-type
    const dt = await createEntity('api::device-type.device-type', { key: 'test_write_path', label: 'Test Write Path' });
    dtId = dt!.id as number;
    await assert(dt?.key === 'test_write_path', 'device-type created with correct scalar field');
    await assert(dt?.publishedAt != null, 'device-type (no draftAndPublish) is published immediately');

    const dtUpdated = await updateEntity('api::device-type.device-type', dtId, { label: 'Updated Label' });
    await assert(dtUpdated?.label === 'Updated Label', 'device-type update applied');

    await deleteEntity('api::device-type.device-type', dtId);
    dtId = undefined;
    const dtGone = await findEntity('api::device-type.device-type', dt!.id as number);
    await assert(dtGone === null, 'device-type deleted');

    // 2. draftAndPublish content type with components + media-free repeatable component: subscription-plan
    const plan = await createEntity('api::subscription-plan.subscription-plan', {
      key: 'TEST_PLAN',
      name: 'Test Plan',
      annual_price: 999,
      monthly_price: 99,
      max_services: 2,
      duration_months: 12,
      features: [
        { title: 'Feature A', description: 'desc A', qty: '1' },
        { title: 'Feature B', description: 'desc B', qty: '2' },
      ],
    });
    planId = plan!.id as number;
    await assert(plan?.publishedAt == null, 'subscription-plan created as draft (publishedAt null)');
    await assert(Array.isArray(plan?.features) && (plan.features as unknown[]).length === 2, 'subscription-plan features written (2 rows)');

    const planUpdated = await updateEntity('api::subscription-plan.subscription-plan', planId, {
      features: [{ title: 'Feature A2', description: 'desc A2', qty: '9' }],
    });
    await assert((planUpdated?.features as unknown[]).length === 1, 'subscription-plan features replaced on update (1 row)');

    const published = await publishEntity('api::subscription-plan.subscription-plan', planId);
    await assert(published?.publishedAt != null, 'subscription-plan publish created published row');
    await assert(published?.documentId === plan?.documentId, 'published row shares documentId with draft');
    await assert((published?.features as unknown[]).length === 1, 'published row has its own copy of features');

    await unpublishEntity('api::subscription-plan.subscription-plan', planId);
    const draftStill = await findEntity('api::subscription-plan.subscription-plan', planId);
    await assert(draftStill != null, 'draft survives unpublish');

    // cleanup: delete draft (published sibling already removed by unpublish)
    await deleteEntity('api::subscription-plan.subscription-plan', planId);
    const planGone = await findEntity('api::subscription-plan.subscription-plan', planId);
    await assert(planGone === null, 'subscription-plan draft deleted, test data cleaned up');
    planId = undefined;

    console.log('\nAll write-path checks passed.');
  } catch (err) {
    console.error(err);
    // best-effort cleanup so a failed assertion never leaves orphan test rows behind
    if (dtId != null) await deleteEntity('api::device-type.device-type', dtId).catch(() => {});
    if (planId != null) await deleteEntity('api::subscription-plan.subscription-plan', planId).catch(() => {});
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();

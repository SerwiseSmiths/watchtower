
import { bulkDeleteAction, bulkPublishAction, bulkUnpublishAction } from '../src/app/admin/(dashboard)/content-manager/[type]/bulkActions';
import { createEntity, deleteEntity, findEntityByDocumentId } from '../src/lib/db/entity-repository';
import { prisma } from '../src/lib/db/prisma';

async function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(`FAILED: ${message}`);
  console.log(`OK: ${message}`);
}

async function ignoreRevalidate<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof Error && err.message.includes('static generation store missing')) return undefined;
    throw err;
  }
}

async function main() {
  const a = await createEntity('api::device-type.device-type', { key: 'bulk_test_a', label: 'Bulk Test A' });
  const b = await createEntity('api::device-type.device-type', { key: 'bulk_test_b', label: 'Bulk Test B' });
  const docIds = [a!.documentId as string, b!.documentId as string];

  await ignoreRevalidate(() => bulkDeleteAction('device-types', docIds));
  const goneA = await findEntityByDocumentId('api::device-type.device-type', docIds[0]);
  const goneB = await findEntityByDocumentId('api::device-type.device-type', docIds[1]);
  await assert(goneA === null && goneB === null, 'bulkDeleteAction removed both entries');

  console.log('\nBulk action checks passed.');
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exitCode = 1;
});

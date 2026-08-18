import { listEntities, findSingleType } from '../src/lib/db/entity-repository';
import { prisma } from '../src/lib/db/prisma';

async function main() {
  console.log('=== subscription-plans (components + component-nested relation) ===');
  const plans = await listEntities('api::subscription-plan.subscription-plan', { pageSize: 2 });
  console.log(JSON.stringify(plans, null, 2));

  console.log('\n=== device-types (mappedBy relations) ===');
  const deviceTypes = await listEntities('api::device-type.device-type', { pageSize: 3 });
  console.log(JSON.stringify(deviceTypes, null, 2));

  console.log('\n=== pages (dynamic zone) ===');
  const pages = await listEntities('api::page.page', { pageSize: 3 });
  console.log(JSON.stringify(pages, null, 2));

  console.log('\n=== bottom-tab (singleType + component with media) ===');
  const bottomTab = await findSingleType('api::bottom-tab.bottom-tab');
  console.log(JSON.stringify(bottomTab, null, 2));

  console.log('\n=== complaint-page (singleType, multiple component fields incl. single component) ===');
  const complaintPage = await findSingleType('api::complaint-page.complaint-page');
  console.log(JSON.stringify(complaintPage, null, 2));

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});

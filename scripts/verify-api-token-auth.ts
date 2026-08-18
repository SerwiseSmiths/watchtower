import { authenticateApiToken, authorizeApiToken } from '../src/lib/auth/api-token';
import { prisma } from '../src/lib/db/prisma';

async function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(`FAILED: ${message}`);
  console.log(`OK: ${message}`);
}

async function main() {
  const rawToken = process.argv[2];
  if (!rawToken) {
    console.error('Usage: npx tsx scripts/verify-api-token-auth.ts <raw-token-from-create-api-token>');
    process.exit(1);
  }

  const valid = await authenticateApiToken(`Bearer ${rawToken}`);
  await assert(valid.authenticated, 'valid full-access token authenticates');
  await assert(valid.token?.type === 'full-access', 'token type is full-access');

  if (valid.token) {
    const canFind = await authorizeApiToken(valid.token, 'api::subscription-plan.subscription-plan', 'find');
    const canDelete = await authorizeApiToken(valid.token, 'api::subscription-plan.subscription-plan', 'delete');
    await assert(canFind, 'full-access token authorized for find');
    await assert(canDelete, 'full-access token authorized for delete');
  }

  const missing = await authenticateApiToken(null);
  await assert(!missing.authenticated, 'missing header is rejected');

  const malformed = await authenticateApiToken('Bearer not-a-real-token');
  await assert(!malformed.authenticated, 'garbage token is rejected');

  const wrongScheme = await authenticateApiToken(`Basic ${rawToken}`);
  await assert(!wrongScheme.authenticated, 'non-Bearer scheme is rejected');

  console.log('\nAll auth checks passed.');
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});

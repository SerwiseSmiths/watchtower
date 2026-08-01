import { signSession, verifyAdminCredentials, verifySession } from '../src/lib/auth/admin-session';
import { prisma } from '../src/lib/db/prisma';

async function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(`FAILED: ${message}`);
  console.log(`OK: ${message}`);
}

async function main() {
  const ok = await verifyAdminCredentials('test-admin@watchtower.local', 'TestPassword123!');
  await assert(ok != null, 'correct credentials verify successfully');

  const bad = await verifyAdminCredentials('test-admin@watchtower.local', 'wrong-password');
  await assert(bad === null, 'incorrect password is rejected');

  const unknownEmail = await verifyAdminCredentials('nobody@watchtower.local', 'whatever');
  await assert(unknownEmail === null, 'unknown email is rejected');

  if (ok) {
    const token = signSession({ sub: ok.id, email: ok.email });
    const verified = verifySession(token);
    await assert(verified?.sub === ok.id && verified.email === ok.email, 'session JWT round-trips correctly');
  }

  const tampered = verifySession('not.a.valid.jwt');
  await assert(tampered === null, 'malformed JWT is rejected');

  console.log('\nAll admin-auth checks passed.');
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});

import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/db/prisma';
import { requestOtp, verifyOtp } from '../src/lib/auth/otp';
import { findActiveOperatorByPhone, setOperatorActive } from '../src/lib/auth/operators';
import { createEnrollment, checkEnrollment, markEnrollmentUsed } from '../src/lib/auth/enrollment';
import {
  signPendingToken,
  verifyPendingToken,
  signRootSession,
  verifyRootSession,
} from '../src/lib/auth/root-session';
import { buildRegistrationOptions, buildAuthenticationOptions, revokeCredential } from '../src/lib/auth/webauthn';

async function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(`FAILED: ${message}`);
  console.log(`OK: ${message}`);
}

const TEST_PHONE = '9999900001';
const TEST_EMAIL = 'test-root-operator@watchtower.local';

async function main() {
  let adminUserId: number | undefined;
  let operatorId: number | undefined;
  let credentialId: number | undefined;

  try {
    // Fixtures: disposable admin_users row + operator
    const adminUser = await prisma.admin_users.create({
      data: { email: TEST_EMAIL, firstname: 'Test', lastname: 'Operator', is_active: true, blocked: false },
    });
    adminUserId = adminUser.id;

    const operator = await prisma.watchtower_root_operators.create({
      data: { admin_user_id: adminUserId, phone_number: TEST_PHONE },
    });
    operatorId = operator.id;

    // 1. Operator gating — unknown/inactive numbers rejected
    const unknown = await findActiveOperatorByPhone('0000000000');
    await assert(unknown === null, 'unknown phone number has no operator');

    const active = await findActiveOperatorByPhone(TEST_PHONE);
    await assert(active?.id === operatorId, 'known active phone resolves to the operator');

    await setOperatorActive(operatorId, false);
    const inactive = await findActiveOperatorByPhone(TEST_PHONE);
    await assert(inactive === null, 'deactivated operator is excluded from lookup');
    await setOperatorActive(operatorId, true);

    // 2. requestOtp rejects an unauthorized number without sending anything (no enumeration)
    const rejected = await requestOtp('0000000000');
    await assert(!rejected.ok, 'requestOtp rejects a number with no operator');

    // 3. OTP verify logic against a directly-seeded code (avoids depending on the real SMS provider)
    const rawCode = '482913';
    const codeHash = await bcrypt.hash(rawCode, 10);
    await prisma.watchtower_otp_codes.create({
      data: { phone_number: TEST_PHONE, code_hash: codeHash, expires_at: new Date(Date.now() + 60_000) },
    });

    const badCode = await verifyOtp(TEST_PHONE, '000000');
    await assert(!badCode.ok, 'wrong OTP code is rejected');

    const goodCode = await verifyOtp(TEST_PHONE, rawCode);
    await assert(goodCode.ok && goodCode.operatorId === operatorId, 'correct OTP verifies and resolves the operator');
    await assert(goodCode.ok && goodCode.hasCredentials === false, 'operator with zero passkeys reports hasCredentials=false');

    const reused = await verifyOtp(TEST_PHONE, rawCode);
    await assert(!reused.ok, 'OTP code cannot be reused after successful verification');

    // 4. Pending token + root session JWT round-trip
    const pending = signPendingToken(operatorId);
    const decodedPending = verifyPendingToken(pending);
    await assert(decodedPending?.operatorId === operatorId, 'pending 2FA token round-trips correctly');
    await assert(verifyPendingToken('not.a.jwt') === null, 'malformed pending token is rejected');

    const session = signRootSession(operatorId, adminUserId);
    const decodedSession = verifyRootSession(session);
    await assert(
      decodedSession?.operatorId === operatorId && decodedSession.adminUserId === adminUserId,
      'root session token round-trips correctly'
    );
    await assert(verifyRootSession(pending) === null, 'a pending token is not accepted as a root session (different purpose tag)');

    // 5. Enrollment lifecycle
    const enrollment = await createEnrollment(operatorId, 'test device');
    const validCheck = await checkEnrollment(enrollment.token);
    await assert(validCheck.ok && validCheck.operatorId === operatorId, 'fresh enrollment token is valid');

    await markEnrollmentUsed(enrollment.id);
    const usedCheck = await checkEnrollment(enrollment.token);
    await assert(!usedCheck.ok, 'used enrollment token is rejected');

    const expired = await prisma.watchtower_passkey_enrollments.create({
      data: { operator_id: operatorId, token: `${enrollment.token}-expired`, expires_at: new Date(Date.now() - 1000) },
    });
    const expiredCheck = await checkEnrollment(expired.token);
    await assert(!expiredCheck.ok, 'expired enrollment token is rejected');

    const bogusCheck = await checkEnrollment('does-not-exist');
    await assert(!bogusCheck.ok, 'unknown enrollment token is rejected');

    // 6. WebAuthn option builders shape check (no real authenticator here — see PROGRESS.md note)
    const regOptions = await buildRegistrationOptions(operatorId);
    await assert(regOptions.rp.id === process.env.WEBAUTHN_RP_ID, 'registration options use configured RP ID');
    await assert(regOptions.excludeCredentials?.length === 0, 'no credentials to exclude yet for a fresh operator');

    const credential = await prisma.watchtower_webauthn_credentials.create({
      data: {
        operator_id: operatorId,
        credential_id: 'test-credential-id',
        public_key: Buffer.from('fake-public-key'),
        counter: 0,
        device_label: 'test device',
      },
    });
    credentialId = credential.id;

    const authOptions = await buildAuthenticationOptions(operatorId);
    await assert(
      authOptions.allowCredentials?.some((c) => c.id === 'test-credential-id') ?? false,
      'authentication options list the registered credential'
    );

    await revokeCredential(credentialId);
    credentialId = undefined;
    const afterRevoke = await prisma.watchtower_webauthn_credentials.count({ where: { operator_id: operatorId } });
    await assert(afterRevoke === 0, 'revoked credential is removed');

    console.log('\nAll root-login checks passed.');
  } finally {
    // Clean up everything this script created — real operators/admins untouched.
    if (credentialId) await prisma.watchtower_webauthn_credentials.deleteMany({ where: { id: credentialId } });
    if (operatorId) {
      await prisma.watchtower_webauthn_credentials.deleteMany({ where: { operator_id: operatorId } });
      await prisma.watchtower_passkey_enrollments.deleteMany({ where: { operator_id: operatorId } });
      await prisma.watchtower_otp_codes.deleteMany({ where: { phone_number: TEST_PHONE } });
      await prisma.watchtower_root_operators.delete({ where: { id: operatorId } }).catch(() => {});
    }
    if (adminUserId) await prisma.admin_users.delete({ where: { id: adminUserId } }).catch(() => {});
    await prisma.$disconnect();
  }
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});

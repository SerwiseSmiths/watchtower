import jwt from 'jsonwebtoken';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type GenerateRegistrationOptionsOpts,
  type VerifyRegistrationResponseOpts,
  type VerifyAuthenticationResponseOpts,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  WebAuthnCredential,
} from '@simplewebauthn/server';
import { prisma } from '@/lib/db/prisma';

function rpConfig() {
  const rpID = process.env.WEBAUTHN_RP_ID;
  const rpName = process.env.WEBAUTHN_RP_NAME ?? 'Watchtower';
  const origin = process.env.WEBAUTHN_ORIGIN;
  if (!rpID || !origin) throw new Error('WEBAUTHN_RP_ID / WEBAUTHN_ORIGIN are not set');
  return { rpID, rpName, origin };
}

function getSecret(): string {
  const secret = process.env.ROOT_JWT_SECRET;
  if (!secret) throw new Error('ROOT_JWT_SECRET is not set');
  return secret;
}

/** Short-lived signed carrier for the WebAuthn challenge between generate-options and verify calls. */
export function signChallenge(operatorId: number, challenge: string): string {
  return jwt.sign({ operatorId, challenge, purpose: 'webauthn-challenge' }, getSecret(), { expiresIn: 120 });
}

export function verifyChallengeToken(token: string, operatorId: number): string | null {
  try {
    const decoded = jwt.verify(token, getSecret()) as { operatorId: number; challenge: string; purpose: string };
    if (decoded.purpose !== 'webauthn-challenge' || decoded.operatorId !== operatorId) return null;
    return decoded.challenge;
  } catch {
    return null;
  }
}

export async function buildRegistrationOptions(operatorId: number) {
  const operator = await prisma.watchtower_root_operators.findUnique({
    where: { id: operatorId },
    include: { admin_user: true, credentials: true },
  });
  if (!operator) throw new Error('Operator not found');

  const { rpID, rpName } = rpConfig();
  const opts: GenerateRegistrationOptionsOpts = {
    rpName,
    rpID,
    userName: operator.admin_user.email ?? operator.phone_number,
    userDisplayName: [operator.admin_user.firstname, operator.admin_user.lastname].filter(Boolean).join(' ') || operator.phone_number,
    attestationType: 'none',
    excludeCredentials: operator.credentials.map((c) => ({
      id: c.credential_id,
      transports: (c.transports as AuthenticatorTransportFuture[] | null) ?? undefined,
    })),
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
  };

  const options = await generateRegistrationOptions(opts);
  return options;
}

export async function verifyRegistration(
  operatorId: number,
  response: RegistrationResponseJSON,
  expectedChallenge: string,
  deviceLabel?: string
) {
  const { rpID, origin } = rpConfig();
  const verifyOpts: VerifyRegistrationResponseOpts = {
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
  };

  const verification = await verifyRegistrationResponse(verifyOpts);
  if (!verification.verified || !verification.registrationInfo) {
    return { verified: false as const };
  }

  const { credential } = verification.registrationInfo;
  await prisma.watchtower_webauthn_credentials.create({
    data: {
      operator_id: operatorId,
      credential_id: credential.id,
      public_key: Buffer.from(credential.publicKey),
      counter: BigInt(credential.counter),
      device_label: deviceLabel || null,
      transports: credential.transports ?? undefined,
    },
  });

  return { verified: true as const };
}

export async function revokeCredential(credentialId: number) {
  await prisma.watchtower_webauthn_credentials.delete({ where: { id: credentialId } });
}

export async function buildAuthenticationOptions(operatorId: number) {
  const credentials = await prisma.watchtower_webauthn_credentials.findMany({ where: { operator_id: operatorId } });
  const { rpID } = rpConfig();

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: credentials.map((c) => ({
      id: c.credential_id,
      transports: (c.transports as AuthenticatorTransportFuture[] | null) ?? undefined,
    })),
    userVerification: 'preferred',
  });

  return options;
}

export async function verifyAssertion(operatorId: number, response: AuthenticationResponseJSON, expectedChallenge: string) {
  const stored = await prisma.watchtower_webauthn_credentials.findUnique({ where: { credential_id: response.id } });
  if (!stored || stored.operator_id !== operatorId) {
    return { verified: false as const };
  }

  const { rpID, origin } = rpConfig();
  const credential: WebAuthnCredential = {
    id: stored.credential_id,
    publicKey: new Uint8Array(stored.public_key),
    counter: Number(stored.counter),
    transports: (stored.transports as AuthenticatorTransportFuture[] | null) ?? undefined,
  };

  const verifyOpts: VerifyAuthenticationResponseOpts = {
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential,
  };

  const verification = await verifyAuthenticationResponse(verifyOpts);
  if (!verification.verified) return { verified: false as const };

  await prisma.watchtower_webauthn_credentials.update({
    where: { id: stored.id },
    data: { counter: BigInt(verification.authenticationInfo.newCounter), last_used_at: new Date() },
  });

  return { verified: true as const };
}

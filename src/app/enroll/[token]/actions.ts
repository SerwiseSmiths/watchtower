'use server';

import { checkEnrollment, markEnrollmentUsed } from '@/lib/auth/enrollment';
import { buildRegistrationOptions, verifyRegistration, signChallenge, verifyChallengeToken } from '@/lib/auth/webauthn';
import { cookies } from 'next/headers';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';

const CHALLENGE_COOKIE = 'watchtower_enroll_challenge';

export async function getRegistrationOptionsAction(token: string) {
  const check = await checkEnrollment(token);
  if (!check.ok) throw new Error(check.error);

  const options = await buildRegistrationOptions(check.operatorId);

  const cookieStore = await cookies();
  cookieStore.set(CHALLENGE_COOKIE, signChallenge(check.operatorId, options.challenge), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 300,
  });

  return options;
}

export interface CompleteEnrollmentState {
  ok: boolean;
  error?: string;
}

export async function completeEnrollmentAction(
  token: string,
  response: RegistrationResponseJSON,
  deviceLabel: string
): Promise<CompleteEnrollmentState> {
  const check = await checkEnrollment(token);
  if (!check.ok) return { ok: false, error: check.error };

  const cookieStore = await cookies();
  const challengeToken = cookieStore.get(CHALLENGE_COOKIE)?.value;
  const expectedChallenge = challengeToken ? verifyChallengeToken(challengeToken, check.operatorId) : null;
  if (!expectedChallenge) return { ok: false, error: 'Enrollment challenge expired — reload and try again' };

  const result = await verifyRegistration(check.operatorId, response, expectedChallenge, deviceLabel || undefined);
  if (!result.verified) return { ok: false, error: 'Passkey registration failed' };

  await markEnrollmentUsed(check.enrollmentId);
  cookieStore.delete(CHALLENGE_COOKIE);

  return { ok: true };
}

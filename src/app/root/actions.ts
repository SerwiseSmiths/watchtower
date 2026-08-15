'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { requestOtp, verifyOtp } from '@/lib/auth/otp';
import { findOperatorById } from '@/lib/auth/operators';
import {
  ROOT_PENDING_COOKIE_NAME,
  ROOT_PENDING_MAX_AGE,
  ROOT_SESSION_COOKIE_NAME,
  ROOT_SESSION_MAX_AGE,
  signPendingToken,
  signRootSession,
  verifyPendingToken,
} from '@/lib/auth/root-session';
import { buildAuthenticationOptions, signChallenge, verifyAssertion, verifyChallengeToken } from '@/lib/auth/webauthn';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';

export interface RequestOtpState {
  error?: string;
  sent?: boolean;
}

export async function requestOtpAction(_prev: RequestOtpState | undefined, formData: FormData): Promise<RequestOtpState> {
  const phoneNumber = String(formData.get('phoneNumber') ?? '').trim();
  if (!phoneNumber) return { error: 'Phone number is required' };

  const result = await requestOtp(phoneNumber);
  if (!result.ok) return { error: result.error };
  return { sent: true };
}

export interface VerifyOtpState {
  error?: string;
  verified?: boolean;
  hasCredentials?: boolean;
}

export async function verifyOtpAction(_prev: VerifyOtpState | undefined, formData: FormData): Promise<VerifyOtpState> {
  const phoneNumber = String(formData.get('phoneNumber') ?? '').trim();
  const code = String(formData.get('code') ?? '').trim();
  if (!phoneNumber || !code) return { error: 'Phone number and OTP are required' };

  const result = await verifyOtp(phoneNumber, code);
  if (!result.ok) return { error: result.error };

  const cookieStore = await cookies();
  cookieStore.set(ROOT_PENDING_COOKIE_NAME, signPendingToken(result.operatorId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ROOT_PENDING_MAX_AGE,
  });

  return { verified: true, hasCredentials: result.hasCredentials };
}

async function requirePendingOperator(): Promise<number> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ROOT_PENDING_COOKIE_NAME)?.value;
  const pending = token ? verifyPendingToken(token) : null;
  if (!pending) throw new Error('Phone verification expired — start again');
  return pending.operatorId;
}

export async function getAssertionOptionsAction() {
  const operatorId = await requirePendingOperator();
  const options = await buildAuthenticationOptions(operatorId);

  const cookieStore = await cookies();
  cookieStore.set('watchtower_webauthn_challenge', signChallenge(operatorId, options.challenge), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 120,
  });

  return options;
}

export interface VerifyAssertionState {
  ok: boolean;
  error?: string;
}

export async function verifyAssertionAction(response: AuthenticationResponseJSON): Promise<VerifyAssertionState> {
  const operatorId = await requirePendingOperator();
  const cookieStore = await cookies();
  const challengeToken = cookieStore.get('watchtower_webauthn_challenge')?.value;
  const expectedChallenge = challengeToken ? verifyChallengeToken(challengeToken, operatorId) : null;
  if (!expectedChallenge) return { ok: false, error: 'Passkey challenge expired — try again' };

  const result = await verifyAssertion(operatorId, response, expectedChallenge);
  if (!result.verified) return { ok: false, error: 'Passkey verification failed' };

  const operator = await findOperatorById(operatorId);
  if (!operator) return { ok: false, error: 'Operator not found' };

  cookieStore.delete(ROOT_PENDING_COOKIE_NAME);
  cookieStore.delete('watchtower_webauthn_challenge');
  cookieStore.set(ROOT_SESSION_COOKIE_NAME, signRootSession(operator.id, operator.admin_user_id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ROOT_SESSION_MAX_AGE,
  });

  return { ok: true };
}

export async function logoutRootAction() {
  const cookieStore = await cookies();
  cookieStore.delete(ROOT_SESSION_COOKIE_NAME);
  redirect('/');
}

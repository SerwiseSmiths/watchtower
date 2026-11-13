'use server';

import { revalidatePath } from 'next/cache';
import { requireRootSession } from '@/lib/auth/require-root-session';
import { createOperatorWithAccount, setOperatorActive, type CreateOperatorInput } from '@/lib/auth/operators';
import { createEnrollment } from '@/lib/auth/enrollment';
import { revokeCredential } from '@/lib/auth/webauthn';

export async function createOperatorAction(input: CreateOperatorInput) {
  await requireRootSession();
  if (!input.firstname.trim() || !input.lastname.trim()) throw new Error('First and last name are required');
  if (!input.email.trim()) throw new Error('Email is required');
  if (!input.phoneNumber.trim()) throw new Error('Phone number is required');
  await createOperatorWithAccount(input);
  revalidatePath('/operators');
}

export async function toggleOperatorActiveAction(operatorId: number, isActive: boolean) {
  const session = await requireRootSession();
  // Deactivating yourself would lock you out of watchtower with no way back in from the UI.
  if (operatorId === session.operatorId && !isActive) throw new Error('You cannot deactivate your own operator account');
  await setOperatorActive(operatorId, isActive);
  revalidatePath('/operators');
}

export interface GenerateEnrollmentResult {
  url: string;
}

export async function generateEnrollmentAction(operatorId: number, deviceLabel: string): Promise<GenerateEnrollmentResult> {
  await requireRootSession();
  const enrollment = await createEnrollment(operatorId, deviceLabel);
  const base = process.env.WEBAUTHN_ORIGIN ?? '';
  return { url: `${base}/enroll/${enrollment.token}` };
}

export async function revokeCredentialAction(credentialId: number) {
  await requireRootSession();
  await revokeCredential(credentialId);
  revalidatePath('/operators');
}

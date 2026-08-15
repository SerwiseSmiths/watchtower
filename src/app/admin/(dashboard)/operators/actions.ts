'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { SESSION_COOKIE_NAME, verifySession } from '@/lib/auth/admin-session';
import { createOperator, searchAdminUsersWithoutOperator, setOperatorActive } from '@/lib/auth/operators';
import { createEnrollment } from '@/lib/auth/enrollment';
import { revokeCredential } from '@/lib/auth/webauthn';

async function requireAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? verifySession(token) : null;
  if (!session) throw new Error('Not authenticated');
  return session;
}

export async function searchAdminUsersAction(query: string) {
  await requireAdminSession();
  const users = await searchAdminUsersWithoutOperator(query);
  return users.map((u) => ({
    id: u.id,
    email: u.email,
    name: [u.firstname, u.lastname].filter(Boolean).join(' ') || u.email || `#${u.id}`,
  }));
}

export async function createOperatorAction(adminUserId: number, phoneNumber: string) {
  await requireAdminSession();
  if (!phoneNumber.trim()) throw new Error('Phone number is required');
  await createOperator(adminUserId, phoneNumber);
  revalidatePath('/admin/operators');
}

export async function toggleOperatorActiveAction(operatorId: number, isActive: boolean) {
  await requireAdminSession();
  await setOperatorActive(operatorId, isActive);
  revalidatePath('/admin/operators');
}

export interface GenerateEnrollmentResult {
  url: string;
}

export async function generateEnrollmentAction(operatorId: number, deviceLabel: string): Promise<GenerateEnrollmentResult> {
  await requireAdminSession();
  const enrollment = await createEnrollment(operatorId, deviceLabel);
  const base = process.env.WEBAUTHN_ORIGIN ?? '';
  return { url: `${base}/enroll/${enrollment.token}` };
}

export async function revokeCredentialAction(credentialId: number) {
  await requireAdminSession();
  await revokeCredential(credentialId);
  revalidatePath('/admin/operators');
}

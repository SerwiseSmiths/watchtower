'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { SESSION_COOKIE_NAME, verifySession } from '@/lib/auth/admin-session';
import { createAdminUser, setAdminUserActive } from '@/lib/auth/admin-users';

async function requireAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? verifySession(token) : null;
  if (!session) throw new Error('Not authenticated');
  return session;
}

export interface CreateUserResult {
  id: number;
  email: string | null;
  name: string;
}

export async function createUserAction(
  firstname: string,
  lastname: string,
  email: string,
  password: string,
): Promise<CreateUserResult> {
  await requireAdminSession();
  if (!firstname.trim() || !lastname.trim()) throw new Error('First and last name are required');
  if (!email.trim()) throw new Error('Email is required');
  if (password.length < 8) throw new Error('Password must be at least 8 characters');

  const user = await createAdminUser({ firstname, lastname, email, password });
  revalidatePath('/admin/users');

  return {
    id: user.id,
    email: user.email,
    name: [user.firstname, user.lastname].filter(Boolean).join(' ') || user.email || `#${user.id}`,
  };
}

export async function toggleUserActiveAction(userId: number, isActive: boolean) {
  await requireAdminSession();
  await setAdminUserActive(userId, isActive);
  revalidatePath('/admin/users');
}

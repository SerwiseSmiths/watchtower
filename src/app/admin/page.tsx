import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME, verifySession } from '@/lib/auth/admin-session';

export default async function AdminIndexPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? verifySession(token) : null;
  redirect(session ? '/admin/content-manager' : '/admin/login');
}

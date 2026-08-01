import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { allContentTypes } from '@/lib/content-schema/registry';
import { SESSION_COOKIE_NAME, verifySession } from '@/lib/auth/admin-session';
import DashboardChrome, { type NavContentType } from './DashboardChrome';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? verifySession(token) : null;
  if (!session) redirect('/admin/login');

  const contentTypes: NavContentType[] = allContentTypes().map((c) => ({
    uid: c.uid,
    displayName: c.displayName,
    singularName: c.singularName,
    pluralName: c.pluralName,
    kind: c.kind,
  }));

  return <DashboardChrome contentTypes={contentTypes}>{children}</DashboardChrome>;
}

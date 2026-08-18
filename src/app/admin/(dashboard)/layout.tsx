import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { allContentTypes } from '@/lib/content-schema/registry';
import { SESSION_COOKIE_NAME, verifySession } from '@/lib/auth/admin-session';
import { prisma } from '@/lib/db/prisma';
import DashboardChrome, { type NavContentType } from './DashboardChrome';

function initialsFor(firstname: string | null, lastname: string | null, email: string): string {
  if (firstname || lastname) return `${firstname?.[0] ?? ''}${lastname?.[0] ?? ''}`.toUpperCase() || email[0]?.toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? verifySession(token) : null;
  if (!session) redirect('/admin/login');

  const adminUser = await prisma.admin_users.findUnique({ where: { id: session.sub } });
  const userInitials = initialsFor(adminUser?.firstname ?? null, adminUser?.lastname ?? null, session.email);

  const contentTypes: NavContentType[] = allContentTypes().map((c) => ({
    uid: c.uid,
    displayName: c.displayName,
    singularName: c.singularName,
    pluralName: c.pluralName,
    kind: c.kind,
  }));

  return (
    <DashboardChrome contentTypes={contentTypes} userInitials={userInitials}>
      {children}
    </DashboardChrome>
  );
}

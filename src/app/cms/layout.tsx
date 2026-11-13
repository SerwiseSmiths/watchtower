import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import StyledComponentsRegistry from '@/lib/admin/styled-components-registry';
import { getRootSession } from '@/lib/auth/require-root-session';
import { ensureSchemaRegistry } from '@/lib/content-schema/registry';
import { prisma } from '@/lib/db/prisma';
import CmsThemeProvider from './CmsThemeProvider';
import DashboardChrome, { type NavContentType } from './DashboardChrome';
import { cmsContentTypes } from './content-types';

export const metadata: Metadata = {
  title: 'Watchtower CMS',
};

function initialsFor(firstname: string | null, lastname: string | null, email: string | null): string {
  if (firstname || lastname) return `${firstname?.[0] ?? ''}${lastname?.[0] ?? ''}`.toUpperCase();
  return (email ?? '?').slice(0, 2).toUpperCase();
}

export default async function CmsLayout({ children }: { children: React.ReactNode }) {
  const session = await getRootSession();
  if (!session) redirect('/');
  await ensureSchemaRegistry();

  const adminUser = await prisma.admin_users.findUnique({ where: { id: session.adminUserId } });
  const userInitials = initialsFor(adminUser?.firstname ?? null, adminUser?.lastname ?? null, adminUser?.email ?? null);

  const contentTypes: NavContentType[] = cmsContentTypes().map((c) => ({
    uid: c.uid,
    displayName: c.displayName,
    singularName: c.singularName,
    pluralName: c.pluralName,
    kind: c.kind,
  }));

  return (
    <StyledComponentsRegistry>
      {/* The CMS scrolls inside its content pane only; the window itself never scrolls here. */}
      <style>{'html, body { overflow: hidden; height: 100%; }'}</style>
      <CmsThemeProvider>
        <DashboardChrome contentTypes={contentTypes} userInitials={userInitials}>
          {children}
        </DashboardChrome>
      </CmsThemeProvider>
    </StyledComponentsRegistry>
  );
}

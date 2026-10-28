import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ROOT_SESSION_COOKIE_NAME, verifyRootSession } from '@/lib/auth/root-session';
import { cachedFindSingleType, cachedListEntities, getPublishedDocumentIds } from '@/lib/db/entity-repository';
import { prisma } from '@/lib/db/prisma';
import { BOTTOM_TAB_UID, COMPLAINT_PAGE_UID, GLOBAL_CONFIG_UID, WELCOME_BONUS_UID, PAGE_UID, WEB_PAGE_UID, LOGIN_UID } from './content-types';
import CmsView, { type DeviceTypeOption } from './CmsView';

export default async function CmsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ROOT_SESSION_COOKIE_NAME)?.value;
  const session = token ? verifyRootSession(token) : null;
  if (!session) redirect('/');

  // Safe to run concurrently — entity-repository's model() caps total in-flight DB queries.
  const [bottomTab, complaintPage, globalConfig, welcomeBonus, pages, deviceTypes, webPages, login] = await Promise.all([
    cachedFindSingleType(BOTTOM_TAB_UID, { status: 'draft' }),
    cachedFindSingleType(COMPLAINT_PAGE_UID, { status: 'draft' }),
    cachedFindSingleType(GLOBAL_CONFIG_UID, { status: 'draft' }),
    cachedFindSingleType(WELCOME_BONUS_UID, { status: 'draft' }),
    cachedListEntities(PAGE_UID, { status: 'draft', pageSize: 200 }),
    prisma.device_types.findMany({ select: { id: true, label: true }, orderBy: { label: 'asc' } }),
    cachedListEntities(WEB_PAGE_UID, { status: 'draft', pageSize: 200 }),
    cachedFindSingleType(LOGIN_UID, { status: 'draft' }),
  ]);
  const webPageRows = webPages.data as Record<string, unknown>[];
  const livePages = await getPublishedDocumentIds(WEB_PAGE_UID, webPageRows.map((p) => p.documentId as string));

  return (
    <CmsView
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      bottomTab={bottomTab as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      complaintPage={complaintPage as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      globalConfig={globalConfig as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      welcomeBonus={welcomeBonus as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pages={pages.data as any}
      deviceTypeOptions={deviceTypes.map((d): DeviceTypeOption => ({ id: d.id, name: d.label ?? String(d.id) }))}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      webPages={webPageRows.map((p) => ({ ...p, isLive: livePages.has(p.documentId as string) })) as any}
      login={login as Record<string, unknown> | null}
    />
  );
}

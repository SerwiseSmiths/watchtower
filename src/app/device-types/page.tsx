import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ROOT_SESSION_COOKIE_NAME, verifyRootSession } from '@/lib/auth/root-session';
import { listEntities } from '@/lib/db/entity-repository';
import { prisma } from '@/lib/db/prisma';
import DeviceTypesView, { type DeviceTypeRow, type RelationOption } from './DeviceTypesView';

export default async function DeviceTypesPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ROOT_SESSION_COOKIE_NAME)?.value;
  const session = token ? verifyRootSession(token) : null;

  if (!session) redirect('/');

  // Sequenced, not Promise.all'd — the DB pool is capped at 5 connections and
  // listEntities() already runs its own findMany+count in parallel internally.
  // The two option lists query id/name directly (bypassing listEntities'
  // relation hydration) since service_parts/subscription_addons both carry a
  // device_types relation back — hydrating that for every row via
  // listEntities would fan out into hundreds of concurrent queries and blow
  // the pool (this is what caused the P2024 connection-pool timeout).
  const deviceTypes = await listEntities('api::device-type.device-type', { sortField: 'label', pageSize: 200 });
  const serviceParts = await prisma.service_parts.findMany({
    where: { published_at: { not: null } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
    take: 500,
  });
  const subscriptionAddons = await prisma.subscription_addons.findMany({
    where: { published_at: { not: null } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
    take: 500,
  });

  return (
    <DeviceTypesView
      deviceTypes={deviceTypes.data as unknown as DeviceTypeRow[]}
      servicePartOptions={serviceParts.filter((p) => p.name != null) as RelationOption[]}
      subscriptionAddonOptions={subscriptionAddons.filter((a) => a.name != null) as RelationOption[]}
    />
  );
}

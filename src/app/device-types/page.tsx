import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ROOT_SESSION_COOKIE_NAME, verifyRootSession } from '@/lib/auth/root-session';
import { listEntities } from '@/lib/db/entity-repository';
import DeviceTypesView, { type DeviceTypeRow, type RelationOption } from './DeviceTypesView';

export default async function DeviceTypesPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ROOT_SESSION_COOKIE_NAME)?.value;
  const session = token ? verifyRootSession(token) : null;

  if (!session) redirect('/');

  const [deviceTypes, serviceParts, subscriptionAddons] = await Promise.all([
    listEntities('api::device-type.device-type', { sortField: 'label', pageSize: 200 }),
    listEntities('api::service-part.service-part', { fields: ['name'], pageSize: 500 }),
    listEntities('api::subscription-addon.subscription-addon', { fields: ['name'], pageSize: 500 }),
  ]);

  return (
    <DeviceTypesView
      deviceTypes={deviceTypes.data as unknown as DeviceTypeRow[]}
      servicePartOptions={serviceParts.data as unknown as RelationOption[]}
      subscriptionAddonOptions={subscriptionAddons.data as unknown as RelationOption[]}
    />
  );
}

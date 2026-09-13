import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ROOT_SESSION_COOKIE_NAME, verifyRootSession } from '@/lib/auth/root-session';
import { listDeviceTypeGroups } from '@/lib/nexus/deviceTypeGroups';
import DeviceTypeGroupsView from './DeviceTypeGroupsView';

export default async function DeviceTypeGroupsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ROOT_SESSION_COOKIE_NAME)?.value;
  const session = token ? verifyRootSession(token) : null;

  if (!session) redirect('/');

  const groups = await listDeviceTypeGroups();

  return <DeviceTypeGroupsView groups={groups} />;
}

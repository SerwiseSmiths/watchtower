import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ROOT_SESSION_COOKIE_NAME, verifyRootSession } from '@/lib/auth/root-session';
import { listEntities } from '@/lib/db/entity-repository';
import { prisma } from '@/lib/db/prisma';
import PricingView, {
  type SubscriptionPlanRow,
  type SubscriptionAddonRow,
  type ServicePartRow,
  type DeviceTypeOption,
} from './PricingView';

const PLAN_UID = 'api::subscription-plan.subscription-plan';
const ADDON_UID = 'api::subscription-addon.subscription-addon';
const PART_UID = 'api::service-part.service-part';

export default async function PricingPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ROOT_SESSION_COOKIE_NAME)?.value;
  const session = token ? verifyRootSession(token) : null;

  if (!session) redirect('/');

  // Sequenced, not Promise.all'd — same connection-pool lesson from Device Types.
  const plans = await listEntities(PLAN_UID, { sortField: 'sort_order', pageSize: 200 });
  const addons = await listEntities(ADDON_UID, { sortField: 'sort_order', pageSize: 200 });
  const parts = await listEntities(PART_UID, { sortField: 'name', pageSize: 200 });

  const deviceTypes = await prisma.device_types.findMany({
    select: { id: true, label: true },
    orderBy: { label: 'asc' },
  });

  return (
    <PricingView
      plans={plans.data as unknown as SubscriptionPlanRow[]}
      addons={addons.data as unknown as SubscriptionAddonRow[]}
      parts={parts.data as unknown as ServicePartRow[]}
      deviceTypeOptions={deviceTypes.map((d): DeviceTypeOption => ({ id: d.id, name: d.label ?? String(d.id) }))}
    />
  );
}

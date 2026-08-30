import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ROOT_SESSION_COOKIE_NAME, verifyRootSession } from '@/lib/auth/root-session';
import { listProviderTiers } from '@/lib/nexus/providerTiers';
import ProviderTiersView from './ProviderTiersView';

export default async function ProviderTiersPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ROOT_SESSION_COOKIE_NAME)?.value;
  const session = token ? verifyRootSession(token) : null;

  if (!session) redirect('/');

  const tiers = await listProviderTiers();

  return <ProviderTiersView tiers={tiers} />;
}

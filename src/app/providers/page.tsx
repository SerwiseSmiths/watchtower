import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ROOT_SESSION_COOKIE_NAME, verifyRootSession } from '@/lib/auth/root-session';
import { fetchAllProviders } from '@/lib/nexus/providers';
import { mapProviderToRow } from './mapProvider';
import ProvidersView from './ProvidersView';

export default async function ProvidersPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ROOT_SESSION_COOKIE_NAME)?.value;
  const session = token ? verifyRootSession(token) : null;

  if (!session) redirect('/');

  const providers = await fetchAllProviders();
  const rows = providers.map(mapProviderToRow);

  return <ProvidersView providers={rows} />;
}

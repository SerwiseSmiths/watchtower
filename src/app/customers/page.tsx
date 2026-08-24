import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ROOT_SESSION_COOKIE_NAME, verifyRootSession } from '@/lib/auth/root-session';
import { fetchAllCustomers } from '@/lib/nexus/customers';
import CustomersView from './CustomersView';

export default async function CustomersPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ROOT_SESSION_COOKIE_NAME)?.value;
  const session = token ? verifyRootSession(token) : null;

  if (!session) redirect('/');

  const customers = await fetchAllCustomers();

  return <CustomersView customers={customers} />;
}

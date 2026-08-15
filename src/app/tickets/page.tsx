import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ROOT_SESSION_COOKIE_NAME, verifyRootSession } from '@/lib/auth/root-session';
import { fetchAllComplaints } from '@/lib/nexus/complaints';
import { mapComplaintToTicket } from './mapComplaint';
import TicketsView from './TicketsView';

export default async function TicketsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ROOT_SESSION_COOKIE_NAME)?.value;
  const session = token ? verifyRootSession(token) : null;

  if (!session) redirect('/');

  const complaints = await fetchAllComplaints();
  const tickets = complaints.map(mapComplaintToTicket);

  return <TicketsView tickets={tickets} />;
}

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ROOT_SESSION_COOKIE_NAME, verifyRootSession } from '@/lib/auth/root-session';
import { fetchAllComplaints } from '@/lib/nexus/complaints';
import { fetchWhatsAppStatus } from '@/lib/nexus/whatsapp';
import { mapComplaintToTicket } from './mapComplaint';
import TicketsView from './TicketsView';
import { WhatsAppProvider } from './WhatsAppConnection';

export default async function TicketsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ROOT_SESSION_COOKIE_NAME)?.value;
  const session = token ? verifyRootSession(token) : null;

  if (!session) redirect('/');

  // WhatsApp status failing to load must never block the tickets table.
  const [complaints, whatsAppStatus] = await Promise.all([fetchAllComplaints(), fetchWhatsAppStatus().catch(() => null)]);
  const tickets = complaints.map(mapComplaintToTicket);

  return (
    <WhatsAppProvider initialStatus={whatsAppStatus}>
      <TicketsView tickets={tickets} />
    </WhatsAppProvider>
  );
}

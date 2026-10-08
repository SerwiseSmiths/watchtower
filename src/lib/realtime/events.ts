// Maps nexus's realtime events (broadcast on the secret admin channel — see
// nexus/src/services/realtime.service.ts `emitToAdmin`) to what watchtower does
// with them: which nexus cache tags to drop, and whether to toast. Adding a new
// nexus event = one entry here; anything unmapped still refreshes the page.

export type RealtimeTone = 'info' | 'success' | 'warning' | 'danger';

export interface RealtimeToast {
  title: string;
  body?: string;
  tone: RealtimeTone;
  /** Where clicking the toast takes the operator. */
  href?: string;
}

export interface RealtimeReaction {
  /** Nexus cache tags (see src/lib/nexus/*.ts `tags`) to invalidate. */
  tags: string[];
  /** Omitted for silent "something changed, refetch" events. */
  toast?: RealtimeToast;
}

type Payload = Record<string, unknown>;

interface PayloadPerson {
  firstName?: string | null;
  lastName?: string | null;
  phoneNo?: string | null;
}

interface PayloadComplaint {
  id?: string;
  title?: string | null;
  userId?: string;
  providerId?: string | null;
  providerAccepted?: boolean;
  user?: PayloadPerson | null;
  provider?: PayloadPerson | null;
  quote?: { totalAmount?: number } | null;
}

const STAGE_LABELS: Record<string, string> = {
  ENTRANCE: 'Raised',
  QR_VALIDATED: 'QR validated',
  ESTIMATION: 'Estimation',
  APPROVAL: 'Awaiting approval',
  IN_PROGRESS: 'In progress',
  PAYMENT: 'Payment',
  COMPLETED: 'Completed',
  REJECTED: 'Cancelled',
};

const personName = (p: PayloadPerson | null | undefined, fallback: string) =>
  [p?.firstName, p?.lastName].filter(Boolean).join(' ') || p?.phoneNo || fallback;

const stageLabel = (stage: unknown) => (typeof stage === 'string' ? (STAGE_LABELS[stage] ?? stage) : '');

const target = (payload: Payload) => payload.target as { role?: string; id?: string } | undefined;

function complaintTags(c: PayloadComplaint): string[] {
  const tags = ['complaints'];
  if (c.userId) tags.push(`customer:${c.userId}`);
  if (c.providerId) tags.push(`provider:${c.providerId}`);
  return tags;
}

/** `#a1b2c` — same short form the tickets table shows (see mapComplaint.ts). */
function ticketRef(c: PayloadComplaint): string {
  return c.id ? `#${c.id.slice(-5)}` : 'Ticket';
}

function complaintBody(c: PayloadComplaint): string {
  return [ticketRef(c), c.title, personName(c.user, '')].filter(Boolean).join(' · ');
}

export function reactionFor(event: string, payload: Payload): RealtimeReaction {
  const complaint = (payload.complaint ?? {}) as PayloadComplaint;
  const href = '/tickets';

  switch (event) {
    case 'complaint:created':
      return {
        tags: [...complaintTags(complaint), 'customers'],
        toast: { title: 'New ticket raised', body: complaintBody(complaint), tone: 'info', href },
      };

    case 'complaint:stage_changed':
      return {
        tags: [...complaintTags(complaint), 'providers'],
        toast: {
          title: `${ticketRef(complaint)} moved to ${stageLabel(payload.newStage)}`,
          body: [stageLabel(payload.oldStage) && `from ${stageLabel(payload.oldStage)}`, complaint.title].filter(Boolean).join(' · '),
          tone: payload.newStage === 'REJECTED' ? 'danger' : payload.newStage === 'COMPLETED' ? 'success' : 'info',
          href,
        },
      };

    case 'complaint:provider_assigned':
      return {
        tags: [...complaintTags(complaint), 'providers'],
        toast: {
          // providerAccepted already true at assignment time = force assignment (nexus §5.2).
          title: `${ticketRef(complaint)} ${complaint.providerAccepted ? 'force-assigned' : 'assigned'}`,
          body: `To ${personName(complaint.provider, 'a provider')}`,
          tone: 'info',
          href,
        },
      };

    case 'complaint:provider_accepted':
      return {
        tags: [...complaintTags(complaint), 'providers'],
        toast: {
          title: `${personName(complaint.provider, 'Provider')} accepted ${ticketRef(complaint)}`,
          body: complaint.title ?? undefined,
          tone: 'success',
          href,
        },
      };

    case 'complaint:provider_rejected':
      return {
        tags: [...complaintTags(complaint), 'providers'],
        toast: {
          title: `Provider declined ${ticketRef(complaint)}`,
          body: 'Needs reassignment',
          tone: 'warning',
          href,
        },
      };

    case 'complaint:quote_added':
      return {
        tags: complaintTags(complaint),
        toast: {
          title: `Quote ${payload.revised ? 'edited' : 'added'} on ${ticketRef(complaint)}`,
          body: complaint.quote?.totalAmount != null ? `₹${complaint.quote.totalAmount.toLocaleString('en-IN')}` : undefined,
          tone: 'info',
          href,
        },
      };

    case 'complaint:quote_responded':
      return {
        tags: complaintTags(complaint),
        toast: {
          title: `Customer ${payload.approved ? 'approved' : 'rejected'} the quote on ${ticketRef(complaint)}`,
          body: personName(complaint.user, '') || undefined,
          tone: payload.approved ? 'success' : 'warning',
          href,
        },
      };

    case 'complaint:updated':
      return { tags: complaintTags(complaint) };

    case 'payment:verified': {
      const customerId = target(payload)?.id;
      // Payload shape differs per purchase — see nexus payment.service.ts.
      const kind = payload.subscriptionId ? 'Plan purchase' : payload.complaintId ? 'Visit booking' : 'Wallet top-up';
      const amount = typeof payload.amount === 'number' ? `₹${payload.amount.toLocaleString('en-IN')}` : null;
      return {
        tags: ['complaints', 'customers', ...(customerId ? [`customer:${customerId}`] : [])],
        toast: {
          title: 'Payment received',
          body: [amount, kind].filter(Boolean).join(' · '),
          tone: 'success',
          href: customerId ? `/customers/${customerId}` : undefined,
        },
      };
    }

    case 'devices:updated':
      return { tags: payload.customerId ? ['customers', `customer:${payload.customerId}`] : ['customers'] };

    case 'profile:updated':
    case 'bank:updated':
    case 'wallet:updated': {
      const providerId = target(payload)?.id;
      return { tags: ['providers', ...(providerId ? [`provider:${providerId}`] : [])] };
    }

    // Admin-sent app notifications (notification:new) and anything nexus adds
    // later: no cached data to drop, but still refresh the current page.
    default:
      return { tags: [] };
  }
}

import type { TicketStatus } from './mapComplaint';

export const STATUS_COLORS: Record<TicketStatus, { bg: string; color: string }> = {
  Raised: { bg: '#E5E5E5', color: '#181818' },
  'In-Warranty': { bg: '#E9DEFE', color: '#674092' },
  'In Progress': { bg: '#D5EDFE', color: '#437694' },
  Cancelled: { bg: '#FFD5D5', color: '#FF5E5E' },
  Completed: { bg: '#D6FAB4', color: '#007637' },
};

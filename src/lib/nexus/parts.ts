import { nexusFetch } from './client';

// Mirrors nexus's StrapiService.ServicePart — the CMS-editable parts/repairs/
// service catalogue. `face_value` is the customer-facing price; picking an
// item here and submitting a quote snapshots this price into the quote at
// that moment (see nexus's ComplaintService.addQuote) — a later CMS price
// change never retroactively changes an already-created quote.
export interface NexusServicePart {
  id: number;
  documentId: string;
  name: string;
  category: string;
  type: 'Parts' | 'Repair' | 'Service';
  face_value: number;
  description: string | null;
  visibility: 'ACTIVE' | 'DRAFT' | 'DISCONTINUED';
}

export async function listParts(deviceType?: string): Promise<NexusServicePart[]> {
  const query = deviceType ? `?deviceType=${encodeURIComponent(deviceType)}` : '';
  const res = await nexusFetch(`/parts${query}`, {}, { tags: ['parts'] });
  const body = await res.json();
  const parts = body.data as NexusServicePart[];
  return parts.filter((p) => p.visibility === 'ACTIVE');
}

/** Un-cached-on-our-end re-read of one part's current CMS price — used right
 *  before a quote is actually submitted (see AddQuoteForm's confirm step) so
 *  the admin sees today's true price, not whatever the catalogue picker had
 *  loaded (possibly minutes earlier). Nexus still independently re-resolves
 *  the authoritative price again at the moment it persists the quote — this
 *  is only to make the confirmation preview trustworthy, not the source of
 *  truth. */
export async function getPart(documentId: string): Promise<NexusServicePart | null> {
  try {
    const res = await nexusFetch(`/parts/${documentId}`);
    const body = await res.json();
    return body.data as NexusServicePart;
  } catch {
    // nexusFetch throws on a non-2xx response — a 404 here means the part
    // was removed/unpublished from the CMS since it was added to this quote.
    return null;
  }
}

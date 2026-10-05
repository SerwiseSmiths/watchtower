import { nexusFetch } from './client';

// The WhatsApp number nexus sends customer nudges from. Each nexus environment
// keeps its own linked number, so dev watchtower manages dev's and prod
// watchtower manages prod's — nothing environment-specific is needed here.

export interface WhatsAppStatus {
  connected: boolean;
  /** Digits only with country code, e.g. "919876543210". */
  number: string | null;
  /** Set while a link is waiting for its code to be entered on the phone. */
  pairing: { phone: string; startedAt: string } | null;
  lastError: string | null;
}

export async function fetchWhatsAppStatus(): Promise<WhatsAppStatus> {
  const res = await nexusFetch('/whatsapp/status');
  const body = await res.json();
  return body.data as WhatsAppStatus;
}

/** Returns the 8-character code to enter on the phone. Linking then finishes in
 *  nexus's background — poll fetchWhatsAppStatus until `connected`. */
export async function startWhatsAppPairing(phone: string): Promise<string> {
  const res = await nexusFetch('/whatsapp/pair', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  });
  const body = await res.json();
  return body.data.code as string;
}

export async function logoutWhatsApp(): Promise<void> {
  await nexusFetch('/whatsapp/logout', { method: 'POST' });
}

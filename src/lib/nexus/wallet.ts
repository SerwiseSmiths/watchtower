import { nexusFetch } from './client';

export type WalletLedgerType = 'CREDIT' | 'DEBIT';

export interface NexusWalletLedgerEntry {
  id: string;
  type: WalletLedgerType;
  source: string;
  title: string;
  amount: number;
  openingBalance: number;
  closingBalance: number;
  refId: string | null;
  createdAt: string;
}

export interface NexusWalletHistory {
  entries: NexusWalletLedgerEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/** Full ledger (earnings + cashouts) for a specific provider — ADMIN-only on nexus's side.
 *  Deliberately not cached (no `tags`/`revalidate`) — financial history must be exact and
 *  current every time an admin opens it, not eventually-consistent like content reads. */
export async function fetchProviderWalletHistory(userId: string, page = 1, limit = 20): Promise<NexusWalletHistory> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  const res = await nexusFetch(`/wallet/user/${userId}/history?${params.toString()}`);
  const body = await res.json();
  return body.data as NexusWalletHistory;
}

/** Records a manual/offline payout to a provider — debits their wallet directly (ADMIN-only
 *  on nexus's side). There is no bank/gateway automation; this only reflects that the admin
 *  already paid the provider outside the app. */
export async function payoutProviderWallet(
  userId: string,
  amount: number,
  note?: string,
): Promise<{ wallet: { id: string; balance: number }; ledger: NexusWalletLedgerEntry }> {
  const res = await nexusFetch('/wallet/debit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      amount,
      source: 'WITHDRAWAL',
      meta: { recordedVia: 'watchtower', ...(note && { note }) },
    }),
  });
  const body = await res.json();
  return body.data;
}

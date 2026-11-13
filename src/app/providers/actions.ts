'use server';

import { requireRootSession } from '@/lib/auth/require-root-session';

import { revalidatePath, updateTag } from 'next/cache';
import {
  createProvider,
  updateProvider,
  fetchProvider,
  approveProviderBankAccount,
  type NexusProviderDetail,
  type NexusProviderBankAccount,
  type ProviderInput,
} from '@/lib/nexus/providers';
import { listProviderTiers, type NexusProviderTier } from '@/lib/nexus/providerTiers';
import { autocompleteAddress, type AddressPrediction } from '@/lib/nexus/geocode';
import { fetchProviderWalletHistory, payoutProviderWallet, type NexusWalletHistory } from '@/lib/nexus/wallet';
import { logAudit } from '@/lib/audit/log';
import { errorMessage, type ActionResult } from '@/lib/action-result';
import { updateProviderSignup, type NexusProviderSignup, type ProviderSignupStatus } from '@/lib/nexus/providerSignups';

function providerLabel(p: { firstName: string | null; lastName: string | null; phoneNo: string }): string {
  return [p.firstName, p.lastName].filter(Boolean).join(' ') || p.phoneNo;
}

export async function fetchProviderDetailAction(id: string): Promise<NexusProviderDetail> {
  await requireRootSession();
  return fetchProvider(id);
}

export async function fetchProviderTiersAction(): Promise<NexusProviderTier[]> {
  await requireRootSession();
  return listProviderTiers();
}

export async function createProviderAction(input: ProviderInput): Promise<NexusProviderDetail> {
  await requireRootSession();
  const provider = await createProvider(input);
  revalidatePath('/providers');
  updateTag('providers');
  // nexus closes out any pending "Join Serwise" request for this phone number
  updateTag('provider-signups');
  await logAudit({ module: 'provider', action: 'CREATE', entityId: provider.id, entityLabel: providerLabel(provider), after: { ...provider } });
  return provider;
}

export async function updateProviderAction(
  id: string,
  input: Partial<ProviderInput> & { isActive?: boolean },
): Promise<NexusProviderDetail> {
  await requireRootSession();
  const before = await fetchProvider(id).catch(() => null);
  const provider = await updateProvider(id, input);
  revalidatePath('/providers');
  updateTag('providers');
  updateTag(`provider:${id}`);
  await logAudit({
    module: 'provider',
    action: 'UPDATE',
    entityId: id,
    entityLabel: providerLabel(provider),
    before: before ? { ...before } : undefined,
    after: { ...provider },
  });
  return provider;
}

export async function setProviderSignupStatusAction(
  request: Pick<NexusProviderSignup, 'id' | 'firstName' | 'lastName' | 'phoneNo' | 'status'>,
  status: ProviderSignupStatus,
): Promise<NexusProviderSignup> {
  await requireRootSession();
  const updated = await updateProviderSignup(request.id, { status });
  revalidatePath('/providers');
  updateTag('provider-signups');
  await logAudit({
    module: 'provider-signup',
    action: 'UPDATE',
    entityId: request.id,
    entityLabel: [request.firstName, request.lastName].filter(Boolean).join(' ') || request.phoneNo,
    changes: { status: { old: request.status, new: status } },
  });
  return updated;
}

export async function searchAddressAction(query: string): Promise<AddressPrediction[]> {
  await requireRootSession();
  return autocompleteAddress(query);
}

export async function approveProviderBankAccountAction(id: string): Promise<NexusProviderBankAccount> {
  await requireRootSession();
  const bankAccount = await approveProviderBankAccount(id);
  revalidatePath('/providers');
  updateTag('providers');
  updateTag(`provider:${id}`);
  await logAudit({
    module: 'provider',
    action: 'UPDATE',
    entityId: id,
    entityLabel: 'Bank account approval',
    changes: { bankAccountApproved: { old: false, new: true } },
  });
  return bankAccount;
}

export async function fetchProviderLedgerAction(providerId: string, page = 1): Promise<NexusWalletHistory> {
  await requireRootSession();
  return fetchProviderWalletHistory(providerId, page);
}

export async function payoutProviderAction(
  providerId: string,
  amount: number,
  idempotencyKey: string,
  note?: string,
): Promise<ActionResult> {
  const session = await requireRootSession();
  try {
    await payoutProviderWallet(providerId, amount, idempotencyKey, note, `operator:${session.operatorId}`);
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
  revalidatePath('/providers');
  updateTag('providers');
  updateTag(`provider:${providerId}`);
  await logAudit({
    module: 'provider',
    action: 'UPDATE',
    entityId: providerId,
    entityLabel: 'Provider payout',
    changes: { walletPayout: { old: null, new: amount }, ...(note && { note: { old: null, new: note } }) },
  });
  return { ok: true, data: null };
}

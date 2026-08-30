import { nexusFetch } from './client';

export interface ServicePartTierPricing {
  servicePartId: string;
  providerTierId: string;
  salesPrice: number;
  expense: number | null;
  labour: number | null;
  maxDiscount: number | null;
}

export interface UpsertPartPricingInput {
  servicePartId: string;
  providerTierId: string;
  salesPrice: number;
  expense?: number;
  labour?: number;
  maxDiscount?: number;
}

/** All pricing overrides for one provider tier ("Group") — parts with no row here fall
 *  back to their own base face_value/expense/provider_cut. */
export async function listPricingForTier(providerTierId: string): Promise<ServicePartTierPricing[]> {
  const res = await nexusFetch(`/service-part-pricing?providerTierId=${encodeURIComponent(providerTierId)}`);
  const body = await res.json();
  return body.data.pricing as ServicePartTierPricing[];
}

export async function upsertPartPricing(input: UpsertPartPricingInput): Promise<ServicePartTierPricing> {
  const res = await nexusFetch('/service-part-pricing', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await res.json();
  return body.data.pricing as ServicePartTierPricing;
}

export async function resetPartPricing(servicePartId: string, providerTierId: string): Promise<void> {
  await nexusFetch(`/service-part-pricing?servicePartId=${encodeURIComponent(servicePartId)}&providerTierId=${encodeURIComponent(providerTierId)}`, {
    method: 'DELETE',
  });
}

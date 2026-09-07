'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { uploadToCloudinary } from '@/lib/media/cloudinary';
import { createEntity, updateEntity, deleteEntity } from '@/lib/db/entity-repository';
import {
  listPricingForTier,
  upsertPartPricing,
  resetPartPricing,
  type ServicePartTierPricing,
  type UpsertPartPricingInput,
} from '@/lib/nexus/servicePartPricing';

const PLAN_UID = 'api::subscription-plan.subscription-plan';
const ADDON_UID = 'api::subscription-addon.subscription-addon';
const PART_UID = 'api::service-part.service-part';

export interface VisitServiceInput {
  visit_number: number;
  label: string;
  service_parts?: number[];
}

export interface PlanFeatureInput {
  title: string;
  description?: string;
  qty?: string;
}

export interface SubscriptionPlanInput {
  key: string;
  name: string;
  badge?: string;
  badge_color?: string;
  annual_price: number;
  monthly_price: number;
  tagline?: string;
  max_services?: number;
  duration_months?: number;
  sort_order?: number;
  is_active?: boolean;
  visit_services?: VisitServiceInput[];
  features?: PlanFeatureInput[];
}

export interface SubscriptionAddonInput {
  key: string;
  name: string;
  price: number;
  description?: string;
  image?: number | null;
  is_active?: boolean;
  sort_order?: number;
  device_types?: number[];
}

export interface ServicePartInput {
  name: string;
  category: string;
  type: string;
  face_value: number;
  provider_cut?: number;
  expense?: number;
  description?: string;
  visibility?: string;
  device_types?: number[];
}

export async function createSubscriptionPlanAction(input: SubscriptionPlanInput) {
  const entity = await createEntity(PLAN_UID, { ...input });
  revalidatePath('/pricing');
  return entity;
}

export async function updateSubscriptionPlanAction(id: number, input: Partial<SubscriptionPlanInput>) {
  const entity = await updateEntity(PLAN_UID, id, { ...input });
  revalidatePath('/pricing');
  return entity;
}

export async function deleteSubscriptionPlanAction(id: number) {
  await deleteEntity(PLAN_UID, id);
  revalidatePath('/pricing');
}

export async function createSubscriptionAddonAction(input: SubscriptionAddonInput) {
  const entity = await createEntity(ADDON_UID, { ...input });
  revalidatePath('/pricing');
  return entity;
}

export async function updateSubscriptionAddonAction(id: number, input: Partial<SubscriptionAddonInput>) {
  const entity = await updateEntity(ADDON_UID, id, { ...input });
  revalidatePath('/pricing');
  return entity;
}

export async function deleteSubscriptionAddonAction(id: number) {
  await deleteEntity(ADDON_UID, id);
  revalidatePath('/pricing');
}

export async function createServicePartAction(input: ServicePartInput) {
  const entity = await createEntity(PART_UID, { ...input });
  revalidatePath('/pricing');
  return entity;
}

export async function updateServicePartAction(id: number, input: Partial<ServicePartInput>) {
  const entity = await updateEntity(PART_UID, id, { ...input });
  revalidatePath('/pricing');
  return entity;
}

export async function deleteServicePartAction(id: number) {
  await deleteEntity(PART_UID, id);
  revalidatePath('/pricing');
}

export interface UploadedImage {
  id: number;
  url: string;
  name: string;
}

/** Uploads a brand-new image straight to Cloudinary + the files table — same pattern as
 *  device-types/actions.ts's uploadDeviceTypeImageAction, reused here for addon images. */
export async function uploadPricingImageAction(formData: FormData): Promise<UploadedImage> {
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) throw new Error('No file provided');

  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = file.type || 'application/octet-stream';
  const uploaded = await uploadToCloudinary(buffer, mime);
  const ext = file.name.includes('.') ? `.${file.name.split('.').pop()}` : null;

  const created = await prisma.files.create({
    data: {
      name: file.name,
      ext,
      mime,
      size: Math.round((uploaded.bytes / 1024) * 100) / 100,
      width: uploaded.width,
      height: uploaded.height,
      url: uploaded.url,
      provider: 'cloudinary',
      provider_metadata: { public_id: uploaded.publicId, resource_type: uploaded.resourceType },
      folder_path: '/',
      created_at: new Date(),
      updated_at: new Date(),
      published_at: new Date(),
    },
  });

  return { id: created.id, url: created.url ?? uploaded.url, name: created.name ?? file.name };
}

// ─── Group (Provider Tier) pricing overrides ───────────────────────────────

export async function fetchTierPricingAction(providerTierId: string): Promise<ServicePartTierPricing[]> {
  return listPricingForTier(providerTierId);
}

export async function upsertPartPricingAction(input: UpsertPartPricingInput): Promise<ServicePartTierPricing> {
  return upsertPartPricing(input);
}

export async function resetPartPricingAction(servicePartId: string, providerTierId: string): Promise<void> {
  await resetPartPricing(servicePartId, providerTierId);
}

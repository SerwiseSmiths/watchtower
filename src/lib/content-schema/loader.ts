import type { ComponentSchema, ContentTypeSchema, FieldSchema } from './types';

import bottomTabRaw from '../../../content-schemas/api/bottom-tab/content-types/bottom-tab/schema.json';
import complaintPageRaw from '../../../content-schemas/api/complaint-page/content-types/complaint-page/schema.json';
import deviceTypeRaw from '../../../content-schemas/api/device-type/content-types/device-type/schema.json';
import globalConfigRaw from '../../../content-schemas/api/global-config/content-types/global-config/schema.json';
import pageRaw from '../../../content-schemas/api/page/content-types/page/schema.json';
import servicePartRaw from '../../../content-schemas/api/service-part/content-types/service-part/schema.json';
import subscriptionAddonRaw from '../../../content-schemas/api/subscription-addon/content-types/subscription-addon/schema.json';
import subscriptionPlanRaw from '../../../content-schemas/api/subscription-plan/content-types/subscription-plan/schema.json';
import welcomeBonusRaw from '../../../content-schemas/api/welcome-bonus/content-types/welcome-bonus/schema.json';
import webPageRaw from '../../../content-schemas/api/web-page/content-types/web-page/schema.json';
import loginRaw from '../../../content-schemas/api/login/content-types/login/schema.json';
import magicFlowRaw from '../../../content-schemas/api/magic-flow/content-types/magic-flow/schema.json';
import addressBookRaw from '../../../content-schemas/api/address-book/content-types/address-book/schema.json';
import settingsDrawerRaw from '../../../content-schemas/api/settings-drawer/content-types/settings-drawer/schema.json';

import advertisementRaw from '../../../content-schemas/components/blocks/advertisement.json';
import heroGridItemRaw from '../../../content-schemas/components/blocks/hero-grid-item.json';
import heroGridRaw from '../../../content-schemas/components/blocks/hero-grid.json';
import inviteEarnRaw from '../../../content-schemas/components/blocks/invite-earn.json';
import serviceRowRaw from '../../../content-schemas/components/blocks/service-row.json';
import servicesRaw from '../../../content-schemas/components/blocks/services.json';
import transactionsRaw from '../../../content-schemas/components/blocks/transactions.json';
import walletRaw from '../../../content-schemas/components/blocks/wallet.json';
import whatsNewItemRaw from '../../../content-schemas/components/blocks/whats-new-item.json';
import whatsNewRaw from '../../../content-schemas/components/blocks/whats-new.json';
import resolutionStepsRaw from '../../../content-schemas/components/blocks/resolution-steps.json';
import infoBlocksRaw from '../../../content-schemas/components/blocks/info-blocks.json';
import infoBlockRaw from '../../../content-schemas/components/complaint/info-block.json';
import resolutionStepRaw from '../../../content-schemas/components/complaint/resolution-step.json';
import configEntryRaw from '../../../content-schemas/components/shared/config-entry.json';
import tabItemRaw from '../../../content-schemas/components/shared/tab-item.json';
import planFeatureRaw from '../../../content-schemas/components/subscription/plan-feature.json';
import visitServiceRaw from '../../../content-schemas/components/subscription/visit-service.json';
// Website CMS (web-page / login) — style pieces, items, then page blocks
import webSectionStyleRaw from '../../../content-schemas/components/web/section-style.json';
import webTextStyleRaw from '../../../content-schemas/components/web/text-style.json';
import webButtonRaw from '../../../content-schemas/components/web/button.json';
import webLinkRaw from '../../../content-schemas/components/web/link.json';
import webDrawerStyleRaw from '../../../content-schemas/components/web/drawer-style.json';
import webServiceCardRaw from '../../../content-schemas/components/web/service-card.json';
import webFeatureCardRaw from '../../../content-schemas/components/web/feature-card.json';
import webCityRaw from '../../../content-schemas/components/web/city.json';
import webHeaderRaw from '../../../content-schemas/components/web/header.json';
import webHeroRaw from '../../../content-schemas/components/web/hero.json';
import webServicesGridRaw from '../../../content-schemas/components/web/services-grid.json';
import webFeatureGridRaw from '../../../content-schemas/components/web/feature-grid.json';
import webAppPromoRaw from '../../../content-schemas/components/web/app-promo.json';
import webSupportRaw from '../../../content-schemas/components/web/support.json';
import webCounterRaw from '../../../content-schemas/components/web/counter.json';
import webHelpCtaRaw from '../../../content-schemas/components/web/help-cta.json';
import webFooterRaw from '../../../content-schemas/components/web/footer.json';
import webLoginRaw from '../../../content-schemas/components/web/login.json';
import webDashboardTileRaw from '../../../content-schemas/components/web/dashboard-tile.json';
import webDialItemRaw from '../../../content-schemas/components/web/dial-item.json';
import webPlanPreviewRaw from '../../../content-schemas/components/web/plan-preview.json';
import webDashboardStyleRaw from '../../../content-schemas/components/web/dashboard-style.json';
import webDashboardRaw from '../../../content-schemas/components/web/dashboard.json';
import webListItemRaw from '../../../content-schemas/components/web/list-item.json';
import webSidebarItemRaw from '../../../content-schemas/components/web/sidebar-item.json';
import webAppSidebarRaw from '../../../content-schemas/components/web/app-sidebar.json';
import webPlansRaw from '../../../content-schemas/components/web/plans.json';
import webWalletAmountRaw from '../../../content-schemas/components/web/wallet-amount.json';
import webAddMoneyRaw from '../../../content-schemas/components/web/add-money.json';
import webOrderHistoryRaw from '../../../content-schemas/components/web/order-history.json';
import webBookingApplianceRaw from '../../../content-schemas/components/web/booking-appliance.json';
import webTicketRaw from '../../../content-schemas/components/web/ticket.json';
import webResolutionStepRaw from '../../../content-schemas/components/web/resolution-step.json';
import webResolutionStepsRaw from '../../../content-schemas/components/web/resolution-steps.json';
import webInfoBlockRaw from '../../../content-schemas/components/web/info-block.json';
import webInfoBlocksRaw from '../../../content-schemas/components/web/info-blocks.json';
import webRateCardRaw from '../../../content-schemas/components/web/rate-card.json';

export interface RawAttribute {
  type: string;
  required?: boolean;
  unique?: boolean;
  default?: unknown;
  min?: number;
  max?: number;
  enum?: string[];
  targetField?: string;
  multiple?: boolean;
  allowedTypes?: string[];
  component?: string;
  repeatable?: boolean;
  components?: string[];
  relation?: string;
  target?: string;
  mappedBy?: string;
  inversedBy?: string;
  customField?: string;
}

/** Strapi's built-in color-picker custom field — a plain string column holding a hex color. */
const COLOR_CUSTOM_FIELD = 'plugin::color-picker.color';

export interface RawSchema {
  kind?: 'collectionType' | 'singleType';
  collectionName: string;
  info: { singularName: string; pluralName: string; displayName: string; description?: string };
  options?: { draftAndPublish?: boolean };
  attributes: Record<string, RawAttribute>;
}

const SCALAR_TYPES = new Set(['string', 'text', 'integer', 'decimal', 'boolean', 'enumeration', 'uid', 'date', 'datetime', 'json']);

function toFieldSchema(raw: RawAttribute): FieldSchema {
  switch (raw.type) {
    case 'media':
      return { kind: 'media', multiple: !!raw.multiple, required: raw.required, allowedTypes: raw.allowedTypes };
    case 'component':
      return {
        kind: 'component',
        component: raw.component!,
        repeatable: !!raw.repeatable,
        required: raw.required,
        min: raw.min,
        max: raw.max,
      };
    case 'dynamiczone':
      return { kind: 'dynamiczone', components: raw.components ?? [], required: raw.required };
    case 'relation':
      return {
        kind: 'relation',
        relation: raw.relation as 'oneToOne' | 'oneToMany' | 'manyToOne' | 'manyToMany',
        target: raw.target!,
        mappedBy: raw.mappedBy,
        inversedBy: raw.inversedBy,
      };
    case 'customField':
      if (raw.customField !== COLOR_CUSTOM_FIELD) {
        throw new Error(`Unsupported custom field: ${raw.customField}`);
      }
      return { kind: 'scalar', type: 'string', required: raw.required, default: raw.default, format: 'color' };
    default:
      if (!SCALAR_TYPES.has(raw.type)) {
        throw new Error(`Unknown attribute type: ${raw.type}`);
      }
      return {
        kind: 'scalar',
        type: raw.type as ScalarFieldTypeOnly,
        required: raw.required,
        unique: raw.unique,
        default: raw.default,
        min: raw.min,
        max: raw.max,
        enum: raw.enum,
        targetField: raw.targetField,
      };
  }
}

type ScalarFieldTypeOnly = 'string' | 'text' | 'integer' | 'decimal' | 'boolean' | 'enumeration' | 'uid' | 'date' | 'datetime' | 'json';

function normalizeAttributes(attributes: Record<string, RawAttribute>): Record<string, FieldSchema> {
  const result: Record<string, FieldSchema> = {};
  for (const [key, raw] of Object.entries(attributes)) {
    result[key] = toFieldSchema(raw);
  }
  return result;
}

export function toContentTypeSchema(raw: RawSchema): ContentTypeSchema {
  return {
    uid: `api::${raw.info.singularName}.${raw.info.singularName}`,
    kind: raw.kind ?? 'collectionType',
    collectionName: raw.collectionName,
    singularName: raw.info.singularName,
    pluralName: raw.info.pluralName,
    displayName: raw.info.displayName,
    description: raw.info.description,
    draftAndPublish: !!raw.options?.draftAndPublish,
    attributes: normalizeAttributes(raw.attributes),
  };
}

export interface RawComponentSchema {
  collectionName: string;
  info: { displayName: string; description?: string; icon?: string };
  attributes: Record<string, RawAttribute>;
}

export function toComponentSchema(uid: string, raw: RawComponentSchema): ComponentSchema {
  return {
    uid,
    collectionName: raw.collectionName,
    displayName: raw.info.displayName,
    description: raw.info.description,
    attributes: normalizeAttributes(raw.attributes),
  };
}

/**
 * The schema files in `content-schemas/` are the seed for the DB-backed registry
 * (`watchtower_cms_content_types` / `watchtower_cms_components`, see registry.ts) and the
 * fallback when those tables don't exist yet. Once seeded, the DB rows are the source of truth —
 * the Content-Type Builder edits rows, not these files.
 */
export const staticRawContentTypes: RawSchema[] = [
  bottomTabRaw as RawSchema,
  complaintPageRaw as RawSchema,
  deviceTypeRaw as RawSchema,
  globalConfigRaw as RawSchema,
  pageRaw as RawSchema,
  servicePartRaw as RawSchema,
  subscriptionAddonRaw as RawSchema,
  subscriptionPlanRaw as RawSchema,
  welcomeBonusRaw as RawSchema,
  webPageRaw as RawSchema,
  loginRaw as RawSchema,
  magicFlowRaw as RawSchema,
  addressBookRaw as RawSchema,
  settingsDrawerRaw as RawSchema,
];

export const staticRawComponents: { uid: string; schema: RawComponentSchema }[] = [
  { uid: 'blocks.advertisement', schema: advertisementRaw as RawComponentSchema },
  { uid: 'blocks.hero-grid-item', schema: heroGridItemRaw as RawComponentSchema },
  { uid: 'blocks.hero-grid', schema: heroGridRaw as RawComponentSchema },
  { uid: 'blocks.invite-earn', schema: inviteEarnRaw as RawComponentSchema },
  { uid: 'blocks.service-row', schema: serviceRowRaw as RawComponentSchema },
  { uid: 'blocks.services', schema: servicesRaw as RawComponentSchema },
  { uid: 'blocks.transactions', schema: transactionsRaw as RawComponentSchema },
  { uid: 'blocks.wallet', schema: walletRaw as RawComponentSchema },
  { uid: 'blocks.whats-new-item', schema: whatsNewItemRaw as RawComponentSchema },
  { uid: 'blocks.whats-new', schema: whatsNewRaw as RawComponentSchema },
  { uid: 'blocks.resolution-steps', schema: resolutionStepsRaw as RawComponentSchema },
  { uid: 'blocks.info-blocks', schema: infoBlocksRaw as RawComponentSchema },
  { uid: 'complaint.info-block', schema: infoBlockRaw as RawComponentSchema },
  { uid: 'complaint.resolution-step', schema: resolutionStepRaw as RawComponentSchema },
  { uid: 'shared.config-entry', schema: configEntryRaw as RawComponentSchema },
  { uid: 'shared.tab-item', schema: tabItemRaw as RawComponentSchema },
  { uid: 'subscription.plan-feature', schema: planFeatureRaw as RawComponentSchema },
  { uid: 'subscription.visit-service', schema: visitServiceRaw as RawComponentSchema },
  { uid: 'web.section-style', schema: webSectionStyleRaw as RawComponentSchema },
  { uid: 'web.text-style', schema: webTextStyleRaw as RawComponentSchema },
  { uid: 'web.button', schema: webButtonRaw as RawComponentSchema },
  { uid: 'web.link', schema: webLinkRaw as RawComponentSchema },
  { uid: 'web.drawer-style', schema: webDrawerStyleRaw as RawComponentSchema },
  { uid: 'web.service-card', schema: webServiceCardRaw as RawComponentSchema },
  { uid: 'web.feature-card', schema: webFeatureCardRaw as RawComponentSchema },
  { uid: 'web.city', schema: webCityRaw as RawComponentSchema },
  { uid: 'web.header', schema: webHeaderRaw as RawComponentSchema },
  { uid: 'web.hero', schema: webHeroRaw as RawComponentSchema },
  { uid: 'web.services-grid', schema: webServicesGridRaw as RawComponentSchema },
  { uid: 'web.feature-grid', schema: webFeatureGridRaw as RawComponentSchema },
  { uid: 'web.app-promo', schema: webAppPromoRaw as RawComponentSchema },
  { uid: 'web.support', schema: webSupportRaw as RawComponentSchema },
  { uid: 'web.counter', schema: webCounterRaw as RawComponentSchema },
  { uid: 'web.help-cta', schema: webHelpCtaRaw as RawComponentSchema },
  { uid: 'web.footer', schema: webFooterRaw as RawComponentSchema },
  { uid: 'web.login', schema: webLoginRaw as RawComponentSchema },
  { uid: 'web.dashboard-tile', schema: webDashboardTileRaw as RawComponentSchema },
  { uid: 'web.dial-item', schema: webDialItemRaw as RawComponentSchema },
  { uid: 'web.plan-preview', schema: webPlanPreviewRaw as RawComponentSchema },
  { uid: 'web.dashboard-style', schema: webDashboardStyleRaw as RawComponentSchema },
  { uid: 'web.dashboard', schema: webDashboardRaw as RawComponentSchema },
  { uid: 'web.list-item', schema: webListItemRaw as RawComponentSchema },
  { uid: 'web.sidebar-item', schema: webSidebarItemRaw as RawComponentSchema },
  { uid: 'web.app-sidebar', schema: webAppSidebarRaw as RawComponentSchema },
  { uid: 'web.plans', schema: webPlansRaw as RawComponentSchema },
  { uid: 'web.wallet-amount', schema: webWalletAmountRaw as RawComponentSchema },
  { uid: 'web.add-money', schema: webAddMoneyRaw as RawComponentSchema },
  { uid: 'web.order-history', schema: webOrderHistoryRaw as RawComponentSchema },
  { uid: 'web.booking-appliance', schema: webBookingApplianceRaw as RawComponentSchema },
  { uid: 'web.ticket', schema: webTicketRaw as RawComponentSchema },
  { uid: 'web.resolution-step', schema: webResolutionStepRaw as RawComponentSchema },
  { uid: 'web.resolution-steps', schema: webResolutionStepsRaw as RawComponentSchema },
  { uid: 'web.info-block', schema: webInfoBlockRaw as RawComponentSchema },
  { uid: 'web.info-blocks', schema: webInfoBlocksRaw as RawComponentSchema },
  { uid: 'web.rate-card', schema: webRateCardRaw as RawComponentSchema },
];

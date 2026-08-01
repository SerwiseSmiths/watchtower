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
import infoBlockRaw from '../../../content-schemas/components/complaint/info-block.json';
import resolutionStepRaw from '../../../content-schemas/components/complaint/resolution-step.json';
import configEntryRaw from '../../../content-schemas/components/shared/config-entry.json';
import tabItemRaw from '../../../content-schemas/components/shared/tab-item.json';
import planFeatureRaw from '../../../content-schemas/components/subscription/plan-feature.json';
import visitServiceRaw from '../../../content-schemas/components/subscription/visit-service.json';

interface RawAttribute {
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
}

interface RawSchema {
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

function toContentTypeSchema(raw: RawSchema): ContentTypeSchema {
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

interface RawComponentSchema {
  collectionName: string;
  info: { displayName: string; description?: string };
  attributes: Record<string, RawAttribute>;
}

function toComponentSchema(uid: string, raw: RawComponentSchema): ComponentSchema {
  return {
    uid,
    collectionName: raw.collectionName,
    displayName: raw.info.displayName,
    description: raw.info.description,
    attributes: normalizeAttributes(raw.attributes),
  };
}

export const contentTypeSchemas: ContentTypeSchema[] = [
  toContentTypeSchema(bottomTabRaw as RawSchema),
  toContentTypeSchema(complaintPageRaw as RawSchema),
  toContentTypeSchema(deviceTypeRaw as RawSchema),
  toContentTypeSchema(globalConfigRaw as RawSchema),
  toContentTypeSchema(pageRaw as RawSchema),
  toContentTypeSchema(servicePartRaw as RawSchema),
  toContentTypeSchema(subscriptionAddonRaw as RawSchema),
  toContentTypeSchema(subscriptionPlanRaw as RawSchema),
  toContentTypeSchema(welcomeBonusRaw as RawSchema),
];

export const componentSchemas: ComponentSchema[] = [
  toComponentSchema('blocks.advertisement', advertisementRaw as RawComponentSchema),
  toComponentSchema('blocks.hero-grid-item', heroGridItemRaw as RawComponentSchema),
  toComponentSchema('blocks.hero-grid', heroGridRaw as RawComponentSchema),
  toComponentSchema('blocks.invite-earn', inviteEarnRaw as RawComponentSchema),
  toComponentSchema('blocks.service-row', serviceRowRaw as RawComponentSchema),
  toComponentSchema('blocks.services', servicesRaw as RawComponentSchema),
  toComponentSchema('blocks.transactions', transactionsRaw as RawComponentSchema),
  toComponentSchema('blocks.wallet', walletRaw as RawComponentSchema),
  toComponentSchema('blocks.whats-new-item', whatsNewItemRaw as RawComponentSchema),
  toComponentSchema('blocks.whats-new', whatsNewRaw as RawComponentSchema),
  toComponentSchema('complaint.info-block', infoBlockRaw as RawComponentSchema),
  toComponentSchema('complaint.resolution-step', resolutionStepRaw as RawComponentSchema),
  toComponentSchema('shared.config-entry', configEntryRaw as RawComponentSchema),
  toComponentSchema('shared.tab-item', tabItemRaw as RawComponentSchema),
  toComponentSchema('subscription.plan-feature', planFeatureRaw as RawComponentSchema),
  toComponentSchema('subscription.visit-service', visitServiceRaw as RawComponentSchema),
];

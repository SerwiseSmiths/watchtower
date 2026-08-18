import type { RelationTableMap } from './types';

/**
 * Strapi truncates + hashes `_lnk` join-table names once they exceed Postgres's
 * 63-char identifier limit (e.g. `components_subscription_visit_sec6d26_service_parts_lnk`),
 * so these can't be derived by a naming algorithm alone. There are only a
 * handful of relations in this schema (confirmed against the real introspected
 * DB — see `prisma/schema.prisma`), so they're curated here by hand rather than
 * discovered dynamically. Keyed by `${ownerUid}.${attributeName}` where
 * ownerUid is a content-type uid (`api::x.x`) or component uid (`category.name`).
 */
export const relationTables: Record<string, RelationTableMap> = {
  'api::service-part.service-part.device_types': {
    table: 'service_parts_device_types_lnk',
    ownerColumn: 'service_part_id',
    targetColumn: 'device_type_id',
    ownerOrderColumn: 'service_part_ord',
    targetOrderColumn: 'device_type_ord',
  },
  'api::subscription-addon.subscription-addon.device_types': {
    table: 'subscription_addons_device_types_lnk',
    ownerColumn: 'subscription_addon_id',
    targetColumn: 'device_type_id',
    ownerOrderColumn: 'subscription_addon_ord',
    targetOrderColumn: 'device_type_ord',
  },
  'blocks.service-row.deviceTypes': {
    table: 'components_blocks_service_rows_device_types_lnk',
    ownerColumn: 'service_row_id',
    targetColumn: 'device_type_id',
    targetOrderColumn: 'device_type_ord',
  },
  'subscription.visit-service.service_parts': {
    table: 'components_subscription_visit_sec6d26_service_parts_lnk',
    ownerColumn: 'visit_service_id',
    targetColumn: 'service_part_id',
    targetOrderColumn: 'service_part_ord',
  },
};

/**
 * `device-type.service_parts` and `device-type.subscription_addons` are the
 * `mappedBy` (inverse, read-only-from-this-side) ends of the two relations
 * above — same physical table, columns swapped.
 */
relationTables['api::device-type.device-type.service_parts'] = {
  table: 'service_parts_device_types_lnk',
  ownerColumn: 'device_type_id',
  targetColumn: 'service_part_id',
  ownerOrderColumn: 'device_type_ord',
  targetOrderColumn: 'service_part_ord',
};

relationTables['api::device-type.device-type.subscription_addons'] = {
  table: 'subscription_addons_device_types_lnk',
  ownerColumn: 'device_type_id',
  targetColumn: 'subscription_addon_id',
  ownerOrderColumn: 'device_type_ord',
  targetOrderColumn: 'subscription_addon_ord',
};

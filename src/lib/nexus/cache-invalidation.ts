import { nexusFetch } from './client';

// Nexus only caches these content types (see nexus/src/constants/cache-tags.ts) — every
// other content type's `revalidateTag` call in entity-repository.ts has nothing to notify.
const NEXUS_CACHED_CONTENT_TYPES = new Set([
  'api::device-type.device-type',
  'api::subscription-plan.subscription-plan',
  'api::subscription-addon.subscription-addon',
  'api::service-part.service-part',
  'api::welcome-bonus.welcome-bonus',
]);

/**
 * Fire-and-forget: tells nexus to drop its cached copy of `contentTypeUid` right after a
 * write here, so admins see their change reflected in serwise/radix immediately instead of
 * waiting out nexus's own cache TTL. Deliberately not awaited by callers — a failure here
 * (nexus down, auth mismatch) must never block or fail a write that's already committed to
 * watchtower's own DB. Nexus's TTL fallback (CACHE_TTL_SECONDS) self-heals within minutes
 * even if this call is dropped entirely.
 */
export function notifyNexusCacheInvalidation(contentTypeUid: string): void {
  if (!NEXUS_CACHED_CONTENT_TYPES.has(contentTypeUid)) return;

  nexusFetch('/cache/invalidate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tags: [contentTypeUid] }),
  }).catch((err) => {
    console.error(`[nexus cache] failed to invalidate "${contentTypeUid}":`, err);
  });
}

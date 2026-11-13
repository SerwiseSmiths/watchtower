import { allContentTypes, resolveContentTypeSlug } from '@/lib/content-schema/registry';
import type { RawAttribute } from '@/lib/content-schema/loader';
import { contentTypeUid, type RegistrySnapshot } from '@/lib/content-schema/store';
import type { ContentTypeSchema } from '@/lib/content-schema/types';

// Core service data, owned by watchtower's own /pricing screen (whose code and nexus's quote
// pricing depend on these exact fields). Not editable in /cms — neither entries nor schema — even
// though /api and /graphql still serve them. Everything else, including Device Types (moved into the
// CMS 2026-11-01) and types created in the Content-Type Builder, is CMS content.
const CORE_CONTENT_TYPE_UIDS = new Set([
  'api::subscription-plan.subscription-plan',
  'api::subscription-addon.subscription-addon',
  'api::service-part.service-part',
]);

// Moved into pages on 2026-11-01 (scripts/cms-move-singletons.ts): Complaint Page → Page
// "complaint-detail", Login → Web Page "login". Hidden from /cms so nobody edits the stale copy, but
// still served by /api and /graphql because already-installed serwise builds query `complaintPage`.
// Once those builds are gone: remove them from this set, then delete them in the Content-Type Builder.
const LEGACY_CONTENT_TYPE_UIDS = new Set(['api::complaint-page.complaint-page', 'api::login.login']);

export function isCmsContentType(uid: string): boolean {
  return !CORE_CONTENT_TYPE_UIDS.has(uid) && !LEGACY_CONTENT_TYPE_UIDS.has(uid);
}

export function cmsContentTypes(): ContentTypeSchema[] {
  return allContentTypes().filter((c) => isCmsContentType(c.uid));
}

/** resolveContentTypeSlug, restricted to the types /cms is allowed to edit. */
export function resolveCmsContentTypeSlug(slug: string): ContentTypeSchema | null {
  const schema = resolveContentTypeSlug(slug);
  return schema && isCmsContentType(schema.uid) ? schema : null;
}

/** Components used (directly or nested) by core types — their schema is managed in code. */
export function protectedComponentUids(snapshot: RegistrySnapshot): Set<string> {
  const byUid = new Map(snapshot.components.map((c) => [c.uid, c.schema.attributes as Record<string, RawAttribute>]));
  const seen = new Set<string>();
  const queue = snapshot.contentTypes
    .filter((c) => !isCmsContentType(contentTypeUid(c)))
    .map((c) => c.attributes as Record<string, RawAttribute>);
  while (queue.length) {
    for (const attr of Object.values(queue.shift()!)) {
      const uids = attr.type === 'component' ? [attr.component!] : attr.type === 'dynamiczone' ? attr.components ?? [] : [];
      for (const uid of uids) {
        if (seen.has(uid) || !byUid.has(uid)) continue;
        seen.add(uid);
        queue.push(byUid.get(uid)!);
      }
    }
  }
  return seen;
}

// Content types serwise-website renders, and the cache tag each one maps to there
// (see serwise-website/src/cms/client.ts CMS_TAGS).
const WEBSITE_CACHE_TAGS: Record<string, string> = {
  'api::web-page.web-page': 'cms:web-page',
  'api::login.login': 'cms:login',
};

/**
 * Fire-and-forget: tells serwise-website to drop its cached copy of this content right
 * after a write here, so edits show on the next visit instead of after the site's own
 * time-based refresh (5 min). Not awaited by callers — the website being down must never
 * block or fail a write already committed to watchtower's DB.
 *
 * Env: WEBSITE_REVALIDATE_URL (e.g. https://serwise.co.in/api/revalidate) and
 * WEBSITE_REVALIDATE_SECRET (= the website's CMS_REVALIDATE_SECRET). Unset = no-op.
 */
export function notifyWebsiteRevalidation(contentTypeUid: string): void {
  const tag = WEBSITE_CACHE_TAGS[contentTypeUid];
  const url = process.env.WEBSITE_REVALIDATE_URL;
  const secret = process.env.WEBSITE_REVALIDATE_SECRET;
  if (!tag || !url || !secret) return;

  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-revalidate-secret': secret },
    body: JSON.stringify({ tags: [tag] }),
  })
    .then((res) => {
      if (!res.ok) console.error(`[website revalidate] "${tag}" → ${res.status}`);
    })
    .catch((err) => {
      console.error(`[website revalidate] failed for "${tag}":`, err);
    });
}

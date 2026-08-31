import jwt from 'jsonwebtoken';

function getNexusApiUrl(): string {
  const url = process.env.NEXUS_API_URL;
  if (!url) throw new Error('NEXUS_API_URL is not set');
  return url;
}

function getNexusJwtSecret(): string {
  const secret = process.env.NEXUS_JWT_SECRET;
  if (!secret) throw new Error('NEXUS_JWT_SECRET is not set');
  return secret;
}

/** Nexus's `authorize` middleware only reads the JWT payload's role — no DB lookup — so a
 *  short-lived service token with role ADMIN is enough to call admin-only endpoints.
 *  Memoized for ~45s (well within the 1m expiry) so repeated calls in a short window
 *  reuse the same signed token instead of paying jwt.sign() on every single request. */
let cachedServiceToken: { token: string; expiresAt: number } | null = null;

function signAdminServiceToken(): string {
  const now = Date.now();
  if (cachedServiceToken && cachedServiceToken.expiresAt > now) return cachedServiceToken.token;

  const token = jwt.sign({ id: 'watchtower-admin', phoneNo: 'watchtower', role: 'ADMIN' }, getNexusJwtSecret(), {
    expiresIn: '1m',
  });
  cachedServiceToken = { token, expiresAt: now + 45_000 };
  return token;
}

export interface NexusCacheOptions {
  /** Tags for on-demand invalidation via updateTag — pass on reads only. */
  tags?: string[];
  /** Time-based fallback revalidation (seconds) so data self-heals even if a write from
   *  outside Watchtower (radix, serwise) is never explicitly invalidated here. */
  revalidate?: number;
}

export async function nexusFetch(path: string, init: RequestInit = {}, cacheOpts?: NexusCacheOptions): Promise<Response> {
  const res = await fetch(`${getNexusApiUrl()}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${signAdminServiceToken()}`,
      'x-app-id': 'watchtower',
    },
    ...(cacheOpts
      ? { next: { tags: cacheOpts.tags, revalidate: cacheOpts.revalidate ?? 30 } }
      : { cache: 'no-store' }),
  });

  if (!res.ok) {
    const message = await res
      .clone()
      .json()
      .then((body) => body?.message as string | undefined)
      .catch(() => undefined);
    throw new Error(message || `Nexus ${init.method ?? 'GET'} ${path} failed with ${res.status}`);
  }

  return res;
}

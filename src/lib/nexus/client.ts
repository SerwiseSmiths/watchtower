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
 *  short-lived service token with role ADMIN is enough to call admin-only endpoints. */
function signAdminServiceToken(): string {
  return jwt.sign({ id: 'watchtower-admin', phoneNo: 'watchtower', role: 'ADMIN' }, getNexusJwtSecret(), {
    expiresIn: '1m',
  });
}

export async function nexusFetch(path: string, init: RequestInit = {}): Promise<Response> {
  console.log(getNexusApiUrl());
  
  const res = await fetch(`${getNexusApiUrl()}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${signAdminServiceToken()}`,
      'x-app-id': 'watchtower',
    },
    cache: 'no-store',
  });

  if (!res.ok) throw new Error(`Nexus ${init.method ?? 'GET'} ${path} failed with ${res.status}`);

  return res;
}

import { createHmac } from 'crypto';
import { prisma } from '../db/prisma';

export type ApiTokenType = 'read-only' | 'full-access' | 'custom';

export interface ApiTokenRecord {
  id: number;
  name: string;
  type: ApiTokenType;
  expiresAt: Date | null;
}

export interface AuthResult {
  authenticated: boolean;
  token?: ApiTokenRecord;
  error?: string;
}

/**
 * Exact port of Strapi's `admin::api-token` hashing
 * (console/node_modules/@strapi/admin/dist/server/server/src/services/api-token.js):
 * `crypto.createHmac('sha512', salt).update(accessKey).digest('hex')`.
 */
export function hashToken(rawToken: string, salt: string): string {
  return createHmac('sha512', salt).update(rawToken).digest('hex');
}

function extractBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) return null;
  const parts = authorizationHeader.trim().split(/\s+/);
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') return null;
  return parts[1];
}

/**
 * Verifies an `Authorization: Bearer <token>` header against `strapi_api_tokens`,
 * mirroring Strapi's own `api-token` auth strategy (expiry + lastUsedAt bump included).
 */
export async function authenticateApiToken(authorizationHeader: string | null): Promise<AuthResult> {
  const salt = process.env.API_TOKEN_SALT;
  if (!salt) throw new Error('API_TOKEN_SALT is not set');

  const rawToken = extractBearerToken(authorizationHeader);
  if (!rawToken) return { authenticated: false, error: 'Missing bearer token' };

  const accessKey = hashToken(rawToken, salt);
  const row = await prisma.strapi_api_tokens.findFirst({ where: { access_key: accessKey } });
  if (!row) return { authenticated: false, error: 'Invalid token' };

  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    return { authenticated: false, error: 'Token expired' };
  }

  const hoursSinceLastUsed = row.last_used_at
    ? (Date.now() - new Date(row.last_used_at).getTime()) / (1000 * 60 * 60)
    : Infinity;
  if (hoursSinceLastUsed >= 1) {
    await prisma.strapi_api_tokens.update({ where: { id: row.id }, data: { last_used_at: new Date() } });
  }

  return {
    authenticated: true,
    token: { id: row.id, name: row.name ?? '', type: (row.type as ApiTokenType) ?? 'read-only', expiresAt: row.expires_at },
  };
}

export type RequiredScope = 'find' | 'findOne' | 'create' | 'update' | 'delete' | 'publish';
const READ_SCOPES: RequiredScope[] = ['find', 'findOne'];

/**
 * Gates a request scope against the token's type, matching Strapi's `verify()`:
 * full-access bypasses everything, read-only allows only find/findOne, custom
 * checks `strapi_api_token_permissions` for an exact action match.
 */
export async function authorizeApiToken(token: ApiTokenRecord, contentTypeUid: string, scope: RequiredScope): Promise<boolean> {
  if (token.type === 'full-access') return true;
  if (token.type === 'read-only') return READ_SCOPES.includes(scope);
  if (token.type === 'custom') {
    const action = `${contentTypeUid}.${scope}`;
    const links = await prisma.strapi_api_token_permissions_token_lnk.findMany({ where: { api_token_id: token.id } });
    const permissionIds = links.map((l) => l.api_token_permission_id).filter((id): id is number => id != null);
    if (permissionIds.length === 0) return false;
    const permission = await prisma.strapi_api_token_permissions.findFirst({
      where: { id: { in: permissionIds }, action },
    });
    return !!permission;
  }
  return false;
}

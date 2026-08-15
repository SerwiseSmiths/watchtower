import jwt from 'jsonwebtoken';

export const ROOT_PENDING_COOKIE_NAME = 'watchtower_root_pending';
export const ROOT_SESSION_COOKIE_NAME = 'watchtower_root_session';

const PENDING_TTL_SECONDS = 5 * 60;
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

export interface RootPendingPayload {
  operatorId: number;
  purpose: 'root-2fa-pending';
}

export interface RootSessionPayload {
  operatorId: number;
  adminUserId: number;
  purpose: 'root-session';
}

function getSecret(): string {
  const secret = process.env.ROOT_JWT_SECRET;
  if (!secret) throw new Error('ROOT_JWT_SECRET is not set');
  return secret;
}

export function signPendingToken(operatorId: number): string {
  const payload: RootPendingPayload = { operatorId, purpose: 'root-2fa-pending' };
  return jwt.sign(payload, getSecret(), { expiresIn: PENDING_TTL_SECONDS });
}

export function verifyPendingToken(token: string): RootPendingPayload | null {
  try {
    const decoded = jwt.verify(token, getSecret()) as unknown as RootPendingPayload;
    if (decoded.purpose !== 'root-2fa-pending') return null;
    return decoded;
  } catch {
    return null;
  }
}

export function signRootSession(operatorId: number, adminUserId: number): string {
  const payload: RootSessionPayload = { operatorId, adminUserId, purpose: 'root-session' };
  return jwt.sign(payload, getSecret(), { expiresIn: SESSION_TTL_SECONDS });
}

export function verifyRootSession(token: string): RootSessionPayload | null {
  try {
    const decoded = jwt.verify(token, getSecret()) as unknown as RootSessionPayload;
    if (decoded.purpose !== 'root-session') return null;
    return decoded;
  } catch {
    return null;
  }
}

export const ROOT_PENDING_MAX_AGE = PENDING_TTL_SECONDS;
export const ROOT_SESSION_MAX_AGE = SESSION_TTL_SECONDS;

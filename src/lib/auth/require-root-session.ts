import { cookies } from 'next/headers';
import { prisma } from '@/lib/db/prisma';
import { ROOT_SESSION_COOKIE_NAME, verifyRootSession, type RootSessionPayload } from './root-session';

/** The JWT alone outlives an operator being deactivated or deleted (7-day session), so every
 *  session is re-checked against the operator row: it must still exist, be active, and belong
 *  to the same admin user the token was issued for. One indexed lookup per call. */
async function isOperatorActive(session: RootSessionPayload): Promise<boolean> {
  const operator = await prisma.watchtower_root_operators.findUnique({
    where: { id: session.operatorId },
    select: { is_active: true, admin_user_id: true },
  });
  return !!operator && operator.is_active === true && operator.admin_user_id === session.adminUserId;
}

export async function getRootSession(): Promise<RootSessionPayload | null> {
  const token = (await cookies()).get(ROOT_SESSION_COOKIE_NAME)?.value;
  const session = token ? verifyRootSession(token) : null;
  if (!session) return null;
  return (await isOperatorActive(session)) ? session : null;
}

/** Guard for server actions — they're callable as plain POST endpoints, so a page-level redirect
 * alone doesn't protect them. */
export async function requireRootSession(): Promise<RootSessionPayload> {
  const session = await getRootSession();
  if (!session) throw new Error('Not authenticated');
  return session;
}

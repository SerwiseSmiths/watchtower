import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ROOT_SESSION_COOKIE_NAME, ROOT_PENDING_COOKIE_NAME } from '@/lib/auth/root-session';

/** Clears the root session and redirects to login — hit whenever nexus rejects our
 *  service-to-service token (401 "Invalid or Expired Token"). Cookie mutation is only
 *  allowed in a Route Handler/Server Action, not during a Server Component's render, so
 *  `nexusFetch` redirects here instead of clearing the cookie itself. */
export async function GET(request: Request) {
  const cookieStore = await cookies();
  cookieStore.delete(ROOT_SESSION_COOKIE_NAME);
  cookieStore.delete(ROOT_PENDING_COOKIE_NAME);
  return NextResponse.redirect(new URL('/', request.url));
}

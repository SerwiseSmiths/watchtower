import { NextRequest, NextResponse } from 'next/server';

export const config = { matcher: ['/admin/:path*'] };

/**
 * Gates /admin/** (the human-facing panel) by source IP — does NOT apply to
 * /api or /graphql, which authenticate via Bearer API tokens instead (see
 * PROGRESS.md: panel auth and API auth are deliberately separate systems).
 * An unconfigured allowlist lets requests through rather than locking
 * everyone out before WATCHTOWER_ADMIN_ALLOWED_IPS is set — set it before
 * any real deployment.
 */
export function middleware(request: NextRequest) {
  const allowlist = (process.env.WATCHTOWER_ADMIN_ALLOWED_IPS ?? '')
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean);

  if (allowlist.length === 0) return NextResponse.next();

  const forwardedFor = request.headers.get('x-forwarded-for');
  const ip = forwardedFor?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || '';

  if (!allowlist.includes(ip)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  return NextResponse.next();
}

'use server';

import { cookies } from 'next/headers';
import { refresh, updateTag } from 'next/cache';
import { ROOT_SESSION_COOKIE_NAME, verifyRootSession } from '@/lib/auth/root-session';

export interface RealtimeConfig {
  url: string;
  anonKey: string;
  channel: string;
}

async function hasRootSession(): Promise<boolean> {
  const token = (await cookies()).get(ROOT_SESSION_COOKIE_NAME)?.value;
  return !!token && !!verifyRootSession(token);
}

/** The admin channel name is the only thing keeping nexus's admin feed private (Supabase
 *  broadcast channels are joinable by anyone with the anon key), so it's never put in a
 *  NEXT_PUBLIC_ var / the JS bundle — only handed to a browser holding a valid root session.
 *  Null = not logged in, or realtime not configured for this env. */
export async function getRealtimeConfig(): Promise<RealtimeConfig | null> {
  if (!(await hasRootSession())) return null;

  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const channelSecret = process.env.SUPABASE_ADMIN_CHANNEL;
  if (!url || !anonKey || !channelSecret) return null;

  return { url, anonKey, channel: `admin:${channelSecret}` };
}

// Only tags watchtower actually reads nexus data under (see src/lib/nexus/*.ts) — the client
// sends these, so don't let it expire arbitrary cache entries.
const ALLOWED_TAG = /^(complaints|customers|providers|customer:[\w-]+|provider:[\w-]+)$/;

/** Drops the nexus cache tags a realtime event touched and, when the current page shows
 *  live nexus data (`rerender`), re-renders it so the change appears without a manual reload.
 *  Other pages only get the tag drop — they'll load fresh on next navigation anyway. */
export async function refreshFromRealtime(tags: string[], rerender: boolean): Promise<void> {
  if (!(await hasRootSession())) return;

  for (const tag of new Set(tags)) {
    if (ALLOWED_TAG.test(tag)) updateTag(tag);
  }
  if (rerender) refresh();
}

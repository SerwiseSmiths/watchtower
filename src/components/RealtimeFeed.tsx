'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { Bell, CheckCircle2, AlertTriangle, XCircle, X } from 'lucide-react';
import { getRealtimeConfig, refreshFromRealtime } from '@/lib/realtime/actions';
import { reactionFor, type RealtimeToast, type RealtimeTone } from '@/lib/realtime/events';

// Live feed from nexus (secret admin channel — see nexus realtime.service.ts `emitToAdmin`).
// Mounted once in the root layout so the socket survives client-side navigation; it only
// connects once the server confirms a root session, and drops the socket on logout.

const TOAST_TTL_MS = 6_000;
const MAX_TOASTS = 4;
// Events tend to arrive in bursts (assign → stage change → updated), so coalesce them into
// one server refresh instead of re-rendering the page once per event.
const REFRESH_DEBOUNCE_MS = 500;
// Pages that render nexus data an event can change. Anywhere else (CMS, pricing, /admin, …)
// an event only drops cache tags — re-rendering those pages would be pure wasted load.
const LIVE_PAGES = ['/tickets', '/customers', '/providers'];

interface ToastItem extends RealtimeToast {
  key: number;
}

const TONE_COLORS: Record<RealtimeTone, string> = {
  info: '#2563EB',
  success: '#16A34A',
  warning: '#D97706',
  danger: '#DC2626',
};

const TONE_ICONS: Record<RealtimeTone, typeof Bell> = {
  info: Bell,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
};

export default function RealtimeFeed() {
  const pathname = usePathname();
  const router = useRouter();
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const clientRef = useRef<SupabaseClient | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const pendingTags = useRef<Set<string>>(new Set());
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastKey = useRef(0);
  const pathnameRef = useRef(pathname);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const dismiss = useCallback((key: number) => {
    setToasts((prev) => prev.filter((t) => t.key !== key));
  }, []);

  const pushToast = useCallback(
    (toast: RealtimeToast) => {
      const key = ++toastKey.current;
      setToasts((prev) => [...prev, { ...toast, key }].slice(-MAX_TOASTS));
      setTimeout(() => dismiss(key), TOAST_TTL_MS);
    },
    [dismiss],
  );

  const scheduleRefresh = useCallback((tags: string[]) => {
    tags.forEach((tag) => pendingTags.current.add(tag));
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      const batch = [...pendingTags.current];
      pendingTags.current.clear();
      const rerender = LIVE_PAGES.some((p) => pathnameRef.current === p || pathnameRef.current?.startsWith(`${p}/`));
      refreshFromRealtime(batch, rerender).catch((err) => console.error('[realtime] refresh failed', err));
    }, REFRESH_DEBOUNCE_MS);
  }, []);

  const disconnect = useCallback(() => {
    if (clientRef.current && channelRef.current) clientRef.current.removeChannel(channelRef.current);
    clientRef.current = null;
    channelRef.current = null;
  }, []);

  // Re-checked on every navigation: picks up a fresh login (/ → /tickets) and tears the
  // socket down after logout, without needing a full page load either way.
  useEffect(() => {
    let cancelled = false;

    getRealtimeConfig()
      .then(async (config) => {
        if (cancelled) return;
        if (!config) {
          disconnect();
          return;
        }
        if (channelRef.current) return;

        // Loaded on demand so logged-out pages (login, enrollment) never download the SDK.
        const { createClient } = await import('@supabase/supabase-js');
        if (cancelled || channelRef.current) return;

        const client = createClient(config.url, config.anonKey, {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        });
        const channel = client.channel(config.channel);
        let joinedBefore = false;

        channel.on('broadcast', { event: '*' }, (msg) => {
          const event = String(msg.event ?? '');
          const payload = (msg.payload ?? {}) as Record<string, unknown>;
          const reaction = reactionFor(event, payload);
          if (reaction.toast) pushToast(reaction.toast);
          scheduleRefresh(reaction.tags);
        });

        channel.subscribe((status) => {
          if (status !== 'SUBSCRIBED') {
            if (status !== 'CLOSED') console.warn('[realtime] admin channel', status);
            return;
          }
          // Supabase rejoins on its own after a drop (sleep, wifi blip) — anything broadcast
          // while we were away is gone, so catch up with one full refresh.
          if (joinedBefore) scheduleRefresh(['complaints', 'customers', 'providers']);
          joinedBefore = true;
        });

        clientRef.current = client;
        channelRef.current = channel;
      })
      .catch((err) => console.error('[realtime] config failed', err));

    return () => {
      cancelled = true;
    };
  }, [pathname, disconnect, pushToast, scheduleRefresh]);

  useEffect(
    () => () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      disconnect();
    },
    [disconnect],
  );

  if (toasts.length === 0) return null;

  return (
    <div style={stackStyle} aria-live="polite">
      {toasts.map((toast) => {
        const Icon = TONE_ICONS[toast.tone];
        return (
          <div
            key={toast.key}
            role="status"
            style={{ ...toastStyle, borderLeftColor: TONE_COLORS[toast.tone], cursor: toast.href ? 'pointer' : 'default' }}
            onClick={() => {
              if (toast.href) router.push(toast.href);
              dismiss(toast.key);
            }}
          >
            <Icon size={18} color={TONE_COLORS[toast.tone]} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#181818', letterSpacing: '-0.02em' }}>{toast.title}</div>
              {toast.body && (
                <div style={{ fontSize: 12, color: '#6B6B6B', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {toast.body}
                </div>
              )}
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={(e) => {
                e.stopPropagation();
                dismiss(toast.key);
              }}
              style={closeStyle}
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

const stackStyle: CSSProperties = {
  position: 'fixed',
  right: 20,
  bottom: 20,
  zIndex: 2000,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  width: 340,
  maxWidth: 'calc(100vw - 40px)',
};

const toastStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 10,
  padding: '12px 12px 12px 14px',
  background: '#FFFFFF',
  borderRadius: 8,
  borderLeft: '4px solid',
  boxShadow: '0 6px 24px rgba(0,0,0,0.12)',
};

const closeStyle: CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: '#9A9A9A',
  padding: 2,
  lineHeight: 0,
  cursor: 'pointer',
};

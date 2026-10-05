'use client';

import { createContext, useCallback, useContext, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import type { WhatsAppStatus } from '@/lib/nexus/whatsapp';
import { getWhatsAppStatusAction, logoutWhatsAppAction, startWhatsAppPairingAction } from './actions';

// The WhatsApp number this environment's nexus sends nudges from. Shared by the
// header control and every Nudge button, so connecting in the popup updates all
// of them at once. Dev watchtower talks to dev nexus, prod to prod — each
// environment shows and manages its own number.

const WHATSAPP_GREEN = '#25D366';
const POLL_MS = 3000;
// Nexus gives the admin 2 minutes to type the code, plus ~10s to save the session.
const LINK_WINDOW_MS = 2.5 * 60_000;

interface WhatsAppContextValue {
  /** null until the first status load (or if nexus couldn't be reached). */
  status: WhatsAppStatus | null;
  refresh: () => Promise<WhatsAppStatus | null>;
  /** Opens the connect popup, optionally explaining why it was opened. */
  openConnect: (reason?: string) => void;
}

const WhatsAppContext = createContext<WhatsAppContextValue | null>(null);

export function useWhatsApp(): WhatsAppContextValue {
  const ctx = useContext(WhatsAppContext);
  if (!ctx) throw new Error('useWhatsApp must be used inside <WhatsAppProvider>');
  return ctx;
}

export function formatWhatsAppNumber(number: string): string {
  // "919876543210" → "+91 98765 43210"; other countries just get a leading "+".
  if (number.length === 12 && number.startsWith('91')) return `+91 ${number.slice(2, 7)} ${number.slice(7)}`;
  return `+${number}`;
}

export function WhatsAppProvider({ initialStatus, children }: { initialStatus: WhatsAppStatus | null; children: ReactNode }) {
  const [status, setStatus] = useState<WhatsAppStatus | null>(initialStatus);
  const [connectReason, setConnectReason] = useState<string | null | undefined>(undefined);

  const refresh = useCallback(async () => {
    const result = await getWhatsAppStatusAction();
    const next = result.ok ? result.data : null;
    if (next) setStatus(next);
    return next;
  }, []);

  const openConnect = useCallback((reason?: string) => setConnectReason(reason ?? null), []);

  return (
    <WhatsAppContext.Provider value={{ status, refresh, openConnect }}>
      {children}
      {connectReason !== undefined && (
        <ConnectWhatsAppModal
          reason={connectReason}
          resumePairing={status?.pairing ?? null}
          onClose={() => {
            setConnectReason(undefined);
            // Closing mid-link leaves it running in nexus — the header should say so.
            void refresh();
          }}
          onConnected={setStatus}
        />
      )}
    </WhatsAppContext.Provider>
  );
}

// ─── Header control ───────────────────────────────────────────────────────────

const headerButtonStyle: CSSProperties = {
  border: 'none',
  borderRadius: 5,
  padding: '10px 16px',
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: '-0.03em',
  whiteSpace: 'nowrap',
};

/** Not connected → "Connect WhatsApp". Connected → the number plus "Logout" to switch accounts. */
export function WhatsAppHeaderControl() {
  const { status, refresh, openConnect } = useWhatsApp();
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function logout() {
    setLoggingOut(true);
    setError(null);
    const result = await logoutWhatsAppAction();
    setLoggingOut(false);
    setConfirmingLogout(false);
    if (!result.ok) setError(result.error);
    await refresh();
  }

  if (!status?.connected) {
    return (
      <div className="d-flex flex-column align-items-end" style={{ gap: 4 }}>
        <button type="button" onClick={() => openConnect()} style={{ ...headerButtonStyle, background: WHATSAPP_GREEN, color: '#FFFFFF' }}>
          {status?.pairing ? 'Connecting WhatsApp…' : 'Connect WhatsApp'}
        </button>
        {status === null && <span style={{ fontSize: 10, fontWeight: 600, color: '#FF5E5E' }}>Couldn&apos;t load WhatsApp status</span>}
      </div>
    );
  }

  return (
    <div className="d-flex flex-column align-items-end" style={{ gap: 4, position: 'relative' }}>
      <div className="d-flex align-items-center" style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 6, padding: '4px 4px 4px 12px', gap: 10 }}>
        <span className="d-flex align-items-center" style={{ gap: 6, fontSize: 12, fontWeight: 600, letterSpacing: '-0.03em', color: '#181818' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: WHATSAPP_GREEN }} />
          WhatsApp {formatWhatsAppNumber(status.number ?? '')}
        </span>
        <button
          type="button"
          onClick={() => setConfirmingLogout((v) => !v)}
          style={{ ...headerButtonStyle, padding: '6px 12px', background: '#E5E5E5', color: '#181818' }}
        >
          Logout
        </button>
      </div>

      {confirmingLogout && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            width: 260,
            background: '#FFFFFF',
            border: '1px solid #E5E5E5',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            padding: 14,
            zIndex: 30,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '-0.03em', color: '#181818', marginBottom: 6 }}>
            Disconnect {formatWhatsAppNumber(status.number ?? '')}?
          </div>
          <div style={{ fontSize: 11, fontWeight: 500, color: '#7A7A7A', marginBottom: 10 }}>
            Nudges stop sending until you connect a number again. Use this to switch to a different account.
          </div>
          <div className="d-flex" style={{ gap: 8 }}>
            <button type="button" onClick={() => setConfirmingLogout(false)} style={{ ...headerButtonStyle, flex: 1, padding: '8px', background: '#E5E5E5', color: '#181818' }}>
              Cancel
            </button>
            <button type="button" disabled={loggingOut} onClick={logout} style={{ ...headerButtonStyle, flex: 1, padding: '8px', background: '#FF5E5E', color: '#FFFFFF' }}>
              {loggingOut ? 'Logging out…' : 'Logout'}
            </button>
          </div>
        </div>
      )}

      {error && <span style={{ fontSize: 10, fontWeight: 600, color: '#FF5E5E' }}>{error}</span>}
    </div>
  );
}

// ─── Connect popup ────────────────────────────────────────────────────────────

type Step = { kind: 'phone' } | { kind: 'code'; code: string | null; startedAt: number } | { kind: 'done'; number: string };

const inputStyle: CSSProperties = {
  width: '100%',
  background: '#EFEFEF',
  border: '1px solid #E5E5E5',
  borderRadius: 6,
  padding: '11px',
  fontSize: 14,
  fontWeight: 600,
  letterSpacing: '-0.03em',
  color: '#000000',
  outline: 'none',
};

function ConnectWhatsAppModal({
  reason,
  resumePairing,
  onClose,
  onConnected,
}: {
  reason: string | null;
  resumePairing: WhatsAppStatus['pairing'];
  onClose: () => void;
  onConnected: (status: WhatsAppStatus) => void;
}) {
  // Reopening while a link is still in progress resumes waiting on it (the code
  // itself isn't stored, so it can't be shown again — only the wait).
  const [step, setStep] = useState<Step>(
    resumePairing ? { kind: 'code', code: null, startedAt: Date.parse(resumePairing.startedAt) } : { kind: 'phone' },
  );
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestCode() {
    setBusy(true);
    setError(null);
    const result = await startWhatsAppPairingAction(phone);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setStep({ kind: 'code', code: result.data.code, startedAt: Date.now() });
  }

  // While a code is out, poll until nexus reports the link finished (or failed).
  useEffect(() => {
    if (step.kind !== 'code') return;
    const id = setInterval(async () => {
      const result = await getWhatsAppStatusAction();
      if (!result.ok) return;
      const status = result.data;
      if (status.connected && status.number) {
        clearInterval(id);
        onConnected(status);
        setStep({ kind: 'done', number: status.number });
      } else if (!status.pairing) {
        clearInterval(id);
        setError(status.lastError ?? 'Linking did not complete — please try again.');
        setStep({ kind: 'phone' });
      } else if (Date.now() - step.startedAt > LINK_WINDOW_MS) {
        clearInterval(id);
        setError('The code expired before it was entered — please try again.');
        setStep({ kind: 'phone' });
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [step, onConnected]);

  const titleStyle: CSSProperties = { fontSize: 18, fontWeight: 700, letterSpacing: '-0.03em', color: '#181818' };
  const textStyle: CSSProperties = { fontSize: 12, fontWeight: 500, letterSpacing: '-0.03em', color: '#454545' };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />

      <div style={{ position: 'relative', width: 'min(420px, 92vw)', background: '#FFFFFF', borderRadius: 10, padding: 24 }}>
        {step.kind === 'phone' && (
          <>
            <div style={titleStyle}>Connect WhatsApp</div>
            {reason && <div style={{ ...textStyle, color: '#B26B00', background: '#FFF4E0', borderRadius: 6, padding: '8px 10px', marginTop: 10 }}>{reason}</div>}
            <div style={{ ...textStyle, marginTop: 10, marginBottom: 14 }}>
              Customer nudges are sent from this number. Enter the WhatsApp number to connect — you&apos;ll get a code to type on that phone.
            </div>
            <input
              type="tel"
              placeholder="WhatsApp number, e.g. 98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && phone.trim() && !busy && requestCode()}
              autoFocus
              style={inputStyle}
            />
            <div style={{ fontSize: 10, fontWeight: 500, color: '#B7B7B7', marginTop: 4 }}>Include the country code for numbers outside India.</div>
          </>
        )}

        {step.kind === 'code' && (
          <>
            <div style={titleStyle}>Enter this code on the phone</div>
            {step.code ? (
              <div
                style={{ fontSize: 30, fontWeight: 700, letterSpacing: '0.12em', fontFamily: 'monospace', textAlign: 'center', background: '#F2F2F2', borderRadius: 8, padding: '14px 0', margin: '14px 0' }}
              >
                {step.code.length === 8 ? `${step.code.slice(0, 4)}-${step.code.slice(4)}` : step.code}
              </div>
            ) : (
              <div style={{ ...textStyle, margin: '14px 0' }}>A connection is already in progress — enter the code that was shown when it started.</div>
            )}
            <ol style={{ ...textStyle, paddingLeft: 18, margin: 0, lineHeight: 1.7 }}>
              <li>Open WhatsApp on the phone</li>
              <li>Go to <b>Settings → Linked devices → Link a device</b></li>
              <li>Tap <b>Link with phone number instead</b></li>
              <li>Type the code above</li>
            </ol>
            <div className="d-flex align-items-center" style={{ gap: 8, marginTop: 14, fontSize: 11, fontWeight: 600, color: '#7A7A7A' }}>
              <span className="spinner-border spinner-border-sm" style={{ width: 12, height: 12, borderWidth: 2 }} />
              Waiting for the phone… (code is valid for 2 minutes)
            </div>
          </>
        )}

        {step.kind === 'done' && (
          <>
            <div style={titleStyle}>WhatsApp connected</div>
            <div style={{ ...textStyle, marginTop: 10 }}>
              Nudges will now be sent from <b>{formatWhatsAppNumber(step.number)}</b>.
            </div>
          </>
        )}

        {error && <div style={{ fontSize: 11, fontWeight: 600, color: '#FF5E5E', marginTop: 10 }}>{error}</div>}

        <div className="d-flex justify-content-end" style={{ gap: 8, marginTop: 20 }}>
          {step.kind === 'phone' && (
            <>
              <button type="button" onClick={onClose} style={{ ...headerButtonStyle, background: '#E5E5E5', color: '#181818' }}>
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || !phone.trim()}
                onClick={requestCode}
                style={{ ...headerButtonStyle, background: WHATSAPP_GREEN, color: '#FFFFFF', opacity: busy || !phone.trim() ? 0.6 : 1 }}
              >
                {busy ? 'Getting code…' : 'Get code'}
              </button>
            </>
          )}
          {step.kind === 'code' && (
            <button type="button" onClick={onClose} style={{ ...headerButtonStyle, background: '#E5E5E5', color: '#181818' }}>
              Close (keeps waiting)
            </button>
          )}
          {step.kind === 'done' && (
            <button type="button" onClick={onClose} style={{ ...headerButtonStyle, background: '#181818', color: '#FFFFFF' }}>
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

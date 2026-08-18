'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { startRegistration } from '@simplewebauthn/browser';
import { getRegistrationOptionsAction, completeEnrollmentAction } from './actions';

export default function EnrollForm({ token }: { token: string }) {
  const router = useRouter();
  const [deviceLabel, setDeviceLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function register() {
    setBusy(true);
    setError(null);
    try {
      const options = await getRegistrationOptionsAction(token);
      const response = await startRegistration({ optionsJSON: options });
      const result = await completeEnrollmentAction(token, response, deviceLabel);
      if (!result.ok) {
        setError(result.error ?? 'Passkey registration failed');
        return;
      }
      setDone(true);
      setTimeout(() => router.push('/'), 1500);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[Passkey enrollment] registration failed:', err);
      const message = err instanceof Error && err.message
        ? err.message
        : 'Passkey registration was cancelled or failed on this device';
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p className="mb-0" style={{ color: '#181818' }}>
        Device registered — redirecting to sign in…
      </p>
    );
  }

  return (
    <div>
      <p className="mb-3" style={{ color: '#B7B7B7', fontWeight: 500 }}>
        This link is single-use and registers a passkey for this device only.
      </p>
      <input
        type="text"
        placeholder="Device label (optional, e.g. work laptop)"
        value={deviceLabel}
        onChange={(e) => setDeviceLabel(e.target.value)}
        className="form-control mb-3"
        style={{ background: '#EFEFEF', border: '1px solid #E5E5E5', borderRadius: 6, padding: '11px' }}
      />
      {error && <p className="text-danger small mb-3">{error}</p>}
      <button
        type="button"
        onClick={register}
        disabled={busy}
        className="btn w-100"
        style={{ background: '#181818', color: '#E5E5E5', borderRadius: 6, padding: '11px', fontWeight: 600 }}
      >
        {busy ? 'Registering…' : 'Register this device'}
      </button>
    </div>
  );
}

'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { startAuthentication } from '@simplewebauthn/browser';
import {
  requestOtpAction,
  verifyOtpAction,
  getAssertionOptionsAction,
  verifyAssertionAction,
  type RequestOtpState,
  type VerifyOtpState,
} from './actions';

type Step = 'phone' | 'otp' | 'passkey' | 'no-passkey';

export default function LoginForm() {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [step, setStep] = useState<Step>('phone');
  const [passkeyError, setPasskeyError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const [otpState, otpFormAction, otpPending] = useActionState<RequestOtpState | undefined, FormData>(
    requestOtpAction,
    undefined
  );
  const [verifyState, verifyFormAction, verifyPending] = useActionState<VerifyOtpState | undefined, FormData>(
    verifyOtpAction,
    undefined
  );

  useEffect(() => {
    if (otpState?.sent) setStep('otp');
  }, [otpState]);

  useEffect(() => {
    if (!verifyState?.verified) return;
    if (!verifyState.hasCredentials) {
      setStep('no-passkey');
      return;
    }
    setStep('passkey');
    runPasskeyCeremony();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verifyState]);

  async function runPasskeyCeremony() {
    setPasskeyError(null);
    try {
      const options = await getAssertionOptionsAction();
      const response = await startAuthentication({ optionsJSON: options });
      const result = await verifyAssertionAction(response);
      if (!result.ok) {
        setPasskeyError(result.error ?? 'Passkey verification failed');
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setPasskeyError('Passkey ceremony was cancelled or failed on this device');
    }
  }

  return (
    <div className="d-flex min-vh-100">
      <div
        className="d-none d-md-flex align-items-center justify-content-center"
        style={{ flex: '0 0 60%', background: '#ECEAF3' }}
      >
        <Image
          src="/watchtower-logo.png"
          alt="Watchtower"
          width={4545}
          height={4500}
          style={{ width: 640, height: 'auto' }}
          priority
        />
      </div>

      <div className="d-flex align-items-center justify-content-center flex-grow-1 bg-white">
        <div style={{ width: 380, maxWidth: '90vw' }}>
          <h1 className="fw-bold mb-1" style={{ fontSize: 32, letterSpacing: '-0.03em', color: '#181818' }}>
            Credentials
          </h1>
          <p className="mb-4" style={{ color: '#B7B7B7', fontWeight: 500 }}>
            Restricted Users are allowed to be in a watch tower.
          </p>

          {step === 'phone' && (
            <form action={otpFormAction}>
              <input
                name="phoneNumber"
                type="tel"
                required
                placeholder="Mobile No."
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="form-control mb-3"
                style={{ background: '#EFEFEF', border: '1px solid #E5E5E5', borderRadius: 6, padding: '11px' }}
              />
              {otpState?.error && <p className="text-danger small mb-3">{otpState.error}</p>}
              <button
                type="submit"
                disabled={otpPending}
                className="btn w-100"
                style={{ background: '#181818', color: '#E5E5E5', borderRadius: 6, padding: '11px', fontWeight: 600 }}
              >
                {otpPending ? 'Sending…' : 'Send OTP'}
              </button>
            </form>
          )}

          {step === 'otp' && (
            <form action={verifyFormAction}>
              <input type="hidden" name="phoneNumber" value={phoneNumber} />
              <input
                name="code"
                type="text"
                inputMode="numeric"
                required
                placeholder="OTP"
                className="form-control mb-3"
                style={{ background: '#EFEFEF', border: '1px solid #E5E5E5', borderRadius: 6, padding: '11px' }}
              />
              {verifyState?.error && <p className="text-danger small mb-3">{verifyState.error}</p>}
              <button
                type="submit"
                disabled={verifyPending}
                className="btn w-100"
                style={{ background: '#181818', color: '#E5E5E5', borderRadius: 6, padding: '11px', fontWeight: 600 }}
              >
                {verifyPending ? 'Verifying…' : 'Continue'}
              </button>
            </form>
          )}

          {step === 'passkey' && (
            <div>
              <p className="mb-3" style={{ color: '#181818' }}>
                Confirm with your device&apos;s passkey…
              </p>
              {passkeyError && (
                <>
                  <p className="text-danger small mb-3">{passkeyError}</p>
                  <button
                    type="button"
                    onClick={runPasskeyCeremony}
                    className="btn w-100"
                    style={{ background: '#181818', color: '#E5E5E5', borderRadius: 6, padding: '11px', fontWeight: 600 }}
                  >
                    Try again
                  </button>
                </>
              )}
            </div>
          )}

          {step === 'no-passkey' && (
            <p className="mb-0" style={{ color: '#181818' }}>
              No passkey is registered for this device yet. Ask an admin to send you an enrollment
              link before you can sign in.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

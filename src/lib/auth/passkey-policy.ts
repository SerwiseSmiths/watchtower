/**
 * Passkey (WebAuthn) is the second login factor for prod only — local and the
 * dev deployment sign in with phone + OTP alone.
 *
 * Both Vercel projects run as NODE_ENV/VERCEL_ENV "production", so they're told
 * apart by branch: `watchtower` builds only `production`, `watchtower-dev` only
 * `pre-prod`. Fails closed: on Vercel, anything that isn't recognisably dev
 * (including a deploy with no git ref) still requires the passkey.
 *
 * `WATCHTOWER_ENV` (production | development | local) overrides the inference.
 */
export function isPasskeyRequired(): boolean {
  const explicit = process.env.WATCHTOWER_ENV?.trim().toLowerCase();
  if (explicit) return explicit === 'production';

  if (!process.env.VERCEL) return false; // running locally

  return process.env.VERCEL_GIT_COMMIT_REF !== 'pre-prod';
}

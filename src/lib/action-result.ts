import { unstable_rethrow } from 'next/navigation';

/** Server actions that can fail for a business reason return this instead of throwing —
 *  production Next.js hides thrown server-action messages, and the UI needs nexus's actual
 *  reason (insufficient balance, quote already approved, reused idempotency key, …). */
export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

/** Message for an `{ ok: false }` result. Lets Next's control-flow errors (nexusFetch's
 *  redirect-to-login on an expired session) through instead of reporting them as errors. */
export const errorMessage = (err: unknown): string => {
  unstable_rethrow(err);
  return err instanceof Error ? err.message : 'Something went wrong';
};

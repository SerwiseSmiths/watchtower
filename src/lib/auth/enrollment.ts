import crypto from 'crypto';
import { prisma } from '@/lib/db/prisma';

const ENROLLMENT_TTL_MINUTES = 15;

export async function createEnrollment(operatorId: number, deviceLabel?: string) {
  const token = crypto.randomBytes(24).toString('base64url');
  const expiresAt = new Date(Date.now() + ENROLLMENT_TTL_MINUTES * 60 * 1000);

  return prisma.watchtower_passkey_enrollments.create({
    data: { operator_id: operatorId, token, device_label: deviceLabel || null, expires_at: expiresAt },
  });
}

export type EnrollmentCheckResult =
  | { ok: true; operatorId: number; enrollmentId: number }
  | { ok: false; error: string };

/** Validates a token without consuming it — call markEnrollmentUsed only after registration succeeds. */
export async function checkEnrollment(token: string): Promise<EnrollmentCheckResult> {
  const enrollment = await prisma.watchtower_passkey_enrollments.findUnique({ where: { token } });
  if (!enrollment) return { ok: false, error: 'Invalid enrollment link' };
  if (enrollment.used_at) return { ok: false, error: 'This enrollment link has already been used' };
  if (enrollment.expires_at < new Date()) return { ok: false, error: 'This enrollment link has expired' };

  return { ok: true, operatorId: enrollment.operator_id, enrollmentId: enrollment.id };
}

export async function markEnrollmentUsed(enrollmentId: number) {
  await prisma.watchtower_passkey_enrollments.update({
    where: { id: enrollmentId },
    data: { used_at: new Date() },
  });
}

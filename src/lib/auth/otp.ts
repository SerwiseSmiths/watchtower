import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db/prisma';
import { sendOtpSms } from './hanuotp';
import { findActiveOperatorByPhone, normalizePhoneNumber } from './operators';

const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;

export type RequestOtpResult = { ok: true } | { ok: false; error: string };

/** Only ever sends to numbers already linked to an active operator — never enumerates which. */
export async function requestOtp(phoneNumberRaw: string): Promise<RequestOtpResult> {
  const phoneNumber = normalizePhoneNumber(phoneNumberRaw);
  const operator = await findActiveOperatorByPhone(phoneNumber);
  if (!operator) return { ok: false, error: 'This number is not authorized for Watchtower access' };

  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
  const codeHash = await bcrypt.hash(otpCode, 10);

  await prisma.watchtower_otp_codes.upsert({
    where: { phone_number: phoneNumber },
    update: { code_hash: codeHash, expires_at: expiresAt, attempts: 0 },
    create: { phone_number: phoneNumber, code_hash: codeHash, expires_at: expiresAt },
  });

  const result = await sendOtpSms({ recipientNumber: phoneNumber, otp: otpCode });
  if (!result.success) return { ok: false, error: 'Failed to send OTP. Please try again.' };

  return { ok: true };
}

export type VerifyOtpResult =
  | { ok: true; operatorId: number; adminUserId: number; hasCredentials: boolean }
  | { ok: false; error: string };

export async function verifyOtp(phoneNumberRaw: string, code: string): Promise<VerifyOtpResult> {
  const phoneNumber = normalizePhoneNumber(phoneNumberRaw);
  const record = await prisma.watchtower_otp_codes.findUnique({ where: { phone_number: phoneNumber } });
  if (!record) return { ok: false, error: 'OTP not found or expired' };

  if (record.expires_at < new Date()) {
    await prisma.watchtower_otp_codes.delete({ where: { phone_number: phoneNumber } });
    return { ok: false, error: 'OTP expired' };
  }

  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    return { ok: false, error: 'Maximum OTP attempts exceeded' };
  }

  const matches = await bcrypt.compare(code, record.code_hash);
  if (!matches) {
    await prisma.watchtower_otp_codes.update({
      where: { phone_number: phoneNumber },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, error: 'Invalid OTP' };
  }

  await prisma.watchtower_otp_codes.delete({ where: { phone_number: phoneNumber } });

  const operator = await findActiveOperatorByPhone(phoneNumber);
  if (!operator) return { ok: false, error: 'This number is not authorized for Watchtower access' };

  const credentialCount = await prisma.watchtower_webauthn_credentials.count({
    where: { operator_id: operator.id },
  });

  return {
    ok: true,
    operatorId: operator.id,
    adminUserId: operator.admin_user_id,
    hasCredentials: credentialCount > 0,
  };
}

const HANUOTP_BASE = 'https://api.hanuotp.in/sms-otp.php';

export interface SendOtpSmsOptions {
  recipientNumber: string;
  otp: string;
}

/** Ported from nexus/src/services/hanuotp.service.ts — same provider/account, reused here. */
export async function sendOtpSms(options: SendOtpSmsOptions): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.HANUOTP_API_KEY;
  const templateSid = process.env.HANUOTP_TEMPLATE_SID ?? 'default';

  if (!apiKey) {
    return { success: false, error: 'SMS OTP not configured' };
  }

  const recipientNumber = normalizePhoneForHanuOtp(options.recipientNumber);
  const url = new URL(HANUOTP_BASE);
  url.searchParams.set('number', recipientNumber);
  url.searchParams.set('OTP', options.otp);
  url.searchParams.set('apikey', apiKey);
  url.searchParams.set('templatesid', templateSid);

  try {
    const response = await fetch(url.toString(), { method: 'GET', signal: AbortSignal.timeout(15000) });
    const data = await response.json().catch(() => null);

    if (data?.status === 'error') {
      return { success: false, error: data?.message || 'Unknown HanuOTP error' };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown HanuOTP error' };
  }
}

function normalizePhoneForHanuOtp(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('91')) {
    return digits.slice(-10);
  }
  return digits;
}

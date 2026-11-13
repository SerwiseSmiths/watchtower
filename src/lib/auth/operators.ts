import { randomBytes } from 'crypto';
import { prisma } from '@/lib/db/prisma';

export function normalizePhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.length > 10 && digits.startsWith('91') ? digits.slice(-10) : digits;
}

/** Active operator by phone number — the gate for root login. Returns null for unknown/inactive numbers. */
export async function findActiveOperatorByPhone(phoneNumber: string) {
  return prisma.watchtower_root_operators.findFirst({
    where: { phone_number: normalizePhoneNumber(phoneNumber), is_active: true },
    include: { admin_user: true },
  });
}

export async function findOperatorById(operatorId: number) {
  return prisma.watchtower_root_operators.findUnique({
    where: { id: operatorId },
    include: { admin_user: true },
  });
}

export async function listOperatorsWithCredentials() {
  return prisma.watchtower_root_operators.findMany({
    include: {
      admin_user: true,
      credentials: { orderBy: { created_at: 'desc' } },
      enrollments: { where: { used_at: null }, orderBy: { created_at: 'desc' } },
    },
    orderBy: { created_at: 'desc' },
  });
}

export interface CreateOperatorInput {
  firstname: string;
  lastname: string;
  email: string;
  phoneNumber: string;
}

const DOCUMENT_ID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

function generateDocumentId(length = 24): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += DOCUMENT_ID_ALPHABET[bytes[i] % DOCUMENT_ID_ALPHABET.length];
  return out;
}

/** Every operator hangs off an `admin_users` row (root sessions and content-manager author stamps
 *  carry its id). Reuses an existing row with the same email when it has no operator yet, otherwise
 *  creates a password-less one — sign-in is phone+OTP+passkey only. */
export async function createOperatorWithAccount({ firstname, lastname, email, phoneNumber }: CreateOperatorInput) {
  const normalizedEmail = email.trim().toLowerCase();
  return prisma.$transaction(async (tx) => {
    const existing = await tx.admin_users.findFirst({
      where: { email: normalizedEmail },
      include: { watchtower_root_operator: true },
    });
    if (existing?.watchtower_root_operator) throw new Error('This email already belongs to an operator');

    const now = new Date();
    const adminUser =
      existing ??
      (await tx.admin_users.create({
        data: {
          document_id: generateDocumentId(),
          firstname: firstname.trim(),
          lastname: lastname.trim(),
          email: normalizedEmail,
          username: normalizedEmail,
          is_active: true,
          blocked: false,
          created_at: now,
          updated_at: now,
          published_at: now,
        },
      }));

    return tx.watchtower_root_operators.create({
      data: { admin_user_id: adminUser.id, phone_number: normalizePhoneNumber(phoneNumber) },
    });
  });
}

export async function setOperatorActive(operatorId: number, isActive: boolean) {
  return prisma.watchtower_root_operators.update({
    where: { id: operatorId },
    data: { is_active: isActive, updated_at: new Date() },
  });
}

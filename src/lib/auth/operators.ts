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

export async function createOperator(adminUserId: number, phoneNumber: string) {
  return prisma.watchtower_root_operators.create({
    data: { admin_user_id: adminUserId, phone_number: normalizePhoneNumber(phoneNumber) },
  });
}

export async function setOperatorActive(operatorId: number, isActive: boolean) {
  return prisma.watchtower_root_operators.update({
    where: { id: operatorId },
    data: { is_active: isActive, updated_at: new Date() },
  });
}

export async function searchAdminUsersWithoutOperator(query: string) {
  return prisma.admin_users.findMany({
    where: {
      watchtower_root_operator: null,
      is_active: true,
      blocked: false,
      OR: query
        ? [
            { email: { contains: query, mode: 'insensitive' } },
            { firstname: { contains: query, mode: 'insensitive' } },
            { lastname: { contains: query, mode: 'insensitive' } },
          ]
        : undefined,
    },
    take: 20,
    orderBy: { email: 'asc' },
  });
}

import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db/prisma';

// Same alphabet/length convention entity-repository.ts uses for every other
// content-manager row, so admin_users rows created here look identical to
// ones Strapi's own admin panel would have produced.
const DOCUMENT_ID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

function generateDocumentId(length = 24): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += DOCUMENT_ID_ALPHABET[bytes[i] % DOCUMENT_ID_ALPHABET.length];
  return out;
}

export interface CreateAdminUserInput {
  firstname: string;
  lastname: string;
  email: string;
  password: string;
}

/** Creates a Strapi-shaped `admin_users` row so the account works both for watchtower's own
 *  /admin login (see verifyAdminCredentials) and, if console's Strapi admin is ever used
 *  directly, as a genuine Strapi admin account — same bcrypt scheme, same required columns. */
export async function createAdminUser({ firstname, lastname, email, password }: CreateAdminUserInput) {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await prisma.admin_users.findFirst({ where: { email: normalizedEmail } });
  if (existing) throw new Error('An admin account with this email already exists');

  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date();

  return prisma.admin_users.create({
    data: {
      document_id: generateDocumentId(),
      firstname: firstname.trim(),
      lastname: lastname.trim(),
      email: normalizedEmail,
      username: normalizedEmail,
      password: passwordHash,
      is_active: true,
      blocked: false,
      created_at: now,
      updated_at: now,
      published_at: now,
    },
  });
}

export async function listAdminUsers() {
  return prisma.admin_users.findMany({
    orderBy: { email: 'asc' },
  });
}

export async function setAdminUserActive(userId: number, isActive: boolean) {
  return prisma.admin_users.update({
    where: { id: userId },
    data: { is_active: isActive, updated_at: new Date() },
  });
}

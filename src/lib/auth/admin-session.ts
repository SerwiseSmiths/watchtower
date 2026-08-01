import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/prisma';

export const SESSION_COOKIE_NAME = 'watchtower_session';

export interface AdminSessionPayload {
  sub: number;
  email: string;
}

function getSecret(): string {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) throw new Error('ADMIN_JWT_SECRET is not set');
  return secret;
}

export function signSession(payload: AdminSessionPayload): string {
  return jwt.sign(payload, getSecret(), { expiresIn: '7d' });
}

export function verifySession(token: string): AdminSessionPayload | null {
  try {
    return jwt.verify(token, getSecret()) as unknown as AdminSessionPayload;
  } catch {
    return null;
  }
}

export interface AdminUser {
  id: number;
  email: string;
  firstname: string | null;
  lastname: string | null;
}

/** Checks email/password against the existing `admin_users` table (bcrypt hashes carried over from console). */
export async function verifyAdminCredentials(email: string, password: string): Promise<AdminUser | null> {
  const user = await prisma.admin_users.findFirst({ where: { email, is_active: true, blocked: false } });
  if (!user?.password) return null;
  const matches = await bcrypt.compare(password, user.password);
  if (!matches) return null;
  return { id: user.id, email: user.email ?? email, firstname: user.firstname, lastname: user.lastname };
}

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  // Neon's serverless WebSocket adapter only works against a real Neon
  // endpoint; a plain local Postgres (e.g. the e2e stack's watchtower_e2e)
  // uses the standard engine. Every Neon-hosted environment keeps the adapter.
  const isNeon = /\.neon\.tech\b/.test(process.env.DATABASE_URL ?? '');
  if (!isNeon) return new PrismaClient();
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

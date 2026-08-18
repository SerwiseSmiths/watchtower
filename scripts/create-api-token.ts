// One-off helper to issue a new API token in the same `strapi_api_tokens` table
// Strapi uses, following its own conventions (random 128-hex-char accessKey,
// HMAC-SHA512+salt access_key hash for verification). Since the real
// API_TOKEN_SALT was lost (see PROGRESS.md), watchtower mints its own tokens
// under its own salt going forward.
//
// Usage: npx tsx scripts/create-api-token.ts <name> <read-only|full-access>
import { randomBytes } from 'crypto';
import { hashToken } from '../src/lib/auth/api-token';
import { prisma } from '../src/lib/db/prisma';

async function main() {
  const [name, type] = process.argv.slice(2);
  if (!name || !['read-only', 'full-access'].includes(type)) {
    console.error('Usage: npx tsx scripts/create-api-token.ts <name> <read-only|full-access>');
    process.exit(1);
  }
  const salt = process.env.API_TOKEN_SALT;
  if (!salt) throw new Error('API_TOKEN_SALT is not set in .env');

  const rawToken = randomBytes(128).toString('hex');
  const accessKey = hashToken(rawToken, salt);

  const row = await prisma.strapi_api_tokens.create({
    data: {
      document_id: randomBytes(12).toString('hex'),
      name,
      type,
      access_key: accessKey,
      lifespan: null,
      expires_at: null,
      created_at: new Date(),
      updated_at: new Date(),
      published_at: new Date(),
    },
  });

  console.log(`Created token "${name}" (id ${row.id}, type ${type}).`);
  console.log('Raw token (shown once — save it now):');
  console.log(rawToken);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});

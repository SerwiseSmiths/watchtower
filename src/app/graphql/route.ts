import { GraphQLError, type GraphQLSchema } from 'graphql';
import { createYoga } from 'graphql-yoga';
import type { NextRequest } from 'next/server';
import { authenticateApiToken } from '@/lib/auth/api-token';
import { ensureSchemaRegistry, getSchemaVersion } from '@/lib/content-schema/registry';
import { buildGraphQLSchema } from '@/lib/graphql/schema';

// Rebuilt whenever the content-type registry version changes (Content-Type Builder edits), so new
// types/fields show up in GraphQL without a redeploy.
let cached: { version: number; schema: GraphQLSchema } | null = null;

async function currentSchema(): Promise<GraphQLSchema> {
  await ensureSchemaRegistry();
  const version = getSchemaVersion();
  if (!cached || cached.version !== version) cached = { version, schema: buildGraphQLSchema() };
  return cached.schema;
}

const { handleRequest } = createYoga({
  schema: () => currentSchema(),
  graphqlEndpoint: '/graphql',
  async context({ request }: { request: Request }) {
    const auth = await authenticateApiToken(request.headers.get('authorization'));
    if (!auth.authenticated || !auth.token) {
      throw new GraphQLError(auth.error ?? 'Unauthorized', { extensions: { code: 'UNAUTHENTICATED' } });
    }
    return {};
  },
});

export function GET(request: NextRequest) {
  return handleRequest(request, { request });
}
export function POST(request: NextRequest) {
  return handleRequest(request, { request });
}
export function OPTIONS(request: NextRequest) {
  return handleRequest(request, { request });
}

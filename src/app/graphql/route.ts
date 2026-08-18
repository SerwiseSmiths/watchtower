import { GraphQLError } from 'graphql';
import { createYoga } from 'graphql-yoga';
import type { NextRequest } from 'next/server';
import { authenticateApiToken } from '@/lib/auth/api-token';
import { buildGraphQLSchema } from '@/lib/graphql/schema';

const schema = buildGraphQLSchema();

const { handleRequest } = createYoga({
  schema,
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

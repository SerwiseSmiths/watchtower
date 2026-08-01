import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiToken, authorizeApiToken, type RequiredScope } from '@/lib/auth/api-token';
import { getContentTypeByPluralName, getContentTypeBySingularName } from '@/lib/content-schema/registry';
import type { ContentTypeSchema } from '@/lib/content-schema/types';
import {
  createEntity,
  deleteEntity,
  findEntityByDocumentId,
  findSingleType,
  listEntities,
  publishEntity,
  unpublishEntity,
  updateEntity,
} from '@/lib/db/entity-repository';
import { parseQuery } from '@/lib/rest/query-parser';

export const dynamic = 'force-dynamic';

function errorResponse(status: number, name: string, message: string) {
  return NextResponse.json({ data: null, error: { status, name, message, details: {} } }, { status });
}

function resolveContentType(typeSegment: string): ContentTypeSchema | null {
  const collection = getContentTypeByPluralName(typeSegment);
  if (collection?.kind === 'collectionType') return collection;
  const single = getContentTypeBySingularName(typeSegment);
  if (single?.kind === 'singleType') return single;
  return null;
}

async function authorize(request: NextRequest, uid: string, scope: RequiredScope) {
  const auth = await authenticateApiToken(request.headers.get('authorization'));
  if (!auth.authenticated || !auth.token) {
    return errorResponse(401, 'UnauthorizedError', auth.error ?? 'Missing or invalid token');
  }
  const allowed = await authorizeApiToken(auth.token, uid, scope);
  if (!allowed) return errorResponse(403, 'ForbiddenError', 'Not authorized for this action');
  return null;
}

interface RouteContext {
  params: Promise<{ slug: string[] }>;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { slug } = await params;
  const [typeSegment, idSegment] = slug;
  const schema = resolveContentType(typeSegment);
  if (!schema) return errorResponse(404, 'NotFoundError', `Unknown content type "${typeSegment}"`);

  const query = parseQuery(schema, request.nextUrl.searchParams);

  if (schema.kind === 'singleType') {
    const denied = await authorize(request, schema.uid, 'findOne');
    if (denied) return denied;
    const data = await findSingleType(schema.uid, { status: query.status });
    return NextResponse.json({ data });
  }

  if (idSegment) {
    const denied = await authorize(request, schema.uid, 'findOne');
    if (denied) return denied;
    const data = await findEntityByDocumentId(schema.uid, idSegment, { status: query.status });
    if (!data) return errorResponse(404, 'NotFoundError', 'Entity not found');
    return NextResponse.json({ data });
  }

  const denied = await authorize(request, schema.uid, 'find');
  if (denied) return denied;
  const result = await listEntities(schema.uid, query);
  return NextResponse.json(result);
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { slug } = await params;
  const schema = resolveContentType(slug[0]);
  if (!schema) return errorResponse(404, 'NotFoundError', `Unknown content type "${slug[0]}"`);

  const actionIndex = slug.indexOf('actions');
  if (actionIndex !== -1) {
    const action = slug[actionIndex + 1];
    const documentId = schema.kind === 'collectionType' ? slug[1] : undefined;

    if (action !== 'publish' && action !== 'unpublish') {
      return errorResponse(404, 'NotFoundError', `Unknown action "${action}"`);
    }
    const denied = await authorize(request, schema.uid, action);
    if (denied) return denied;

    const existing =
      schema.kind === 'singleType' ? await findSingleType(schema.uid, { status: 'draft' }) : await findEntityByDocumentId(schema.uid, documentId!, { status: 'draft' });
    if (!existing) return errorResponse(404, 'NotFoundError', 'Draft entity not found');

    const data = action === 'publish' ? await publishEntity(schema.uid, existing.id as number) : (await unpublishEntity(schema.uid, existing.id as number), existing);
    return NextResponse.json({ data });
  }

  if (schema.kind !== 'collectionType') {
    return errorResponse(405, 'MethodNotAllowedError', 'Single types are created implicitly via PUT');
  }
  const denied = await authorize(request, schema.uid, 'create');
  if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  const data = await createEntity(schema.uid, body.data ?? body);
  return NextResponse.json({ data }, { status: 201 });
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const { slug } = await params;
  const [typeSegment, idSegment] = slug;
  const schema = resolveContentType(typeSegment);
  if (!schema) return errorResponse(404, 'NotFoundError', `Unknown content type "${typeSegment}"`);

  const denied = await authorize(request, schema.uid, 'update');
  if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  const payload = body.data ?? body;

  if (schema.kind === 'singleType') {
    const existing = await findSingleType(schema.uid, { status: 'draft' });
    if (!existing) {
      const created = await createEntity(schema.uid, payload);
      return NextResponse.json({ data: created }, { status: 201 });
    }
    const data = await updateEntity(schema.uid, existing.id as number, payload);
    return NextResponse.json({ data });
  }

  if (!idSegment) return errorResponse(400, 'BadRequestError', 'Missing documentId in URL');
  const existing = await findEntityByDocumentId(schema.uid, idSegment, { status: 'draft' });
  if (!existing) return errorResponse(404, 'NotFoundError', 'Entity not found');
  const data = await updateEntity(schema.uid, existing.id as number, payload);
  return NextResponse.json({ data });
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const { slug } = await params;
  const [typeSegment, idSegment] = slug;
  const schema = resolveContentType(typeSegment);
  if (!schema) return errorResponse(404, 'NotFoundError', `Unknown content type "${typeSegment}"`);

  const denied = await authorize(request, schema.uid, 'delete');
  if (denied) return denied;

  if (schema.kind === 'singleType') {
    const existing = await findSingleType(schema.uid, { status: 'draft' });
    if (!existing) return errorResponse(404, 'NotFoundError', 'Entity not found');
    await deleteEntity(schema.uid, existing.id as number);
    return NextResponse.json({ data: existing });
  }

  if (!idSegment) return errorResponse(400, 'BadRequestError', 'Missing documentId in URL');
  const existing = await findEntityByDocumentId(schema.uid, idSegment, { status: 'draft' });
  if (!existing) return errorResponse(404, 'NotFoundError', 'Entity not found');
  await deleteEntity(schema.uid, existing.id as number);
  return NextResponse.json({ data: existing });
}

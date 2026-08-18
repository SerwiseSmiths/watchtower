import { notFound, redirect } from 'next/navigation';
import { resolveContentTypeSlug, toColumnName } from '@/lib/content-schema/registry';
import { getPublishedDocumentIds, listEntities } from '@/lib/db/entity-repository';
import ListView from './ListView';

const SEARCHABLE_SCALAR_TYPES = new Set(['string', 'text', 'uid']);

export default async function ContentTypeListPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ page?: string; q?: string; sortField?: string; sortDir?: string }>;
}) {
  const { type } = await params;
  const schema = resolveContentTypeSlug(type);
  if (!schema) notFound();

  if (schema.kind === 'singleType') {
    redirect(`/admin/content-manager/${type}/edit`);
  }

  const { page: pageParam, q, sortField, sortDir } = await searchParams;
  const page = pageParam ? parseInt(pageParam, 10) || 1 : 1;

  let filters: Record<string, unknown> | undefined;
  if (q?.trim()) {
    const searchableColumns = Object.entries(schema.attributes)
      .filter(([, field]) => field.kind === 'scalar' && SEARCHABLE_SCALAR_TYPES.has(field.type))
      .map(([name]) => toColumnName(name));
    if (searchableColumns.length > 0) {
      filters = { OR: searchableColumns.map((column) => ({ [column]: { contains: q.trim(), mode: 'insensitive' } })) };
    }
  }

  // Always list the draft row — every document has exactly one, so this gives one row per document
  // (an unfiltered/published-default query would return both the draft and published row for the
  // same document as separate table rows). The real published/draft badge is computed below.
  const result = await listEntities(schema.uid, {
    page,
    pageSize: 20,
    filters,
    sortField: sortField || undefined,
    sortDir: sortDir === 'desc' ? 'desc' : 'asc',
    status: schema.draftAndPublish ? 'draft' : undefined,
  });

  const publishedIds = schema.draftAndPublish
    ? await getPublishedDocumentIds(
        schema.uid,
        result.data.map((row) => (row as { documentId: string }).documentId),
      )
    : new Set<string>();
  const data = result.data.map((row) => ({
    ...(row as Record<string, unknown>),
    isPublished: publishedIds.has((row as { documentId: string }).documentId),
  }));

  return (
    <ListView
      displayName={schema.displayName}
      slug={type}
      attributes={schema.attributes}
      draftAndPublish={schema.draftAndPublish}
      data={data as never}
      pagination={result.meta.pagination}
      query={q ?? ''}
      sortField={sortField ?? ''}
      sortDir={sortDir === 'desc' ? 'desc' : 'asc'}
    />
  );
}

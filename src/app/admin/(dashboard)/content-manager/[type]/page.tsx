import { notFound, redirect } from 'next/navigation';
import { resolveContentTypeSlug } from '@/lib/content-schema/registry';
import { listEntities } from '@/lib/db/entity-repository';
import ListView from './ListView';

export default async function ContentTypeListPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { type } = await params;
  const schema = resolveContentTypeSlug(type);
  if (!schema) notFound();

  if (schema.kind === 'singleType') {
    redirect(`/admin/content-manager/${type}/edit`);
  }

  const { page: pageParam } = await searchParams;
  const page = pageParam ? parseInt(pageParam, 10) || 1 : 1;
  const result = await listEntities(schema.uid, { page, pageSize: 20 });

  return (
    <ListView
      displayName={schema.displayName}
      slug={type}
      attributes={schema.attributes}
      draftAndPublish={schema.draftAndPublish}
      data={result.data as never}
      pagination={result.meta.pagination}
    />
  );
}

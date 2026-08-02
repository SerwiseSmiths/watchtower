import { notFound } from 'next/navigation';
import { allComponents, getContentType, resolveContentTypeSlug, slugForContentType } from '@/lib/content-schema/registry';
import { findEntityByDocumentId, findSingleType, listEntities } from '@/lib/db/entity-repository';
import { prisma } from '@/lib/db/prisma';
import type { ComponentDef, MediaLibraryFile, RelationOption } from './AttributeField';
import EntityForm from './EntityForm';

const LABEL_FIELD_CANDIDATES = ['name', 'label', 'title', 'key'];

function labelFor(row: Record<string, unknown>): string {
  for (const field of LABEL_FIELD_CANDIDATES) {
    if (typeof row[field] === 'string' && row[field]) return row[field] as string;
  }
  return String(row.documentId ?? row.id);
}

export default async function EntityEditPage({ params }: { params: Promise<{ type: string; id: string }> }) {
  const { type, id } = await params;
  const schema = resolveContentTypeSlug(type);
  if (!schema) notFound();

  let entity: Record<string, unknown> | null = null;
  if (schema.kind === 'singleType') {
    entity = await findSingleType(schema.uid, { status: 'draft' });
  } else if (id !== 'new') {
    entity = await findEntityByDocumentId(schema.uid, id, { status: 'draft' });
    if (!entity) notFound();
  }

  const relationOptions: Record<string, RelationOption[]> = {};
  for (const [name, field] of Object.entries(schema.attributes)) {
    if (field.kind !== 'relation') continue;
    const targetSlug = slugForContentType(getContentType(field.target));
    const targetList = await listEntities(field.target, { pageSize: 200 });
    relationOptions[name] = targetList.data.map((row) => ({
      id: row.id as number,
      documentId: row.documentId as string,
      label: labelFor(row as Record<string, unknown>),
      targetSlug,
    }));
  }

  const components: Record<string, ComponentDef> = {};
  for (const component of allComponents()) {
    components[component.uid] = { displayName: component.displayName, attributes: component.attributes };
  }

  const mediaFiles = await prisma.files.findMany({ orderBy: { created_at: 'desc' }, take: 200 });
  const mediaLibrary: MediaLibraryFile[] = mediaFiles.map((f) => ({
    id: f.id,
    url: f.url ?? '',
    name: f.name ?? '',
    mime: f.mime ?? '',
    alternativeText: f.alternative_text ?? null,
  }));

  return (
    <EntityForm
      slug={type}
      id={schema.kind === 'singleType' ? 'edit' : id}
      displayName={schema.displayName}
      attributes={schema.attributes}
      draftAndPublish={schema.draftAndPublish}
      entity={entity}
      components={components}
      relationOptions={relationOptions}
      mediaLibrary={mediaLibrary}
    />
  );
}

import { notFound } from 'next/navigation';
import { allComponents, resolveContentTypeSlug } from '@/lib/content-schema/registry';
import { findEntityByDocumentId, findSingleType, listEntities } from '@/lib/db/entity-repository';
import type { ComponentDef, RelationOption } from './AttributeField';
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
    const targetList = await listEntities(field.target, { pageSize: 200 });
    relationOptions[name] = targetList.data.map((row) => ({
      id: row.id as number,
      label: labelFor(row as Record<string, unknown>),
    }));
  }

  const components: Record<string, ComponentDef> = {};
  for (const component of allComponents()) {
    components[component.uid] = { displayName: component.displayName, attributes: component.attributes };
  }

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
    />
  );
}

import { isSchemaEditingEnabled } from '@/lib/content-schema/apply';
import type { RawAttribute } from '@/lib/content-schema/loader';
import { ensureSchemaRegistry, getRegistrySnapshot } from '@/lib/content-schema/registry';
import { contentTypeUid } from '@/lib/content-schema/store';
import { isCmsContentType, protectedComponentUids } from '../content-types';
import ContentTypeBuilderView, { type BuilderComponent, type BuilderType } from './ContentTypeBuilderView';

export default async function ContentTypeBuilderPage({ searchParams }: { searchParams: Promise<{ uid?: string }> }) {
  const { uid } = await searchParams;
  await ensureSchemaRegistry({ force: true });
  const snapshot = getRegistrySnapshot();
  const locked = protectedComponentUids(snapshot);

  const types: BuilderType[] = snapshot.contentTypes
    .filter((raw) => isCmsContentType(contentTypeUid(raw)))
    .map((raw) => ({
      uid: contentTypeUid(raw),
      kind: raw.kind ?? 'collectionType',
      displayName: raw.info.displayName,
      singularName: raw.info.singularName,
      pluralName: raw.info.pluralName,
      description: raw.info.description ?? '',
      draftAndPublish: !!raw.options?.draftAndPublish,
      attributes: raw.attributes as Record<string, RawAttribute>,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  // Components owned by core types (pricing) are managed in code and hidden here.
  const components: BuilderComponent[] = snapshot.components
    .filter((c) => !locked.has(c.uid))
    .map((c) => ({
      uid: c.uid,
      category: c.uid.split('.')[0],
      displayName: c.schema.info.displayName,
      description: c.schema.info.description ?? '',
      attributes: c.schema.attributes as Record<string, RawAttribute>,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  const relationTargets = snapshot.contentTypes
    .filter((raw) => (raw.kind ?? 'collectionType') === 'collectionType')
    .map((raw) => ({ uid: contentTypeUid(raw), displayName: raw.info.displayName }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  const editingEnabled = isSchemaEditingEnabled() && snapshot.source === 'db';
  const disabledReason = !isSchemaEditingEnabled()
    ? 'Schema changes are made on the dev environment, then copied here with `yarn cms:sync-schema`. You can still edit content in the Content Manager.'
    : 'The schema registry tables are missing on this database — apply prisma/manual-migrations/0004_cms_schema_registry.sql.';

  return (
    <ContentTypeBuilderView
      types={types}
      components={components}
      relationTargets={relationTargets}
      selectedUid={uid ?? null}
      editingEnabled={editingEnabled}
      disabledReason={editingEnabled ? null : disabledReason}
    />
  );
}

'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Badge,
  Box,
  Button,
  Checkbox,
  Dialog,
  EmptyStateLayout,
  Field,
  Flex,
  IconButton,
  Modal,
  SingleSelect,
  SingleSelectOption,
  SubNav,
  SubNavHeader,
  SubNavLink,
  SubNavLinkSection,
  SubNavSection,
  SubNavSections,
  TextButton,
  TextInput,
  Toggle,
  Typography,
} from '@strapi/design-system';
import { Cross, Pencil, Plus, Trash, WarningCircle } from '@strapi/icons';
import { ComponentField } from '@strapi/icons/symbols';
import type { RawAttribute } from '@/lib/content-schema/loader';
import PageHeader from '../PageHeader';
import { applySchemaEditAction, previewSchemaEditAction, type SchemaEdit } from './actions';
import FieldEditorModal from './FieldEditorModal';
import { describeAttribute, fieldIcon, pluralizeApiId, toApiId } from './field-types';

export interface BuilderType {
  uid: string;
  kind: 'collectionType' | 'singleType';
  displayName: string;
  singularName: string;
  pluralName: string;
  description: string;
  draftAndPublish: boolean;
  attributes: Record<string, RawAttribute>;
}

export interface BuilderComponent {
  uid: string;
  category: string;
  displayName: string;
  description: string;
  attributes: Record<string, RawAttribute>;
}

interface Draft {
  displayName: string;
  description: string;
  attributes: Record<string, RawAttribute>;
}

/** A type or component whose fields can be listed/edited. */
interface Owner {
  key: string;
  kind: 'type' | 'component';
  label: string;
  isSaved: boolean;
  draft: Draft;
  savedAttributes: Record<string, RawAttribute>;
}

interface PendingChange {
  edits: SchemaEdit[];
  isDelete: boolean;
  changes: { description: string; destructive: boolean }[];
}

export interface ContentTypeBuilderViewProps {
  types: BuilderType[];
  components: BuilderComponent[];
  /** Every content type a relation may point at (CMS + core), for the relation target picker. */
  relationTargets: { uid: string; displayName: string }[];
  selectedUid: string | null;
  editingEnabled: boolean;
  disabledReason: string | null;
}

const href = (uid: string) => `/cms/content-type-builder?uid=${encodeURIComponent(uid)}`;

function omit<T>(record: Record<string, T>, key: string): Record<string, T> {
  const next = { ...record };
  delete next[key];
  return next;
}

// Strapi's nested-list rail: component fields are indented ~104px with a 4px bar at 7rem.
const NESTED_INDENT = '10.4rem';

export default function ContentTypeBuilderView({ types, components, relationTargets, selectedUid, editingEnabled, disabledReason }: ContentTypeBuilderViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // New, not-yet-saved types/components and unsaved field edits live only here until Save. Drafts are
  // keyed by type/component uid, so a component edited inline from a type's page is saved with it.
  const [newTypes, setNewTypes] = useState<BuilderType[]>([]);
  const [newComponents, setNewComponents] = useState<BuilderComponent[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  const [fieldModal, setFieldModal] = useState<{ ownerKey: string; editing?: { name: string; attr: RawAttribute; isSaved: boolean } } | null>(null);
  const [createModal, setCreateModal] = useState<{ mode: 'collectionType' | 'singleType' | 'component'; addToZone?: { ownerKey: string; field: string } } | null>(null);
  const [zonePicker, setZonePicker] = useState<{ ownerKey: string; field: string } | null>(null);
  const [activeZoneTab, setActiveZoneTab] = useState<Record<string, number>>({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  // Selection made locally (e.g. right after "Create") that wins until the URL catches up, so the
  // first field never lands on the previously selected type while navigation is in flight.
  const [localSelection, setLocalSelection] = useState<{ uid: string; fromUrlUid: string | null } | null>(null);
  const effectiveUid = localSelection && localSelection.fromUrlUid === selectedUid ? localSelection.uid : selectedUid;

  const allTypes = useMemo(() => [...types, ...newTypes.filter((n) => !types.some((t) => t.uid === n.uid))], [types, newTypes]);
  const allComponents = useMemo(() => [...components, ...newComponents.filter((n) => !components.some((c) => c.uid === n.uid))], [components, newComponents]);

  function ownerFor(key: string): Owner | null {
    const type = allTypes.find((t) => t.uid === key);
    const component = type ? undefined : allComponents.find((c) => c.uid === key);
    const base = type ?? component;
    if (!base) return null;
    const saved = type ? types.find((t) => t.uid === key) : components.find((c) => c.uid === key);
    return {
      key,
      kind: type ? 'type' : 'component',
      label: base.displayName,
      isSaved: !!saved,
      draft: drafts[key] ?? { displayName: base.displayName, description: base.description, attributes: base.attributes },
      savedAttributes: saved?.attributes ?? {},
    };
  }

  const selectedKey =
    effectiveUid && (allTypes.some((t) => t.uid === effectiveUid) || allComponents.some((c) => c.uid === effectiveUid)) ? effectiveUid : allTypes[0]?.uid ?? null;
  const selected = selectedKey ? ownerFor(selectedKey) : null;
  const selectedType = allTypes.find((t) => t.uid === selectedKey);
  const selectedComponent = allComponents.find((c) => c.uid === selectedKey);

  const dirtyKeys = [...new Set([...Object.keys(drafts), ...newTypes.map((t) => t.uid), ...newComponents.map((c) => c.uid)])];
  const dirty = dirtyKeys.length > 0;

  const nameFor = (uid: string) =>
    relationTargets.find((t) => t.uid === uid)?.displayName ?? allTypes.find((t) => t.uid === uid)?.displayName ?? allComponents.find((c) => c.uid === uid)?.displayName ?? uid;

  function patchDraft(key: string, patch: Partial<Draft>) {
    const owner = ownerFor(key);
    if (!owner) return;
    setDrafts((prev) => ({ ...prev, [key]: { ...owner.draft, ...patch } }));
  }

  function setAttribute(key: string, name: string, attr: RawAttribute | null, previousName?: string) {
    const owner = ownerFor(key);
    if (!owner) return;
    let next = { ...owner.draft.attributes };
    if (previousName && previousName !== name) next = omit(next, previousName);
    if (attr) next[name] = attr;
    else next = omit(next, name);
    patchDraft(key, { attributes: next });
  }

  function discardAll() {
    setDrafts({});
    setNewTypes([]);
    setNewComponents([]);
    if (selectedKey && !types.some((t) => t.uid === selectedKey) && !components.some((c) => c.uid === selectedKey)) router.push('/cms/content-type-builder');
  }

  function buildSaveEdits(): SchemaEdit[] {
    const edits: SchemaEdit[] = [];
    for (const key of dirtyKeys) {
      const owner = ownerFor(key);
      if (!owner) continue;
      const type = allTypes.find((t) => t.uid === key);
      if (type) {
        edits.push({
          kind: 'saveContentType',
          isNew: !owner.isSaved,
          schema: {
            kind: type.kind,
            collectionName: '',
            info: { singularName: type.singularName, pluralName: type.pluralName, displayName: owner.draft.displayName, description: owner.draft.description || undefined },
            options: { draftAndPublish: type.draftAndPublish },
            attributes: owner.draft.attributes,
          },
        });
      } else {
        edits.push({
          kind: 'saveComponent',
          isNew: !owner.isSaved,
          uid: key,
          schema: { collectionName: '', info: { displayName: owner.draft.displayName, description: owner.draft.description || undefined }, attributes: owner.draft.attributes },
        });
      }
    }
    return edits;
  }

  function preview(edits: SchemaEdit[], isDelete = false) {
    setError(null);
    for (const e of edits) {
      if ((e.kind === 'saveContentType' || e.kind === 'saveComponent') && Object.keys(e.schema.attributes).length === 0) {
        return setError(`${e.schema.info.displayName} has no fields yet — add at least one before saving.`);
      }
    }
    startTransition(async () => {
      const result = await previewSchemaEditAction(edits);
      if (!result.ok) return setError(result.error);
      setPending({ edits, isDelete, changes: result.changes });
    });
  }

  function confirmApply() {
    if (!pending) return;
    const { edits, isDelete } = pending;
    startTransition(async () => {
      const result = await applySchemaEditAction(edits);
      if (!result.ok) {
        setPending(null);
        return setError(result.error);
      }
      if (isDelete) {
        const removed = edits.flatMap((e) => (e.kind === 'deleteContentType' || e.kind === 'deleteComponent' ? [e.uid] : []));
        setDrafts((prev) => removed.reduce((acc, uid) => omit(acc, uid), prev));
        router.push('/cms/content-type-builder');
      } else {
        setDrafts({});
        setNewTypes([]);
        setNewComponents([]);
      }
      setPending(null);
      setSettingsOpen(false);
      router.refresh();
    });
  }

  // ─── Field list — recursive for components / dynamic zones (Strapi's List + ComponentList) ─────

  function renderFieldRows(ownerKey: string, nested: boolean, fromZone: boolean, ancestors: string[]): React.ReactNode {
    const owner = ownerFor(ownerKey);
    if (!owner) {
      return (
        <Box padding={4}>
          <Typography variant="pi" textColor="neutral600">
            This component is managed in code (it belongs to core data).
          </Typography>
        </Box>
      );
    }
    return Object.entries(owner.draft.attributes).map(([name, attr]) => {
      const Icon = fieldIcon(attr);
      const isSaved = name in owner.savedAttributes;
      return (
        <Box key={name}>
          <Flex
            paddingTop={3}
            paddingBottom={3}
            paddingLeft={nested ? 4 : 6}
            paddingRight={4}
            gap={4}
            borderColor="neutral150"
            style={{ borderTopWidth: 1, borderTopStyle: 'solid' }}
          >
            <Flex gap={3} alignItems="center" style={{ width: '35%', minWidth: 0 }}>
              <Icon width="3.2rem" height="2.4rem" />
              <Typography fontWeight="bold" ellipsis>
                {name}
              </Typography>
              {attr.required && <Badge>required</Badge>}
              {!isSaved && owner.isSaved && <Badge active>new</Badge>}
            </Flex>
            <Box flex={1} style={{ minWidth: 0 }}>
              <Typography textColor="neutral700">{describeAttribute(attr, nameFor)}</Typography>
            </Box>
            {editingEnabled && (
              <Flex gap={1}>
                <IconButton label={`Edit ${name}`} variant="ghost" onClick={() => setFieldModal({ ownerKey, editing: { name, attr, isSaved } })}>
                  <Pencil />
                </IconButton>
                <IconButton label={`Delete ${name}`} variant="ghost" onClick={() => setAttribute(ownerKey, name, null)}>
                  <Trash />
                </IconButton>
              </Flex>
            )}
          </Flex>

          {attr.type === 'component' && attr.component && !ancestors.includes(attr.component) && renderNestedComponent(attr.component, fromZone, [...ancestors, ownerKey])}
          {attr.type === 'dynamiczone' && renderDynamicZone(ownerKey, name, attr.components ?? [], [...ancestors, ownerKey])}
        </Box>
      );
    });
  }

  function renderNestedComponent(uid: string, fromZone: boolean, ancestors: string[]) {
    const owner = ownerFor(uid);
    return (
      <Box position="relative" paddingLeft={NESTED_INDENT} paddingRight={4} paddingBottom={3}>
        <Box position="absolute" top={0} bottom={3} left="7rem" width="0.4rem" hasRadius background={fromZone ? 'primary200' : 'neutral150'} />
        <Box hasRadius borderColor={fromZone ? 'primary200' : 'neutral150'} background="neutral0" style={{ borderWidth: 1, borderStyle: 'solid', overflow: 'hidden' }}>
          <Flex paddingLeft={4} paddingRight={4} paddingTop={2} paddingBottom={2} gap={2} background={fromZone ? 'primary100' : 'neutral100'}>
            <Typography variant="pi" fontWeight="bold" textColor={fromZone ? 'primary600' : 'neutral700'}>
              {owner?.draft.displayName ?? uid}
            </Typography>
            <Typography variant="pi" textColor="neutral500">
              {uid}
            </Typography>
            {owner && (
              <Box marginLeft="auto">
                <TextButton onClick={() => router.push(href(uid))}>Open component</TextButton>
              </Box>
            )}
          </Flex>
          {renderFieldRows(uid, true, fromZone, ancestors)}
          {editingEnabled && owner && (
            <Box paddingLeft={4} paddingTop={3} paddingBottom={3} borderColor="neutral150" style={{ borderTopWidth: 1, borderTopStyle: 'solid' }}>
              <TextButton startIcon={<Plus />} onClick={() => setFieldModal({ ownerKey: uid })}>
                Add another field to this component
              </TextButton>
            </Box>
          )}
        </Box>
      </Box>
    );
  }

  function renderDynamicZone(ownerKey: string, field: string, uids: string[], ancestors: string[]) {
    const tabKey = `${ownerKey}.${field}`;
    const active = Math.min(activeZoneTab[tabKey] ?? 0, Math.max(uids.length - 1, 0));
    const removeFromZone = (uid: string) => {
      const attr = ownerFor(ownerKey)?.draft.attributes[field];
      if (attr) setAttribute(ownerKey, field, { ...attr, components: (attr.components ?? []).filter((c) => c !== uid) });
    };
    return (
      <Box paddingBottom={3}>
        <Flex paddingLeft={NESTED_INDENT} paddingRight={4} paddingBottom={3} gap={2} wrap="wrap" role="tablist">
          {editingEnabled && (
            <ZoneCard onClick={() => setZonePicker({ ownerKey, field })}>
              <Flex width="3.2rem" height="3.2rem" justifyContent="center" alignItems="center" background="primary100" style={{ borderRadius: '6.4rem' }}>
                <Plus fill="primary600" />
              </Flex>
              <Typography variant="pi" fontWeight="bold" textColor="primary600">
                Add a component
              </Typography>
            </ZoneCard>
          )}
          {uids.map((uid, index) => (
            <ZoneCard key={uid} active={index === active} onClick={() => setActiveZoneTab((prev) => ({ ...prev, [tabKey]: index }))}>
              <ComponentField width="3.2rem" height="3.2rem" />
              <Typography variant="pi" fontWeight="bold" textColor={index === active ? 'primary600' : 'neutral600'} ellipsis style={{ maxWidth: '12rem' }}>
                {nameFor(uid)}
              </Typography>
              {editingEnabled && (
                <Box
                  position="absolute"
                  top={1}
                  right={1}
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    removeFromZone(uid);
                  }}
                >
                  <IconButton label={`Remove ${nameFor(uid)} from ${field}`} variant="ghost" size="XS">
                    <Cross />
                  </IconButton>
                </Box>
              )}
            </ZoneCard>
          ))}
        </Flex>
        {uids[active] && !ancestors.includes(uids[active]) && renderNestedComponent(uids[active], true, ancestors)}
      </Box>
    );
  }

  const q = search.trim().toLowerCase();
  const matches = (label: string) => !q || label.toLowerCase().includes(q);
  const navItem = (uid: string, label: string, isNew: boolean) => (
    <SubNavLink key={uid} href={href(uid)} active={uid === selectedKey}>
      {label}
      {(isNew || drafts[uid]) && ' •'}
    </SubNavLink>
  );
  const collectionTypes = allTypes.filter((t) => t.kind === 'collectionType' && matches(t.displayName));
  const singleTypes = allTypes.filter((t) => t.kind === 'singleType' && matches(t.displayName));
  const visibleComponents = allComponents.filter((c) => matches(c.displayName) || matches(c.category));
  const categories = [...new Set(visibleComponents.map((c) => c.category))].sort();
  const isNewType = (uid: string) => !types.some((x) => x.uid === uid);
  const isNewComponent = (uid: string) => !components.some((x) => x.uid === uid);

  // Strapi's "+ Create new …" link under each menu section.
  const createLink = (mode: 'collectionType' | 'singleType' | 'component', label: string) =>
    editingEnabled && (
      <Box paddingLeft={7} paddingTop={2} paddingBottom={1}>
        <TextButton startIcon={<Plus />} onClick={() => setCreateModal({ mode })}>
          {label}
        </TextButton>
      </Box>
    );

  const ownerKindLabel = selectedComponent ? 'component' : selectedType?.kind === 'singleType' ? 'single type' : 'collection type';
  const fieldModalOwner = fieldModal ? ownerFor(fieldModal.ownerKey) : null;
  const zoneOwnerAttr = zonePicker ? ownerFor(zonePicker.ownerKey)?.draft.attributes[zonePicker.field] : undefined;

  return (
    // Full-height two-pane layout like Strapi's builder: the menu is a fixed white panel with its own
    // scroll, and only the right-hand content scrolls.
    <Flex alignItems="stretch" height="100vh">
      <SubNav aria-label="Content-Type Builder navigation" style={{ width: '23.2rem', height: '100vh', overflowY: 'auto', flexShrink: 0 }}>
        <SubNavHeader
          label="Content-Type Builder"
          searchable
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          onClear={() => setSearch('')}
          onSubmit={(e: React.FormEvent) => e.preventDefault()}
          searchLabel="Search"
          placeholder="Search…"
        />
        <SubNavSections>
          <SubNavSection label="Collection types" collapsable badgeLabel={String(collectionTypes.length)}>
            {collectionTypes.map((t) => navItem(t.uid, t.displayName, isNewType(t.uid)))}
            {createLink('collectionType', 'Create new collection type')}
          </SubNavSection>
          <SubNavSection label="Single types" collapsable badgeLabel={String(singleTypes.length)}>
            {singleTypes.map((t) => navItem(t.uid, t.displayName, isNewType(t.uid)))}
            {createLink('singleType', 'Create new single type')}
          </SubNavSection>
          <SubNavSection label="Components" collapsable badgeLabel={String(visibleComponents.length)}>
            {categories.map((category) => (
              <SubNavLinkSection key={category} label={category}>
                {visibleComponents.filter((c) => c.category === category).map((c) => navItem(c.uid, c.displayName, isNewComponent(c.uid)))}
              </SubNavLinkSection>
            ))}
            {createLink('component', 'Create new component')}
          </SubNavSection>
        </SubNavSections>
        {/* Room below the last link so it never sits flush against the window edge. */}
        <Box paddingBottom={10} />
      </SubNav>

      <Box flex={1} padding={8} height="100vh" background="neutral100" style={{ overflowY: 'auto', minWidth: 0 }}>
        {!editingEnabled && (
          <Box paddingBottom={4}>
            <Alert variant="default" title="View only" closeLabel="Close" onClose={() => undefined}>
              {disabledReason}
            </Alert>
          </Box>
        )}
        {error && (
          <Box paddingBottom={4}>
            <Alert variant="danger" title="Could not save" closeLabel="Close" onClose={() => setError(null)}>
              {error}
            </Alert>
          </Box>
        )}

        {!selected ? (
          <EmptyStateLayout content="No content types yet" />
        ) : (
          <>
            <PageHeader
              title={selected.draft.displayName}
              subtitle={selected.draft.description || (selectedType ? `API ID: ${selectedType.singularName} · ${selectedType.pluralName}` : selected.key)}
              status={<Badge>{selectedComponent ? 'Component' : selectedType?.kind === 'singleType' ? 'Single type' : 'Collection type'}</Badge>}
              secondaryActions={
                editingEnabled && (
                  <>
                    {dirty && (
                      <Button variant="tertiary" onClick={discardAll} disabled={isPending}>
                        Discard changes
                      </Button>
                    )}
                    <Button variant="secondary" startIcon={<Pencil />} onClick={() => setSettingsOpen(true)}>
                      Edit
                    </Button>
                  </>
                )
              }
              primaryAction={
                editingEnabled && (
                  <Button onClick={() => preview(buildSaveEdits())} disabled={!dirty} loading={isPending && !pending}>
                    Save
                  </Button>
                )
              }
            />

            <Box background="neutral0" hasRadius shadow="tableShadow">
              {Object.keys(selected.draft.attributes).length === 0 ? (
                <Box padding={8}>
                  <EmptyStateLayout
                    content={`Add your first field to this ${ownerKindLabel}`}
                    action={
                      editingEnabled && (
                        <Button variant="secondary" startIcon={<Plus />} onClick={() => setFieldModal({ ownerKey: selected.key })}>
                          Add new field
                        </Button>
                      )
                    }
                  />
                </Box>
              ) : (
                <>
                  <Flex paddingLeft={6} paddingRight={4} paddingTop={4} paddingBottom={3} gap={4}>
                    <Box style={{ width: '35%' }}>
                      <Typography variant="sigma" textColor="neutral600">
                        Name
                      </Typography>
                    </Box>
                    <Typography variant="sigma" textColor="neutral600">
                      Type
                    </Typography>
                  </Flex>
                  {renderFieldRows(selected.key, false, false, [])}
                  {editingEnabled && (
                    <Box padding={3} paddingLeft={6} borderColor="neutral150" style={{ borderTopWidth: 1, borderTopStyle: 'solid' }}>
                      <TextButton startIcon={<Plus />} onClick={() => setFieldModal({ ownerKey: selected.key })}>
                        Add another field to this {ownerKindLabel}
                      </TextButton>
                    </Box>
                  )}
                </>
              )}
            </Box>
            {dirty && (
              <Box paddingTop={3}>
                <Typography variant="pi" textColor="neutral600">
                  Unsaved changes in {dirtyKeys.map(nameFor).join(', ')} — Save applies them all together.
                </Typography>
              </Box>
            )}
          </>
        )}
      </Box>

      {fieldModal && fieldModalOwner && (
        <FieldEditorModal
          ownerLabel={fieldModalOwner.draft.displayName}
          ownerIsComponent={fieldModalOwner.kind === 'component'}
          editing={fieldModal.editing}
          takenNames={Object.keys(fieldModalOwner.draft.attributes)}
          contentTypeOptions={relationTargets}
          componentOptions={allComponents.filter((c) => c.uid !== fieldModal.ownerKey).map((c) => ({ uid: c.uid, displayName: c.displayName }))}
          stringFieldNames={Object.entries(fieldModalOwner.draft.attributes).filter(([, a]) => a.type === 'string').map(([n]) => n)}
          onClose={() => setFieldModal(null)}
          onSubmit={(name, attr, addAnother) => {
            setAttribute(fieldModal.ownerKey, name, attr, fieldModal.editing?.name);
            if (!addAnother) setFieldModal(null);
          }}
        />
      )}

      {zonePicker && zoneOwnerAttr && (
        <ZonePickerModal
          field={zonePicker.field}
          current={zoneOwnerAttr.components ?? []}
          options={allComponents.filter((c) => c.uid !== zonePicker.ownerKey)}
          onClose={() => setZonePicker(null)}
          onCreateNew={() => {
            setCreateModal({ mode: 'component', addToZone: zonePicker });
            setZonePicker(null);
          }}
          onAdd={(uids) => {
            setAttribute(zonePicker.ownerKey, zonePicker.field, { ...zoneOwnerAttr, components: [...(zoneOwnerAttr.components ?? []), ...uids] });
            setZonePicker(null);
          }}
        />
      )}

      {createModal && (
        <CreateModal
          mode={createModal.mode}
          existingTypes={allTypes}
          existingComponents={allComponents}
          onClose={() => setCreateModal(null)}
          onCreate={(created) => {
            const target = createModal.addToZone;
            setCreateModal(null);
            if (created.kind === 'type') setNewTypes((prev) => [...prev, created.type]);
            else setNewComponents((prev) => [...prev, created.component]);
            const uid = created.kind === 'type' ? created.type.uid : created.component.uid;
            if (target) {
              // Created from a dynamic zone: add it there, stay on this page, and open its first field.
              const attr = ownerFor(target.ownerKey)?.draft.attributes[target.field];
              if (attr) setAttribute(target.ownerKey, target.field, { ...attr, components: [...(attr.components ?? []), uid] });
              setActiveZoneTab((prev) => ({ ...prev, [`${target.ownerKey}.${target.field}`]: (attr?.components ?? []).length }));
              setFieldModal({ ownerKey: uid });
              return;
            }
            setLocalSelection({ uid, fromUrlUid: selectedUid });
            router.push(href(uid));
            setFieldModal({ ownerKey: uid });
          }}
        />
      )}

      {settingsOpen && selected && (
        <SettingsModal
          title={`Edit ${selected.draft.displayName}`}
          draft={selected.draft}
          isSaved={selected.isSaved}
          onClose={() => setSettingsOpen(false)}
          onApply={(patch) => {
            patchDraft(selected.key, patch);
            setSettingsOpen(false);
          }}
          onDelete={() => {
            if (!selected.isSaved) {
              setSettingsOpen(false);
              setDrafts((prev) => omit(prev, selected.key));
              setNewTypes((prev) => prev.filter((t) => t.uid !== selected.key));
              setNewComponents((prev) => prev.filter((c) => c.uid !== selected.key));
              return router.push('/cms/content-type-builder');
            }
            preview([selected.kind === 'type' ? { kind: 'deleteContentType', uid: selected.key } : { kind: 'deleteComponent', uid: selected.key }], true);
          }}
        />
      )}

      {pending && (
        <Dialog.Root open onOpenChange={(open: boolean) => !open && setPending(null)}>
          <Dialog.Content>
            <Dialog.Header>{pending.changes.some((c) => c.destructive) ? 'Confirm — this deletes data' : 'Apply these changes?'}</Dialog.Header>
            <Dialog.Body icon={pending.changes.some((c) => c.destructive) ? <WarningCircle fill="danger600" /> : undefined}>
              <Flex direction="column" alignItems="stretch" gap={2}>
                {pending.changes.length === 0 && <Typography>No database changes needed — only settings are updated.</Typography>}
                {pending.changes.map((c, i) => (
                  <Typography key={i} textColor={c.destructive ? 'danger600' : 'neutral800'} fontWeight={c.destructive ? 'bold' : 'regular'}>
                    {c.destructive ? '⚠ ' : '• '}
                    {c.description}
                  </Typography>
                ))}
                {pending.changes.some((c) => c.destructive) && (
                  <Typography variant="pi" textColor="neutral600">
                    Deleted data can’t be recovered.
                  </Typography>
                )}
              </Flex>
            </Dialog.Body>
            <Dialog.Footer>
              <Dialog.Cancel>
                <Button variant="tertiary">Cancel</Button>
              </Dialog.Cancel>
              <Button variant={pending.changes.some((c) => c.destructive) ? 'danger' : 'default'} onClick={confirmApply} loading={isPending}>
                {pending.changes.some((c) => c.destructive) ? 'Delete and apply' : 'Apply'}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Root>
      )}
    </Flex>
  );
}

// ─── Dynamic zone pieces ────────────────────────────────────────────────────────────────────────

/** Strapi's dynamic-zone component card (140×80, highlighted when its fields are shown below). */
function ZoneCard({ active = false, onClick, children }: { active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    // A div with button semantics (not <button>) so the card can hold its own remove button.
    <Flex
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      position="relative"
      direction="column"
      justifyContent="center"
      alignItems="center"
      gap={1}
      width="14rem"
      height="8rem"
      hasRadius
      background={active ? 'primary100' : 'neutral0'}
      borderColor={active ? 'primary600' : 'neutral200'}
      style={{ borderWidth: 1, borderStyle: 'solid', cursor: 'pointer', flexShrink: 0 }}
    >
      {children}
    </Flex>
  );
}

function ZonePickerModal({
  field,
  current,
  options,
  onClose,
  onAdd,
  onCreateNew,
}: {
  field: string;
  current: string[];
  options: BuilderComponent[];
  onClose: () => void;
  onAdd: (uids: string[]) => void;
  onCreateNew: () => void;
}) {
  const available = options.filter((c) => !current.includes(c.uid));
  const [picked, setPicked] = useState<string[]>([]);
  return (
    <Modal.Root open onOpenChange={(open: boolean) => !open && onClose()}>
      <Modal.Content>
        <Modal.Header>
          <Modal.Title>Add components to “{field}”</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Flex direction="column" alignItems="stretch" gap={3}>
            {available.length === 0 && <Typography textColor="neutral600">Every existing component is already in this zone.</Typography>}
            {available.map((c) => (
              <Checkbox
                key={c.uid}
                checked={picked.includes(c.uid)}
                onCheckedChange={(checked) => setPicked((prev) => (checked ? [...prev, c.uid] : prev.filter((u) => u !== c.uid)))}
              >
                {c.displayName} <Typography textColor="neutral500">({c.uid})</Typography>
              </Checkbox>
            ))}
            <Box paddingTop={2}>
              <TextButton startIcon={<Plus />} onClick={onCreateNew}>
                Create a new component instead
              </TextButton>
            </Box>
          </Flex>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="tertiary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={picked.length === 0} onClick={() => onAdd(picked)}>
            {picked.length > 1 ? `Add ${picked.length} components` : 'Add component'}
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  );
}

// ─── Create type / component ────────────────────────────────────────────────────────────────────

function CreateModal({
  mode,
  existingTypes,
  existingComponents,
  onClose,
  onCreate,
}: {
  mode: 'collectionType' | 'singleType' | 'component';
  existingTypes: BuilderType[];
  existingComponents: BuilderComponent[];
  onClose: () => void;
  onCreate: (created: { kind: 'type'; type: BuilderType } | { kind: 'component'; component: BuilderComponent }) => void;
}) {
  const [displayName, setDisplayName] = useState('');
  const [singular, setSingular] = useState('');
  const [plural, setPlural] = useState('');
  const [apiIdsTouched, setApiIdsTouched] = useState(false);
  const [draftAndPublish, setDraftAndPublish] = useState(true);
  const categories = [...new Set(existingComponents.map((c) => c.category))].sort();
  const [category, setCategory] = useState(categories.includes('blocks') ? 'blocks' : categories[0] ?? '');
  const [newCategory, setNewCategory] = useState('');
  const [error, setError] = useState<string | null>(null);

  function onNameChange(value: string) {
    setDisplayName(value);
    if (!apiIdsTouched) {
      const id = toApiId(value);
      setSingular(id);
      setPlural(id ? pluralizeApiId(id) : '');
    }
  }

  function submit() {
    setError(null);
    if (!displayName.trim()) return setError('Display name is required');
    if (mode === 'component') {
      const cat = toApiId(category === '__new' ? newCategory : category);
      const name = toApiId(displayName);
      if (!cat) return setError('Choose or enter a category');
      const uid = `${cat}.${name}`;
      if (existingComponents.some((c) => c.uid === uid)) return setError(`The component ${uid} already exists`);
      return onCreate({ kind: 'component', component: { uid, category: cat, displayName: displayName.trim(), description: '', attributes: {} } });
    }
    if (!/^[a-z][a-z0-9-]*$/.test(singular) || !/^[a-z][a-z0-9-]*$/.test(plural)) return setError('API IDs: lowercase letters, digits and dashes, starting with a letter');
    if (singular === plural) return setError('Singular and plural API IDs must differ');
    const taken = existingTypes.flatMap((t) => [t.singularName, t.pluralName]);
    if (taken.includes(singular) || taken.includes(plural)) return setError('That API ID is already used by another content type');
    onCreate({
      kind: 'type',
      type: {
        uid: `api::${singular}.${singular}`,
        kind: mode,
        displayName: displayName.trim(),
        singularName: singular,
        pluralName: plural,
        description: '',
        draftAndPublish,
        attributes: {},
      },
    });
  }

  const title = mode === 'component' ? 'Create a component' : mode === 'singleType' ? 'Create a single type' : 'Create a collection type';

  return (
    <Modal.Root open onOpenChange={(open: boolean) => !open && onClose()}>
      <Modal.Content>
        <Modal.Header>
          <Modal.Title>{title}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Flex direction="column" alignItems="stretch" gap={4}>
            <Field.Root name="displayName">
              <Field.Label>Display name</Field.Label>
              <TextInput value={displayName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onNameChange(e.target.value)} placeholder={mode === 'component' ? 'e.g. Promo Banner' : 'e.g. Offer'} />
            </Field.Root>

            {mode === 'component' ? (
              <>
                <Field.Root name="category" hint="Components are grouped by category. Use “blocks” for page sections.">
                  <Field.Label>Category</Field.Label>
                  <SingleSelect value={category || undefined} onChange={(v) => setCategory(String(v))}>
                    {categories.map((c) => (
                      <SingleSelectOption key={c} value={c}>
                        {c}
                      </SingleSelectOption>
                    ))}
                    <SingleSelectOption value="__new">+ New category…</SingleSelectOption>
                  </SingleSelect>
                  <Field.Hint />
                </Field.Root>
                {category === '__new' && (
                  <Field.Root name="newCategory">
                    <Field.Label>New category</Field.Label>
                    <TextInput value={newCategory} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCategory(e.target.value)} />
                  </Field.Root>
                )}
              </>
            ) : (
              <>
                <Flex gap={4}>
                  <Field.Root name="singular" style={{ flex: 1 }} hint="Used in the API, e.g. /api/offer">
                    <Field.Label>API ID (singular)</Field.Label>
                    <TextInput
                      value={singular}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        setApiIdsTouched(true);
                        setSingular(e.target.value);
                      }}
                    />
                    <Field.Hint />
                  </Field.Root>
                  <Field.Root name="plural" style={{ flex: 1 }} hint="Used in the API, e.g. /api/offers">
                    <Field.Label>API ID (plural)</Field.Label>
                    <TextInput
                      value={plural}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        setApiIdsTouched(true);
                        setPlural(e.target.value);
                      }}
                    />
                    <Field.Hint />
                  </Field.Root>
                </Flex>
                <Field.Root name="draftAndPublish" hint="Entries are saved as drafts and go live only when published. Can’t be changed later.">
                  <Field.Label>Draft & publish</Field.Label>
                  <Toggle checked={draftAndPublish} onLabel="On" offLabel="Off" onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraftAndPublish(e.target.checked)} />
                  <Field.Hint />
                </Field.Root>
              </>
            )}
            {error && <Typography textColor="danger600">{error}</Typography>}
          </Flex>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="tertiary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Continue</Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  );
}

// ─── Settings (rename / description / delete) ───────────────────────────────────────────────────

function SettingsModal({
  title,
  draft,
  isSaved,
  onClose,
  onApply,
  onDelete,
}: {
  title: string;
  draft: Draft;
  isSaved: boolean;
  onClose: () => void;
  onApply: (patch: Partial<Draft>) => void;
  onDelete: () => void;
}) {
  const [displayName, setDisplayName] = useState(draft.displayName);
  const [description, setDescription] = useState(draft.description);
  return (
    <Modal.Root open onOpenChange={(open: boolean) => !open && onClose()}>
      <Modal.Content>
        <Modal.Header>
          <Modal.Title>{title}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Flex direction="column" alignItems="stretch" gap={4}>
            <Field.Root name="displayName">
              <Field.Label>Display name</Field.Label>
              <TextInput value={displayName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDisplayName(e.target.value)} />
            </Field.Root>
            <Field.Root name="description">
              <Field.Label>Description</Field.Label>
              <TextInput value={description} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)} />
            </Field.Root>
          </Flex>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="danger-light" startIcon={<Trash />} onClick={onDelete}>
            {isSaved ? 'Delete' : 'Discard'}
          </Button>
          <Flex gap={2}>
            <Button variant="tertiary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => displayName.trim() && onApply({ displayName: displayName.trim(), description })}>Finish</Button>
          </Flex>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  );
}

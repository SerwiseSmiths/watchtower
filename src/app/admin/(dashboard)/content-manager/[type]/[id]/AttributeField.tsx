'use client';

import { useMemo, useState } from 'react';
import NextLink from 'next/link';
import {
  Accordion,
  Box,
  Button,
  Combobox,
  ComboboxOption,
  DatePicker,
  DateTimePicker,
  Field,
  Flex,
  Grid,
  IconButton,
  JSONInput,
  Modal,
  NumberInput,
  SingleSelect,
  SingleSelectOption,
  Toggle,
  Typography,
  TextInput,
  Textarea,
} from '@strapi/design-system';
import { ArrowDown, ArrowUp, Cross, Link as LinkIcon, Plus, Trash } from '@strapi/icons';
import type { FieldSchema } from '@/lib/content-schema/types';

export interface ComponentDef {
  displayName: string;
  attributes: Record<string, FieldSchema>;
}

export interface RelationOption {
  id: number;
  documentId: string;
  label: string;
  targetSlug: string;
}

export interface MediaLibraryFile {
  id: number;
  url: string;
  name: string;
  mime: string;
  alternativeText: string | null;
}

export interface AttributeFieldProps {
  name: string;
  field: FieldSchema;
  value: unknown;
  onChange: (value: unknown) => void;
  components: Record<string, ComponentDef>;
  relationOptions: Record<string, RelationOption[]>;
  mediaLibrary: MediaLibraryFile[];
}

function emptyValueFor(attributes: Record<string, FieldSchema>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [name, field] of Object.entries(attributes)) {
    if (field.kind === 'scalar' && field.default !== undefined) result[name] = field.default;
  }
  return result;
}

function move<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function ScalarField({ name, field, value, onChange }: AttributeFieldProps) {
  if (field.kind !== 'scalar') return null;

  if (field.type === 'boolean') {
    return (
      <Toggle
        name={name}
        checked={!!value}
        onLabel="True"
        offLabel="False"
        onChange={(e) => onChange(e.target.checked)}
      />
    );
  }
  if (field.type === 'integer' || field.type === 'decimal') {
    return (
      <NumberInput
        name={name}
        value={value as number | undefined}
        onValueChange={(v) => onChange(v ?? null)}
        step={field.type === 'decimal' ? 0.01 : 1}
      />
    );
  }
  if (field.type === 'enumeration' && field.enum) {
    return (
      <SingleSelect name={name} value={(value as string) ?? undefined} onChange={(v) => onChange(v)}>
        {field.enum.map((option) => (
          <SingleSelectOption key={option} value={option}>
            {option}
          </SingleSelectOption>
        ))}
      </SingleSelect>
    );
  }
  if (field.type === 'text') {
    return <Textarea name={name} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />;
  }
  if (field.type === 'date') {
    const dateValue = value ? new Date(value as string | number | Date) : undefined;
    return <DatePicker name={name} value={dateValue} onChange={(date) => onChange(date ?? null)} clearLabel="Clear" onClear={() => onChange(null)} />;
  }
  if (field.type === 'datetime') {
    const dateValue = value ? new Date(value as string | number | Date) : undefined;
    return <DateTimePicker name={name} value={dateValue} onChange={(date) => onChange(date ?? null)} clearLabel="Clear" onClear={() => onChange(null)} />;
  }
  if (field.type === 'json') {
    return <JsonField value={value} onChange={onChange} />;
  }
  return (
    <TextInput
      name={name}
      value={(value as string) ?? ''}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
    />
  );
}

function JsonField({ value, onChange }: { value: unknown; onChange: (value: unknown) => void }) {
  const [text, setText] = useState(() => (value == null ? '' : JSON.stringify(value, null, 2)));
  const [error, setError] = useState<string | null>(null);

  function handleChange(next: string) {
    setText(next);
    if (next.trim() === '') {
      setError(null);
      onChange(null);
      return;
    }
    try {
      onChange(JSON.parse(next));
      setError(null);
    } catch {
      setError('Invalid JSON');
    }
  }

  return (
    <Flex direction="column" alignItems="stretch" gap={1}>
      <JSONInput value={text} onChange={handleChange} hasError={!!error} />
      {error && (
        <Typography variant="pi" textColor="danger600">
          {error}
        </Typography>
      )}
    </Flex>
  );
}

function isImage(mime: string): boolean {
  return mime.startsWith('image/');
}

function MediaThumb({ file, onRemove }: { file: { id: number; url?: string; mime?: string; name?: string } | null; onRemove?: () => void }) {
  if (!file) return null;
  return (
    <Box position="relative" width="8rem" height="8rem" hasRadius overflow="hidden" background="neutral150" borderColor="neutral200" style={{ borderWidth: 1, borderStyle: 'solid' }}>
      {file.url && isImage(file.mime ?? '') ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={file.url} alt={file.name ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <Flex height="100%" alignItems="center" justifyContent="center">
          <Typography variant="pi" ellipsis>
            {file?.name ?? 'file'}
          </Typography>
        </Flex>
      )}
      {onRemove && (
        <Box position="absolute" top={1} right={1}>
          <IconButton label="Remove" onClick={onRemove} variant="danger-light">
            <Cross />
          </IconButton>
        </Box>
      )}
    </Box>
  );
}

function MediaPickerModal({
  mediaLibrary,
  onSelect,
  trigger,
}: {
  mediaLibrary: MediaLibraryFile[];
  onSelect: (file: MediaLibraryFile) => void;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Modal.Root open={open} onOpenChange={setOpen}>
      <Modal.Trigger>{trigger}</Modal.Trigger>
      <Modal.Content>
        <Modal.Header>
          <Modal.Title>Select a file</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Grid.Root gap={3}>
            {mediaLibrary.map((file) => (
              <Grid.Item key={file.id} col={3} s={6} xs={12}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(file);
                    setOpen(false);
                  }}
                  style={{ cursor: 'pointer', width: '100%', textAlign: 'left', border: 'none', background: 'none', padding: 0 }}
                >
                  <MediaThumb file={file} />
                  <Typography variant="pi" ellipsis>
                    {file.name}
                  </Typography>
                </button>
              </Grid.Item>
            ))}
            {mediaLibrary.length === 0 && <Typography textColor="neutral600">No files in the media library yet.</Typography>}
          </Grid.Root>
        </Modal.Body>
      </Modal.Content>
    </Modal.Root>
  );
}

function MediaField({ field, value, onChange, mediaLibrary }: AttributeFieldProps) {
  if (field.kind !== 'media') return null;

  if (field.multiple) {
    const files = (Array.isArray(value) ? value : []) as Array<{ id: number; url?: string; mime?: string; name?: string }>;
    return (
      <Flex direction="column" alignItems="stretch" gap={2}>
        <Flex gap={2} wrap="wrap">
          {files.map((f, i) => (
            <MediaThumb key={f.id ?? i} file={f} onRemove={() => onChange(files.filter((_, idx) => idx !== i))} />
          ))}
        </Flex>
        <MediaPickerModal
          mediaLibrary={mediaLibrary}
          onSelect={(file) => onChange([...files, file])}
          trigger={
            <Button variant="secondary" startIcon={<Plus />}>
              Add asset
            </Button>
          }
        />
      </Flex>
    );
  }

  const current = value as { id: number; url?: string; mime?: string; name?: string } | null;
  return (
    <Flex direction="column" alignItems="flex-start" gap={2}>
      {current ? (
        <MediaThumb file={current} onRemove={() => onChange(null)} />
      ) : (
        <MediaPickerModal
          mediaLibrary={mediaLibrary}
          onSelect={(file) => onChange(file)}
          trigger={
            <button
              type="button"
              style={{
                width: '8rem',
                height: '8rem',
                borderRadius: '4px',
                borderWidth: 2,
                borderStyle: 'dashed',
                borderColor: '#dcdce4',
                cursor: 'pointer',
                background: 'none',
              }}
            >
              <Flex height="100%" alignItems="center" justifyContent="center" direction="column" gap={1}>
                <Plus />
                <Typography variant="pi">Add asset</Typography>
              </Flex>
            </button>
          }
        />
      )}
    </Flex>
  );
}

function RelationField({
  value,
  onChange,
  options,
  multi,
}: {
  value: unknown;
  onChange: (v: unknown) => void;
  options: RelationOption[];
  multi: boolean;
}) {
  const [filter, setFilter] = useState('');

  const selected = useMemo(() => {
    const raw = multi ? (Array.isArray(value) ? value : []) : value != null ? [value] : [];
    const ids = raw
      .map((v: { id?: number } | number) => (typeof v === 'object' ? v.id : v))
      .filter((id): id is number => typeof id === 'number');
    return ids.map((id) => options.find((o) => o.id === id)).filter((o): o is RelationOption => !!o);
  }, [value, options, multi]);

  const selectedIds = new Set(selected.map((o) => o.id));
  const available = options.filter((o) => !selectedIds.has(o.id) && o.label.toLowerCase().includes(filter.toLowerCase()));

  function addRelation(id: number) {
    if (multi) {
      onChange([...selected.map((o) => o.id), id]);
    } else {
      onChange({ id });
    }
    setFilter('');
  }

  function removeRelation(id: number) {
    if (multi) {
      onChange(selected.filter((o) => o.id !== id).map((o) => o.id));
    } else {
      onChange(null);
    }
  }

  function reorder(index: number, direction: -1 | 1) {
    const reordered = move(selected, index, index + direction);
    onChange(reordered.map((o) => o.id));
  }

  return (
    <Flex direction="column" alignItems="stretch" gap={2}>
      <Combobox
        placeholder="Add relation…"
        value={undefined}
        filterValue={filter}
        onFilterValueChange={setFilter}
        onChange={(v) => v != null && addRelation(parseInt(String(v), 10))}
      >
        {available.map((opt) => (
          <ComboboxOption key={opt.id} value={String(opt.id)}>
            {opt.label}
          </ComboboxOption>
        ))}
      </Combobox>

      <Flex direction="column" alignItems="stretch" gap={1} tag="ul" style={{ listStyle: 'none' }}>
        {selected.map((opt, index) => (
          <Flex
            key={opt.id}
            tag="li"
            justifyContent="space-between"
            alignItems="center"
            padding={2}
            background="neutral100"
            hasRadius
          >
            <NextLink href={`/admin/content-manager/${opt.targetSlug}/${opt.documentId}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <LinkIcon width="1.2rem" height="1.2rem" />
              <Typography>{opt.label}</Typography>
            </NextLink>
            <Flex gap={1}>
              {multi && (
                <>
                  <IconButton label="Move up" onClick={() => reorder(index, -1)} disabled={index === 0}>
                    <ArrowUp />
                  </IconButton>
                  <IconButton label="Move down" onClick={() => reorder(index, 1)} disabled={index === selected.length - 1}>
                    <ArrowDown />
                  </IconButton>
                </>
              )}
              <IconButton label="Remove" onClick={() => removeRelation(opt.id)}>
                <Cross />
              </IconButton>
            </Flex>
          </Flex>
        ))}
        {selected.length === 0 && (
          <Typography variant="pi" textColor="neutral600">
            No relations selected.
          </Typography>
        )}
      </Flex>
    </Flex>
  );
}

function ComponentSubForm({
  attributes,
  value,
  onChange,
  components,
  relationOptions,
  mediaLibrary,
}: {
  attributes: Record<string, FieldSchema>;
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  components: Record<string, ComponentDef>;
  relationOptions: Record<string, RelationOption[]>;
  mediaLibrary: MediaLibraryFile[];
}) {
  return (
    <Flex direction="column" alignItems="stretch" gap={4}>
      {Object.entries(attributes).map(([subName, subField]) => (
        <Field.Root key={subName} name={subName}>
          <Field.Label>{subName}</Field.Label>
          <AttributeField
            name={subName}
            field={subField}
            value={value?.[subName]}
            onChange={(v) => onChange({ ...value, [subName]: v })}
            components={components}
            relationOptions={relationOptions}
            mediaLibrary={mediaLibrary}
          />
        </Field.Root>
      ))}
    </Flex>
  );
}

/** Collapsed-by-default (open for newly-added items), independent per block — matches Strapi's
 * repeatable-component/dynamic-zone accordion pattern. Reordering is button-based rather than
 * drag-and-drop (Strapi supports both; DnD was out of scope here — see PROGRESS.md). */
function CollapsibleBlock({
  title,
  subtitle,
  defaultOpen,
  onMoveUp,
  onMoveDown,
  onRemove,
  canMoveUp,
  canMoveDown,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onRemove: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Accordion.Root value={open ? 'content' : ''} onValueChange={(v) => setOpen(!!v)} collapsible>
      <Accordion.Item value="content">
        <Accordion.Header>
          <Accordion.Trigger description={subtitle}>{title}</Accordion.Trigger>
          <Accordion.Actions>
            {onMoveUp && (
              <IconButton label="Move up" onClick={onMoveUp} disabled={!canMoveUp}>
                <ArrowUp />
              </IconButton>
            )}
            {onMoveDown && (
              <IconButton label="Move down" onClick={onMoveDown} disabled={!canMoveDown}>
                <ArrowDown />
              </IconButton>
            )}
            <IconButton label="Delete" onClick={onRemove}>
              <Trash />
            </IconButton>
          </Accordion.Actions>
        </Accordion.Header>
        <Accordion.Content>
          <Box padding={4}>{children}</Box>
        </Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>
  );
}

function ComponentField({ field, value, onChange, components, relationOptions, mediaLibrary }: AttributeFieldProps) {
  if (field.kind !== 'component') return null;
  const componentDef = components[field.component];
  if (!componentDef) return <Typography textColor="danger600">Unknown component {field.component}</Typography>;

  if (!field.repeatable) {
    const current = (value as Record<string, unknown>) ?? {};
    return (
      <Box padding={4} background="neutral0" hasRadius borderColor="neutral200" style={{ borderWidth: 1, borderStyle: 'solid' }}>
        <ComponentSubForm
          attributes={componentDef.attributes}
          value={current}
          onChange={onChange}
          components={components}
          relationOptions={relationOptions}
          mediaLibrary={mediaLibrary}
        />
      </Box>
    );
  }

  const items = (Array.isArray(value) ? value : []) as Record<string, unknown>[];
  return (
    <Flex direction="column" alignItems="stretch" gap={2}>
      {items.map((item, index) => (
        <CollapsibleBlock
          key={index}
          title={`${componentDef.displayName} #${index + 1}`}
          defaultOpen={false}
          canMoveUp={index > 0}
          canMoveDown={index < items.length - 1}
          onMoveUp={() => onChange(move(items, index, index - 1))}
          onMoveDown={() => onChange(move(items, index, index + 1))}
          onRemove={() => onChange(items.filter((_, i) => i !== index))}
        >
          <ComponentSubForm
            attributes={componentDef.attributes}
            value={item}
            onChange={(v) => {
              const next = [...items];
              next[index] = v;
              onChange(next);
            }}
            components={components}
            relationOptions={relationOptions}
            mediaLibrary={mediaLibrary}
          />
        </CollapsibleBlock>
      ))}
      <Button variant="secondary" startIcon={<Plus />} onClick={() => onChange([...items, emptyValueFor(componentDef.attributes)])}>
        Add an entry
      </Button>
    </Flex>
  );
}

function DynamicZoneField({ field, value, onChange, components, relationOptions, mediaLibrary }: AttributeFieldProps) {
  const [picking, setPicking] = useState(false);
  if (field.kind !== 'dynamiczone') return null;
  const items = (Array.isArray(value) ? value : []) as Array<Record<string, unknown> & { __component: string }>;

  return (
    <Flex direction="column" alignItems="stretch" gap={2}>
      {items.map((item, index) => {
        const componentDef = components[item.__component];
        if (!componentDef) return null;
        return (
          <CollapsibleBlock
            key={index}
            title={componentDef.displayName}
            subtitle={item.__component}
            defaultOpen={false}
            canMoveUp={index > 0}
            canMoveDown={index < items.length - 1}
            onMoveUp={() => onChange(move(items, index, index - 1))}
            onMoveDown={() => onChange(move(items, index, index + 1))}
            onRemove={() => onChange(items.filter((_, i) => i !== index))}
          >
            <ComponentSubForm
              attributes={componentDef.attributes}
              value={item}
              onChange={(v) => {
                const next = [...items];
                next[index] = { ...v, __component: item.__component };
                onChange(next);
              }}
              components={components}
              relationOptions={relationOptions}
              mediaLibrary={mediaLibrary}
            />
          </CollapsibleBlock>
        );
      })}

      {picking ? (
        <Box padding={4} background="neutral0" hasRadius borderColor="neutral200" style={{ borderWidth: 1, borderStyle: 'solid' }}>
          <Typography variant="pi" fontWeight="bold" tag="div" style={{ marginBottom: '0.5rem' }}>
            Pick one component
          </Typography>
          <Flex gap={2} wrap="wrap">
            {field.components.map((uid) => (
              <Button
                key={uid}
                variant="tertiary"
                onClick={() => {
                  const def = components[uid];
                  onChange([...items, { __component: uid, ...(def ? emptyValueFor(def.attributes) : {}) }]);
                  setPicking(false);
                }}
              >
                {components[uid]?.displayName ?? uid}
              </Button>
            ))}
          </Flex>
        </Box>
      ) : (
        <Button variant="secondary" startIcon={<Plus />} onClick={() => setPicking(true)}>
          Add a component
        </Button>
      )}
    </Flex>
  );
}

export default function AttributeField(props: AttributeFieldProps) {
  switch (props.field.kind) {
    case 'scalar':
      return <ScalarField {...props} />;
    case 'media':
      return <MediaField {...props} />;
    case 'component':
      return <ComponentField {...props} />;
    case 'dynamiczone':
      return <DynamicZoneField {...props} />;
    case 'relation':
      return (
        <RelationField
          value={props.value}
          onChange={props.onChange}
          options={props.relationOptions[props.name] ?? []}
          multi={props.field.relation === 'oneToMany' || props.field.relation === 'manyToMany'}
        />
      );
    default:
      return null;
  }
}

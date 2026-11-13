'use client';

import { useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Field,
  Flex,
  Grid,
  Modal,
  NumberInput,
  SingleSelect,
  SingleSelectOption,
  TextInput,
  Textarea,
  Toggle,
  Typography,
} from '@strapi/design-system';
import { ArrowLeft } from '@strapi/icons';
import type { RawAttribute } from '@/lib/content-schema/loader';
import { COLOR_CUSTOM_FIELD, FIELD_KINDS, RELATION_KINDS, fieldKindOf, type FieldKind } from './field-types';

export interface Option {
  uid: string;
  displayName: string;
}

const NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;
const RESERVED = new Set(['id', 'documentId', 'createdAt', 'updatedAt', 'publishedAt', 'createdBy', 'updatedBy', 'locale', 'localizations', 'meta']);
const MEDIA_TYPES = [
  { value: 'images', label: 'Images (JPEG, PNG, GIF, SVG, TIFF, ICO, DVU)' },
  { value: 'videos', label: 'Videos (MPEG, MP4, Quicktime, WMV, AVI, FLV)' },
  { value: 'audios', label: 'Audios (MP3, WAV, OGG)' },
  { value: 'files', label: 'Files (CSV, ZIP, PDF, Excel, JSON, …)' },
];

interface FormState {
  name: string;
  textVariant: 'string' | 'text';
  numberVariant: 'integer' | 'decimal';
  dateVariant: 'date' | 'datetime';
  enumValues: string;
  defaultValue: string;
  required: boolean;
  unique: boolean;
  mediaMultiple: boolean;
  allowedTypes: string[];
  relationTarget: string;
  relationKind: string;
  component: string;
  repeatable: boolean;
  min: number | undefined;
  max: number | undefined;
  dzComponents: string[];
  targetField: string;
}

function initialForm(name: string, attr: RawAttribute | undefined): FormState {
  return {
    name,
    textVariant: attr?.type === 'text' ? 'text' : 'string',
    numberVariant: attr?.type === 'decimal' ? 'decimal' : 'integer',
    dateVariant: attr?.type === 'datetime' ? 'datetime' : 'date',
    enumValues: (attr?.enum ?? []).join('\n'),
    defaultValue: attr?.default != null ? String(attr.default) : '',
    required: !!attr?.required,
    unique: !!attr?.unique,
    mediaMultiple: !!attr?.multiple,
    allowedTypes: attr?.allowedTypes ?? ['images', 'files', 'videos', 'audios'],
    relationTarget: attr?.target ?? '',
    relationKind: attr?.relation ?? 'manyToOne',
    component: attr?.component ?? '',
    repeatable: !!attr?.repeatable,
    min: attr?.min,
    max: attr?.max,
    dzComponents: attr?.components ?? [],
    targetField: attr?.targetField ?? '',
  };
}

/** Builds the raw Strapi attribute. Starts from the existing attribute so keys the builder doesn't
 *  edit (e.g. pluginOptions, inversedBy) are preserved; unset options are removed, not stored as false. */
function buildAttribute(kind: FieldKind, f: FormState, existing: RawAttribute | undefined): RawAttribute | string {
  const base: Record<string, unknown> = { ...(existing ?? {}) };
  for (const key of ['required', 'unique', 'default', 'enum', 'multiple', 'allowedTypes', 'min', 'max', 'repeatable', 'targetField', 'customField']) delete base[key];
  const set = (key: string, value: unknown) => {
    if (value !== undefined && value !== false && value !== '') base[key] = value;
  };
  set('required', f.required || undefined);

  switch (kind) {
    case 'text':
      base.type = f.textVariant;
      set('unique', f.unique || undefined);
      set('default', f.defaultValue || undefined);
      break;
    case 'number': {
      base.type = f.numberVariant;
      set('unique', f.unique || undefined);
      if (f.defaultValue !== '') {
        const n = Number(f.defaultValue);
        if (Number.isNaN(n)) return 'Default value must be a number';
        base.default = f.numberVariant === 'integer' ? Math.trunc(n) : n;
      }
      break;
    }
    case 'date':
      base.type = f.dateVariant;
      break;
    case 'boolean':
      base.type = 'boolean';
      if (f.defaultValue === 'true' || f.defaultValue === 'false') base.default = f.defaultValue === 'true';
      break;
    case 'json':
      base.type = 'json';
      break;
    case 'enumeration': {
      const values = [...new Set(f.enumValues.split('\n').map((v) => v.trim()).filter(Boolean))];
      if (values.length === 0) return 'Add at least one value (one per line)';
      base.type = 'enumeration';
      base.enum = values;
      if (f.defaultValue) {
        if (!values.includes(f.defaultValue)) return 'The default value must be one of the values';
        base.default = f.defaultValue;
      }
      break;
    }
    case 'media':
      if (f.allowedTypes.length === 0) return 'Allow at least one media type';
      base.type = 'media';
      base.multiple = f.mediaMultiple;
      base.allowedTypes = f.allowedTypes;
      break;
    case 'relation':
      if (!f.relationTarget) return 'Choose the content type this relates to';
      base.type = 'relation';
      base.relation = f.relationKind;
      base.target = f.relationTarget;
      delete base.required;
      break;
    case 'uid':
      base.type = 'uid';
      set('targetField', f.targetField || undefined);
      break;
    case 'color':
      base.type = 'customField';
      base.customField = COLOR_CUSTOM_FIELD;
      set('default', f.defaultValue || undefined);
      break;
    case 'component':
      if (!f.component) return 'Choose a component';
      base.type = 'component';
      base.component = f.component;
      base.repeatable = f.repeatable;
      if (f.repeatable) {
        set('min', f.min);
        set('max', f.max);
      }
      break;
    case 'dynamiczone':
      if (f.dzComponents.length === 0) return 'Pick at least one component';
      base.type = 'dynamiczone';
      base.components = f.dzComponents;
      break;
  }
  return base as unknown as RawAttribute;
}

function TypeCard({ label, description, Icon, onClick }: (typeof FIELD_KINDS)[number] & { onClick: () => void }) {
  return (
    <Box
      tag="button"
      type="button"
      onClick={onClick}
      width="100%"
      padding={4}
      hasRadius
      background="neutral0"
      borderColor="neutral200"
      style={{ borderWidth: 1, borderStyle: 'solid', cursor: 'pointer', textAlign: 'left' }}
    >
      <Flex gap={4} alignItems="center">
        <Icon width="3.2rem" height="2.4rem" />
        <Flex direction="column" alignItems="flex-start" gap={1}>
          <Typography fontWeight="bold" textColor="neutral800">
            {label}
          </Typography>
          <Typography variant="pi" textColor="neutral600">
            {description}
          </Typography>
        </Flex>
      </Flex>
    </Box>
  );
}

export interface FieldEditorModalProps {
  ownerLabel: string;
  ownerIsComponent: boolean;
  /** Present when editing an existing field. */
  editing?: { name: string; attr: RawAttribute; isSaved: boolean };
  takenNames: string[];
  contentTypeOptions: Option[];
  componentOptions: Option[];
  stringFieldNames: string[];
  onSubmit: (name: string, attr: RawAttribute, addAnother: boolean) => void;
  onClose: () => void;
}

export default function FieldEditorModal({
  ownerLabel,
  ownerIsComponent,
  editing,
  takenNames,
  contentTypeOptions,
  componentOptions,
  stringFieldNames,
  onSubmit,
  onClose,
}: FieldEditorModalProps) {
  const [kind, setKind] = useState<FieldKind | null>(editing ? fieldKindOf(editing.attr) : null);
  const [form, setForm] = useState<FormState>(() => initialForm(editing?.name ?? '', editing?.attr));
  const [error, setError] = useState<string | null>(null);
  const update = (patch: Partial<FormState>) => setForm((prev) => ({ ...prev, ...patch }));
  // Storage-defining choices are fixed once a field is saved (changing them needs a new column).
  const locked = !!editing?.isSaved;

  function submit(addAnother: boolean) {
    if (!kind) return;
    const name = form.name.trim();
    if (!NAME_PATTERN.test(name)) return setError('Name must start with a letter and use only letters, digits and _');
    if (RESERVED.has(name)) return setError(`"${name}" is reserved`);
    if (name !== editing?.name && takenNames.includes(name)) return setError(`A field named "${name}" already exists`);
    const attr = buildAttribute(kind, form, editing?.attr);
    if (typeof attr === 'string') return setError(attr);
    onSubmit(name, attr, addAnother);
    if (addAnother) {
      setKind(null);
      setForm(initialForm('', undefined));
      setError(null);
    }
  }

  const kinds = FIELD_KINDS.filter((k) => !(ownerIsComponent && k.kind === 'dynamiczone'));
  const kindMeta = FIELD_KINDS.find((k) => k.kind === kind);

  return (
    <Modal.Root open onOpenChange={(open: boolean) => !open && onClose()}>
      <Modal.Content style={{ maxWidth: '64rem', width: '100%' }}>
        <Modal.Header>
          <Flex gap={2} alignItems="center">
            {kind && !editing && (
              <Button variant="ghost" size="S" startIcon={<ArrowLeft />} onClick={() => setKind(null)}>
                Back
              </Button>
            )}
            <Modal.Title>
              {!kind ? `Select a field for ${ownerLabel}` : editing ? `Edit ${editing.name}` : `Add new ${kindMeta?.label} field`}
            </Modal.Title>
          </Flex>
        </Modal.Header>

        <Modal.Body>
          {!kind ? (
            <Grid.Root gap={3}>
              {kinds.map((k) => (
                <Grid.Item key={k.kind} col={6} xs={12} direction="column" alignItems="stretch">
                  <TypeCard {...k} onClick={() => setKind(k.kind)} />
                </Grid.Item>
              ))}
            </Grid.Root>
          ) : (
            <Flex direction="column" alignItems="stretch" gap={5}>
              <Field.Root name="name" hint={locked ? 'Field names can’t be changed once saved.' : 'No spaces. Shown to editors and used as the API key.'}>
                <Field.Label>Name</Field.Label>
                <TextInput value={form.name} disabled={locked} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update({ name: e.target.value })} />
                <Field.Hint />
              </Field.Root>

              {kind === 'text' && (
                <Field.Root name="textVariant">
                  <Field.Label>Type</Field.Label>
                  <SingleSelect value={form.textVariant} disabled={locked} onChange={(v) => update({ textVariant: v as FormState['textVariant'] })}>
                    <SingleSelectOption value="string">Short text — titles, names, links</SingleSelectOption>
                    <SingleSelectOption value="text">Long text — descriptions, paragraphs</SingleSelectOption>
                  </SingleSelect>
                </Field.Root>
              )}

              {kind === 'number' && (
                <Field.Root name="numberVariant">
                  <Field.Label>Number format</Field.Label>
                  <SingleSelect value={form.numberVariant} disabled={locked} onChange={(v) => update({ numberVariant: v as FormState['numberVariant'] })}>
                    <SingleSelectOption value="integer">Integer (e.g. 10)</SingleSelectOption>
                    <SingleSelectOption value="decimal">Decimal (e.g. 2.22)</SingleSelectOption>
                  </SingleSelect>
                </Field.Root>
              )}

              {kind === 'date' && (
                <Field.Root name="dateVariant">
                  <Field.Label>Type</Field.Label>
                  <SingleSelect value={form.dateVariant} disabled={locked} onChange={(v) => update({ dateVariant: v as FormState['dateVariant'] })}>
                    <SingleSelectOption value="date">Date (e.g. 01/01/2026)</SingleSelectOption>
                    <SingleSelectOption value="datetime">Date and time (e.g. 01/01/2026 00:00 AM)</SingleSelectOption>
                  </SingleSelect>
                </Field.Root>
              )}

              {kind === 'enumeration' && (
                <Field.Root name="enum" hint="One value per line">
                  <Field.Label>Values</Field.Label>
                  <Textarea value={form.enumValues} onChange={(e) => update({ enumValues: e.target.value })} placeholder={'ACTIVE\nINACTIVE'} />
                  <Field.Hint />
                </Field.Root>
              )}

              {kind === 'media' && (
                <>
                  <Field.Root name="mediaMultiple">
                    <Field.Label>Type</Field.Label>
                    <SingleSelect value={form.mediaMultiple ? 'multiple' : 'single'} onChange={(v) => update({ mediaMultiple: v === 'multiple' })}>
                      <SingleSelectOption value="single">Single media — e.g. an avatar or cover image</SingleSelectOption>
                      <SingleSelectOption value="multiple">Multiple media — e.g. a slider or gallery</SingleSelectOption>
                    </SingleSelect>
                  </Field.Root>
                  <Flex direction="column" alignItems="flex-start" gap={2}>
                    <Typography variant="pi" fontWeight="bold">
                      Allowed types
                    </Typography>
                    {MEDIA_TYPES.map((t) => (
                      <Checkbox
                        key={t.value}
                        checked={form.allowedTypes.includes(t.value)}
                        onCheckedChange={(checked) =>
                          update({ allowedTypes: checked ? [...form.allowedTypes, t.value] : form.allowedTypes.filter((v) => v !== t.value) })
                        }
                      >
                        {t.label}
                      </Checkbox>
                    ))}
                  </Flex>
                </>
              )}

              {kind === 'relation' && (
                <Grid.Root gap={4}>
                  <Grid.Item col={6} xs={12} direction="column" alignItems="stretch">
                    <Field.Root name="relationKind">
                      <Field.Label>Relation</Field.Label>
                      <SingleSelect value={form.relationKind} disabled={locked} onChange={(v) => update({ relationKind: String(v) })}>
                        {RELATION_KINDS.map((r) => (
                          <SingleSelectOption key={r.value} value={r.value}>
                            {r.label}
                          </SingleSelectOption>
                        ))}
                      </SingleSelect>
                    </Field.Root>
                  </Grid.Item>
                  <Grid.Item col={6} xs={12} direction="column" alignItems="stretch">
                    <Field.Root name="relationTarget">
                      <Field.Label>Target</Field.Label>
                      <SingleSelect value={form.relationTarget || undefined} placeholder="Choose a collection type" disabled={locked} onChange={(v) => update({ relationTarget: String(v) })}>
                        {contentTypeOptions.map((o) => (
                          <SingleSelectOption key={o.uid} value={o.uid}>
                            {o.displayName}
                          </SingleSelectOption>
                        ))}
                      </SingleSelect>
                    </Field.Root>
                  </Grid.Item>
                </Grid.Root>
              )}

              {kind === 'uid' && (
                <Field.Root name="targetField" hint="The UID is generated from this text field">
                  <Field.Label>Attached field</Field.Label>
                  <SingleSelect value={form.targetField || 'none'} onChange={(v) => update({ targetField: v === 'none' ? '' : String(v) })}>
                    <SingleSelectOption value="none">None</SingleSelectOption>
                    {stringFieldNames.map((n) => (
                      <SingleSelectOption key={n} value={n}>
                        {n}
                      </SingleSelectOption>
                    ))}
                  </SingleSelect>
                  <Field.Hint />
                </Field.Root>
              )}

              {kind === 'component' && (
                <>
                  <Field.Root name="component" hint={componentOptions.length === 0 ? 'Create a component first (left menu → Components).' : undefined}>
                    <Field.Label>Component</Field.Label>
                    <SingleSelect value={form.component || undefined} placeholder="Choose a component" disabled={locked} onChange={(v) => update({ component: String(v) })}>
                      {componentOptions.map((o) => (
                        <SingleSelectOption key={o.uid} value={o.uid}>
                          {o.displayName} ({o.uid})
                        </SingleSelectOption>
                      ))}
                    </SingleSelect>
                    <Field.Hint />
                  </Field.Root>
                  <Field.Root name="repeatable">
                    <Field.Label>Type</Field.Label>
                    <SingleSelect value={form.repeatable ? 'repeatable' : 'single'} onChange={(v) => update({ repeatable: v === 'repeatable' })}>
                      <SingleSelectOption value="single">Single component — one group of fields</SingleSelectOption>
                      <SingleSelectOption value="repeatable">Repeatable component — a list (e.g. tabs, FAQ items)</SingleSelectOption>
                    </SingleSelect>
                  </Field.Root>
                  {form.repeatable && (
                    <Grid.Root gap={4}>
                      <Grid.Item col={6} direction="column" alignItems="stretch">
                        <Field.Root name="min">
                          <Field.Label>Minimum items</Field.Label>
                          <NumberInput value={form.min} onValueChange={(v) => update({ min: v ?? undefined })} />
                        </Field.Root>
                      </Grid.Item>
                      <Grid.Item col={6} direction="column" alignItems="stretch">
                        <Field.Root name="max">
                          <Field.Label>Maximum items</Field.Label>
                          <NumberInput value={form.max} onValueChange={(v) => update({ max: v ?? undefined })} />
                        </Field.Root>
                      </Grid.Item>
                    </Grid.Root>
                  )}
                </>
              )}

              {kind === 'dynamiczone' && (
                <Flex direction="column" alignItems="flex-start" gap={2}>
                  <Typography variant="pi" fontWeight="bold">
                    Components editors can add (blocks)
                  </Typography>
                  {componentOptions.length === 0 && <Typography textColor="neutral600">Create a component first (left menu → Components).</Typography>}
                  {componentOptions.map((o) => (
                    <Checkbox
                      key={o.uid}
                      checked={form.dzComponents.includes(o.uid)}
                      onCheckedChange={(checked) =>
                        update({ dzComponents: checked ? [...form.dzComponents, o.uid] : form.dzComponents.filter((c) => c !== o.uid) })
                      }
                    >
                      {o.displayName} <Typography textColor="neutral500">({o.uid})</Typography>
                    </Checkbox>
                  ))}
                </Flex>
              )}

              {(kind === 'text' || kind === 'color' || kind === 'enumeration' || kind === 'number' || kind === 'boolean') && (
                <Field.Root name="default">
                  <Field.Label>Default value</Field.Label>
                  {kind === 'boolean' ? (
                    <SingleSelect value={form.defaultValue || 'none'} onChange={(v) => update({ defaultValue: v === 'none' ? '' : String(v) })}>
                      <SingleSelectOption value="none">None</SingleSelectOption>
                      <SingleSelectOption value="true">TRUE</SingleSelectOption>
                      <SingleSelectOption value="false">FALSE</SingleSelectOption>
                    </SingleSelect>
                  ) : (
                    <TextInput value={form.defaultValue} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update({ defaultValue: e.target.value })} />
                  )}
                </Field.Root>
              )}

              {kind !== 'relation' && (
                <Flex gap={6} wrap="wrap">
                  <Field.Root name="required" hint="Entries can’t be saved without this field">
                    <Field.Label>Required field</Field.Label>
                    <Toggle checked={form.required} onLabel="Yes" offLabel="No" onChange={(e: React.ChangeEvent<HTMLInputElement>) => update({ required: e.target.checked })} />
                    <Field.Hint />
                  </Field.Root>
                  {(kind === 'text' || kind === 'number' || kind === 'uid') && (
                    <Field.Root name="unique" hint="No two entries may share this value">
                      <Field.Label>Unique field</Field.Label>
                      <Toggle checked={form.unique} onLabel="Yes" offLabel="No" onChange={(e: React.ChangeEvent<HTMLInputElement>) => update({ unique: e.target.checked })} />
                      <Field.Hint />
                    </Field.Root>
                  )}
                </Flex>
              )}

              {error && <Typography textColor="danger600">{error}</Typography>}
            </Flex>
          )}
        </Modal.Body>

        <Modal.Footer>
          <Button variant="tertiary" onClick={onClose}>
            Cancel
          </Button>
          {kind && (
            <Flex gap={2}>
              {!editing && (
                <Button variant="secondary" onClick={() => submit(true)}>
                  Add another field
                </Button>
              )}
              <Button onClick={() => submit(false)}>Finish</Button>
            </Flex>
          )}
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  );
}

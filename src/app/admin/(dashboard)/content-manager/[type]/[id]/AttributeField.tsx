'use client';

import {
  Box,
  Field,
  Flex,
  IconButton,
  MultiSelect,
  MultiSelectOption,
  NumberInput,
  SingleSelect,
  SingleSelectOption,
  TextInput,
  Textarea,
  Toggle,
  Typography,
} from '@strapi/design-system';
import { Plus, Trash } from '@strapi/icons';
import type { FieldSchema } from '@/lib/content-schema/types';

export interface ComponentDef {
  displayName: string;
  attributes: Record<string, FieldSchema>;
}

export interface RelationOption {
  id: number;
  label: string;
}

export interface AttributeFieldProps {
  name: string;
  field: FieldSchema;
  value: unknown;
  onChange: (value: unknown) => void;
  components: Record<string, ComponentDef>;
  relationOptions: Record<string, RelationOption[]>;
}

function emptyValueFor(attributes: Record<string, FieldSchema>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [name, field] of Object.entries(attributes)) {
    if (field.kind === 'scalar' && field.default !== undefined) result[name] = field.default;
  }
  return result;
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
  return (
    <TextInput
      name={name}
      value={(value as string) ?? ''}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
    />
  );
}

function MediaField({ field, value, onChange }: AttributeFieldProps) {
  if (field.kind !== 'media') return null;
  // Simplification: reference existing already-uploaded files by numeric id rather than a full
  // upload widget — see PROGRESS.md. Shows the current file's URL (if any) for context.
  if (field.multiple) {
    const ids = Array.isArray(value) ? (value as Array<{ id: number; url?: string }>) : [];
    return (
      <Box>
        {ids.map((f, i) => (
          <Typography key={i} tag="div" variant="pi" textColor="neutral600">
            file id {f.id ?? f} {f.url ? `— ${f.url}` : ''}
          </Typography>
        ))}
        <TextInput
          placeholder="Comma-separated file IDs"
          value=""
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            const rawIds = e.target.value
              .split(',')
              .map((s) => parseInt(s.trim(), 10))
              .filter((n) => !Number.isNaN(n));
            onChange(rawIds.map((id) => ({ id })));
          }}
        />
      </Box>
    );
  }
  const current = value as { id: number; url?: string } | null;
  return (
    <Box>
      {current?.url && (
        <Typography tag="div" variant="pi" textColor="neutral600">
          Current: {current.url}
        </Typography>
      )}
      <NumberInput
        placeholder="File ID"
        value={current?.id}
        onValueChange={(v) => onChange(v == null ? null : { id: v })}
      />
    </Box>
  );
}

function RelationField({ value, onChange, options, multi }: { value: unknown; onChange: (v: unknown) => void; options: RelationOption[]; multi: boolean }) {
  if (multi) {
    const selected = (Array.isArray(value) ? value : []).map((v: { id?: number } | number) =>
      String(typeof v === 'object' ? v.id : v),
    );
    return (
      <MultiSelect
        value={selected}
        onChange={(vals: string[]) => onChange(vals.map((v) => parseInt(v, 10)))}
      >
        {options.map((opt) => (
          <MultiSelectOption key={opt.id} value={String(opt.id)}>
            {opt.label}
          </MultiSelectOption>
        ))}
      </MultiSelect>
    );
  }
  const currentId = value && typeof value === 'object' ? (value as { id?: number }).id : value;
  return (
    <SingleSelect
      value={currentId != null ? String(currentId) : undefined}
      onChange={(v) => onChange(v == null ? null : { id: parseInt(String(v), 10) })}
    >
      {options.map((opt) => (
        <SingleSelectOption key={opt.id} value={String(opt.id)}>
          {opt.label}
        </SingleSelectOption>
      ))}
    </SingleSelect>
  );
}

function ComponentSubForm({
  attributes,
  value,
  onChange,
  components,
  relationOptions,
}: {
  attributes: Record<string, FieldSchema>;
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  components: Record<string, ComponentDef>;
  relationOptions: Record<string, RelationOption[]>;
}) {
  return (
    <Box padding={4} background="neutral0" hasRadius borderColor="neutral200" style={{ borderWidth: 1, borderStyle: 'solid' }}>
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
            />
          </Field.Root>
        ))}
      </Flex>
    </Box>
  );
}

function ComponentField({ field, value, onChange, components, relationOptions }: AttributeFieldProps) {
  if (field.kind !== 'component') return null;
  const componentDef = components[field.component];
  if (!componentDef) return <Typography textColor="danger600">Unknown component {field.component}</Typography>;

  if (!field.repeatable) {
    const current = (value as Record<string, unknown>) ?? {};
    return (
      <ComponentSubForm
        attributes={componentDef.attributes}
        value={current}
        onChange={onChange}
        components={components}
        relationOptions={relationOptions}
      />
    );
  }

  const items = (Array.isArray(value) ? value : []) as Record<string, unknown>[];
  return (
    <Flex direction="column" alignItems="stretch" gap={2}>
      {items.map((item, index) => (
        <Flex key={index} gap={2} alignItems="flex-start">
          <Box flex={1}>
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
            />
          </Box>
          <IconButton
            label="Remove"
            onClick={() => onChange(items.filter((_, i) => i !== index))}
          >
            <Trash />
          </IconButton>
        </Flex>
      ))}
      <IconButton label="Add" onClick={() => onChange([...items, emptyValueFor(componentDef.attributes)])}>
        <Plus />
      </IconButton>
    </Flex>
  );
}

function DynamicZoneField({ field, value, onChange, components, relationOptions }: AttributeFieldProps) {
  if (field.kind !== 'dynamiczone') return null;
  const items = (Array.isArray(value) ? value : []) as Array<Record<string, unknown> & { __component: string }>;

  return (
    <Flex direction="column" alignItems="stretch" gap={2}>
      {items.map((item, index) => {
        const componentDef = components[item.__component];
        if (!componentDef) return null;
        return (
          <Box key={index} padding={2} background="neutral150" hasRadius>
            <Flex justifyContent="space-between" alignItems="center" paddingBottom={2}>
              <Typography variant="pi" fontWeight="bold">
                {componentDef.displayName} ({item.__component})
              </Typography>
              <IconButton label="Remove block" onClick={() => onChange(items.filter((_, i) => i !== index))}>
                <Trash />
              </IconButton>
            </Flex>
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
            />
          </Box>
        );
      })}
      <SingleSelect
        placeholder="Add a block…"
        value={undefined}
        onChange={(componentUid) => {
          const componentDef = components[String(componentUid)];
          if (!componentDef) return;
          onChange([...items, { __component: String(componentUid), ...emptyValueFor(componentDef.attributes) }]);
        }}
      >
        {field.components.map((uid) => (
          <SingleSelectOption key={uid} value={uid}>
            {components[uid]?.displayName ?? uid}
          </SingleSelectOption>
        ))}
      </SingleSelect>
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

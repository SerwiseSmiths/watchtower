import {
  BooleanField,
  ComponentField,
  DateField,
  DynamicZoneField,
  EnumerationField,
  JsonField,
  MediaField,
  NumberField,
  RelationField,
  TextField,
  UidField,
} from '@strapi/icons/symbols';
import type { RawAttribute } from '@/lib/content-schema/loader';

/** Field kinds offered by the builder, in Strapi's order. Each maps to one or more raw attribute types. */
export type FieldKind =
  | 'text'
  | 'boolean'
  | 'json'
  | 'number'
  | 'date'
  | 'enumeration'
  | 'media'
  | 'relation'
  | 'uid'
  | 'color'
  | 'component'
  | 'dynamiczone';

export const COLOR_CUSTOM_FIELD = 'plugin::color-picker.color';

export const FIELD_KINDS: { kind: FieldKind; label: string; description: string; Icon: React.ComponentType<{ width?: string; height?: string }> }[] = [
  { kind: 'text', label: 'Text', description: 'Small or long text like title or description', Icon: TextField },
  { kind: 'boolean', label: 'Boolean', description: 'Yes or no, 1 or 0, true or false', Icon: BooleanField },
  { kind: 'json', label: 'JSON', description: 'Data in JSON format', Icon: JsonField },
  { kind: 'number', label: 'Number', description: 'Numbers (integer, decimal)', Icon: NumberField },
  { kind: 'date', label: 'Date', description: 'A date picker with or without time', Icon: DateField },
  { kind: 'enumeration', label: 'Enumeration', description: 'List of values, then pick one', Icon: EnumerationField },
  { kind: 'media', label: 'Media', description: 'Files like images, videos, etc', Icon: MediaField },
  { kind: 'relation', label: 'Relation', description: 'Refers to a collection type', Icon: RelationField },
  { kind: 'uid', label: 'UID', description: 'Unique identifier, e.g. a URL slug', Icon: UidField },
  { kind: 'color', label: 'Color', description: 'Hex color picker', Icon: TextField },
  { kind: 'component', label: 'Component', description: 'Group of fields that you can repeat or reuse', Icon: ComponentField },
  { kind: 'dynamiczone', label: 'Dynamic zone', description: 'Pick and order components (blocks) when editing content', Icon: DynamicZoneField },
];

export function fieldKindOf(attr: RawAttribute): FieldKind {
  switch (attr.type) {
    case 'string':
    case 'text':
      return 'text';
    case 'integer':
    case 'decimal':
      return 'number';
    case 'date':
    case 'datetime':
      return 'date';
    case 'customField':
      return 'color';
    default:
      return attr.type as FieldKind;
  }
}

export function fieldIcon(attr: RawAttribute) {
  return FIELD_KINDS.find((f) => f.kind === fieldKindOf(attr))?.Icon ?? TextField;
}

const RELATION_LABELS: Record<string, string> = {
  oneToOne: 'has one',
  manyToOne: 'many-to-one',
  oneToMany: 'has many',
  manyToMany: 'many-to-many',
};

export const RELATION_KINDS = [
  { value: 'oneToOne', label: 'One-to-one — this entry has one target' },
  { value: 'manyToOne', label: 'Many-to-one — many entries share one target' },
  { value: 'oneToMany', label: 'One-to-many — this entry has many targets' },
  { value: 'manyToMany', label: 'Many-to-many' },
];

/** Short type label shown in the field list, e.g. "Text (long)", "Relation · has many Device Type". */
export function describeAttribute(attr: RawAttribute, nameFor: (uid: string) => string): string {
  switch (attr.type) {
    case 'string':
      return 'Text';
    case 'text':
      return 'Text (long)';
    case 'integer':
      return 'Number (integer)';
    case 'decimal':
      return 'Number (decimal)';
    case 'datetime':
      return 'Date (with time)';
    case 'date':
      return 'Date';
    case 'customField':
      return 'Color';
    case 'media':
      return attr.multiple ? 'Media (multiple)' : 'Media (single)';
    case 'relation':
      return `Relation · ${RELATION_LABELS[attr.relation ?? ''] ?? attr.relation} ${nameFor(attr.target ?? '')}`;
    case 'component':
      return `Component${attr.repeatable ? ' (repeatable)' : ''} · ${nameFor(attr.component ?? '')}`;
    case 'dynamiczone':
      return `Dynamic zone · ${(attr.components ?? []).map(nameFor).join(', ')}`;
    case 'enumeration':
      return `Enumeration · ${(attr.enum ?? []).join(', ')}`;
    case 'uid':
      return attr.targetField ? `UID · from ${attr.targetField}` : 'UID';
    case 'json':
      return 'JSON';
    case 'boolean':
      return 'Boolean';
    default:
      return attr.type;
  }
}

/** Display name → API id ("Promo Banner" → "promo-banner"). */
export function toApiId(displayName: string): string {
  return displayName
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function pluralizeApiId(singular: string): string {
  if (/[^aeiou]y$/.test(singular)) return `${singular.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/.test(singular)) return `${singular}es`;
  return `${singular}s`;
}

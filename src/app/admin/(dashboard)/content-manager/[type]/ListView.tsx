'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import NextLink from 'next/link';
import {
  Badge,
  Box,
  Button,
  Checkbox,
  Dialog,
  EmptyStateLayout,
  Flex,
  IconButton,
  LinkButton,
  NextLink as PaginationNextLink,
  PageLink,
  Pagination,
  Popover,
  PreviousLink,
  SearchForm,
  Searchbar,
  SingleSelect,
  SingleSelectOption,
  Table,
  Tbody,
  Td,
  TextInput,
  Th,
  Thead,
  Tr,
  Typography,
  VisuallyHidden,
} from '@strapi/design-system';
import { CaretDown, Cog, Duplicate, Filter as FilterIcon, Pencil, Plus, Trash } from '@strapi/icons';
import type { FieldSchema, ScalarType } from '@/lib/content-schema/types';
import { bulkDeleteAction, bulkPublishAction, bulkUnpublishAction } from './bulkActions';
import { duplicateEntityAction } from './[id]/actions';
import PageHeader from '../../PageHeader';

interface Row {
  id: number;
  documentId: string;
  isPublished: boolean;
  [key: string]: unknown;
}

export interface FilterCondition {
  field: string;
  operator: string;
  value: string;
}

export interface RelationFilterOption {
  id: number;
  label: string;
}

export interface ListViewProps {
  displayName: string;
  slug: string;
  attributes: Record<string, FieldSchema>;
  draftAndPublish: boolean;
  data: Row[];
  pagination: { page: number; pageSize: number; pageCount: number; total: number };
  query: string;
  sortField: string;
  sortDir: 'asc' | 'desc';
  appliedFilters: FilterCondition[];
  visibleColumns?: string[];
  relationFilterOptions: Record<string, RelationFilterOption[]>;
}

const RELATION_OPERATORS = [{ value: 'relEq', label: 'is' }];

const OPERATORS_BY_TYPE: Record<ScalarType, { value: string; label: string }[]> = {
  string: [
    { value: 'contains', label: 'contains' },
    { value: 'notContains', label: 'does not contain' },
    { value: 'eq', label: 'is' },
    { value: 'notEq', label: 'is not' },
  ],
  text: [
    { value: 'contains', label: 'contains' },
    { value: 'notContains', label: 'does not contain' },
  ],
  uid: [
    { value: 'contains', label: 'contains' },
    { value: 'eq', label: 'is' },
  ],
  integer: [
    { value: 'eq', label: 'is' },
    { value: 'notEq', label: 'is not' },
    { value: 'gt', label: 'is greater than' },
    { value: 'gte', label: 'is greater than or equal to' },
    { value: 'lt', label: 'is lower than' },
    { value: 'lte', label: 'is lower than or equal to' },
  ],
  decimal: [
    { value: 'eq', label: 'is' },
    { value: 'gt', label: 'is greater than' },
    { value: 'lt', label: 'is lower than' },
  ],
  boolean: [{ value: 'eq', label: 'is' }],
  enumeration: [
    { value: 'eq', label: 'is' },
    { value: 'notEq', label: 'is not' },
  ],
  date: [
    { value: 'eq', label: 'is' },
    { value: 'gt', label: 'is after' },
    { value: 'lt', label: 'is before' },
  ],
  datetime: [
    { value: 'eq', label: 'is' },
    { value: 'gt', label: 'is after' },
    { value: 'lt', label: 'is before' },
  ],
  json: [],
};

const RELATION_LABEL_KEYS = ['name', 'title', 'displayName', 'label', 'email'];

function relationLabel(row: Record<string, unknown>): string {
  for (const key of RELATION_LABEL_KEYS) {
    const value = row[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return typeof row.documentId === 'string' ? row.documentId : `#${row.id}`;
}

function formatDate(value: unknown, withTime: boolean): string {
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return '—';
  return withTime ? date.toLocaleString() : date.toLocaleDateString();
}

function renderCell(field: FieldSchema, value: unknown): React.ReactNode {
  if (value == null || (Array.isArray(value) && value.length === 0)) {
    return <Typography textColor="neutral500">—</Typography>;
  }

  if (field.kind === 'scalar') {
    switch (field.type) {
      case 'boolean':
        return <Badge variant={value ? 'success' : 'neutral'}>{value ? 'True' : 'False'}</Badge>;
      case 'enumeration':
        return <Badge variant="secondary">{String(value)}</Badge>;
      case 'date':
        return <Typography>{formatDate(value, false)}</Typography>;
      case 'datetime':
        return <Typography>{formatDate(value, true)}</Typography>;
      case 'json':
        return <Typography textColor="neutral500">{'{…}'}</Typography>;
      default:
        return <Typography ellipsis>{String(value)}</Typography>;
    }
  }

  if (field.kind === 'media') {
    const files = Array.isArray(value) ? value : [value];
    const first = files[0] as Record<string, unknown> | undefined;
    const isImage = typeof first?.mime === 'string' && first.mime.startsWith('image/');
    return (
      <Flex gap={2} alignItems="center">
        {isImage && typeof first?.url === 'string' && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={first.url} alt="" style={{ width: '2.4rem', height: '2.4rem', objectFit: 'cover', borderRadius: '4px' }} />
        )}
        <Typography textColor="neutral600">{files.length} asset{files.length === 1 ? '' : 's'}</Typography>
      </Flex>
    );
  }

  if (field.kind === 'relation') {
    const rows = Array.isArray(value) ? value : [value];
    const visible = rows.slice(0, 2) as Record<string, unknown>[];
    const overflow = rows.length - visible.length;
    return (
      <Flex gap={1} wrap="wrap">
        {visible.map((r, i) => (
          <Badge key={i} variant="neutral">
            {relationLabel(r)}
          </Badge>
        ))}
        {overflow > 0 && <Badge variant="neutral">+{overflow}</Badge>}
      </Flex>
    );
  }

  const count = Array.isArray(value) ? value.length : 1;
  return <Typography textColor="neutral600">{count} item{count === 1 ? '' : 's'}</Typography>;
}

function buildUrl(slug: string, params: Record<string, string | number | undefined>): string {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') usp.set(key, String(value));
  }
  const qs = usp.toString();
  return `/admin/content-manager/${slug}${qs ? `?${qs}` : ''}`;
}

function pageWindow(active: number, count: number): number[] {
  const start = Math.max(1, active - 2);
  const end = Math.min(count, start + 4);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export default function ListView({
  displayName,
  slug,
  attributes,
  draftAndPublish,
  data,
  pagination,
  query,
  sortField,
  sortDir,
  appliedFilters,
  visibleColumns,
  relationFilterOptions,
}: ListViewProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchValue, setSearchValue] = useState(query);
  const [isPending, startTransition] = useTransition();
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ label: string; run: () => void } | null>(null);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);

  const filterableFields = Object.entries(attributes).filter(
    ([, field]) => (field.kind === 'scalar' && field.type !== 'json') || field.kind === 'relation',
  );

  const [draftField, setDraftField] = useState(filterableFields[0]?.[0] ?? '');
  const draftFieldSchema = attributes[draftField];
  const draftOperators =
    draftFieldSchema?.kind === 'relation'
      ? RELATION_OPERATORS
      : draftFieldSchema?.kind === 'scalar'
        ? OPERATORS_BY_TYPE[draftFieldSchema.type]
        : [];
  const [draftOperator, setDraftOperator] = useState(draftOperators[0]?.value ?? 'contains');
  const [draftValue, setDraftValue] = useState('');

  function operatorLabelFor(field: FieldSchema | undefined, operator: string): string {
    const operators = field?.kind === 'relation' ? RELATION_OPERATORS : field?.kind === 'scalar' ? OPERATORS_BY_TYPE[field.type] : [];
    return operators.find((o) => o.value === operator)?.label ?? operator;
  }

  function filterValueLabel(field: FieldSchema | undefined, name: string, value: string): string {
    if (field?.kind === 'relation') {
      return relationFilterOptions[name]?.find((o) => String(o.id) === value)?.label ?? value;
    }
    return value;
  }

  const allColumns = Object.entries(attributes)
    .filter(([, field]) => field.kind === 'scalar' || field.kind === 'media' || field.kind === 'relation')
    .map(([name]) => name);
  const displayColumns =
    visibleColumns && visibleColumns.length > 0 ? allColumns.filter((c) => visibleColumns.includes(c)) : allColumns.slice(0, 6);
  const [columnPopoverOpen, setColumnPopoverOpen] = useState(false);
  const [draftColumns, setDraftColumns] = useState<string[]>(displayColumns);

  const allSelected = data.length > 0 && data.every((r) => selected.has(r.documentId));
  const someSelected = selected.size > 0;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(data.map((r) => r.documentId)));
  }

  function toggleRow(documentId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(documentId)) next.delete(documentId);
      else next.add(documentId);
      return next;
    });
  }

  function navigateWithFilters(overrides: Record<string, string | number | undefined> = {}, nextFilters = appliedFilters) {
    router.push(
      buildUrl(slug, {
        q: query,
        sortField,
        sortDir,
        filters: nextFilters.length > 0 ? JSON.stringify(nextFilters) : undefined,
        columns: visibleColumns && visibleColumns.length > 0 ? visibleColumns.join(',') : undefined,
        ...overrides,
      }),
    );
  }

  function paginationUrl(page: number): string {
    return buildUrl(slug, {
      page,
      q: query,
      sortField,
      sortDir,
      filters: appliedFilters.length > 0 ? JSON.stringify(appliedFilters) : undefined,
      columns: visibleColumns && visibleColumns.length > 0 ? visibleColumns.join(',') : undefined,
    });
  }

  function applyColumns(next: string[]) {
    setColumnPopoverOpen(false);
    navigateWithFilters({ columns: next.length > 0 ? next.join(',') : undefined });
  }

  function handleSort(field: string) {
    const nextDir = sortField === field && sortDir === 'asc' ? 'desc' : 'asc';
    navigateWithFilters({ sortField: field, sortDir: nextDir });
  }

  function handleSearchSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    navigateWithFilters({ q: searchValue });
  }

  function applyFilter() {
    if (!draftField || !draftValue.trim()) return;
    const nextFilters = [...appliedFilters, { field: draftField, operator: draftOperator, value: draftValue.trim() }];
    setDraftValue('');
    setFilterPopoverOpen(false);
    navigateWithFilters({}, nextFilters);
  }

  function removeFilter(index: number) {
    navigateWithFilters(
      {},
      appliedFilters.filter((_, i) => i !== index),
    );
  }

  function runBulk(action: (slug: string, ids: string[]) => Promise<void>) {
    startTransition(async () => {
      await action(slug, Array.from(selected));
      setSelected(new Set());
      router.refresh();
    });
  }

  function runSingleDelete(documentId: string) {
    startTransition(async () => {
      await bulkDeleteAction(slug, [documentId]);
      router.refresh();
    });
  }

  function runDuplicate(documentId: string) {
    startTransition(async () => {
      try {
        const result = await duplicateEntityAction(slug, documentId);
        router.push(`/admin/content-manager/${slug}/${result.documentId}`);
      } catch (err) {
        setDuplicateError(err instanceof Error ? err.message : 'Could not duplicate this entry.');
      }
    });
  }

  const colCount = 1 + displayColumns.length + (draftAndPublish ? 1 : 0) + 1;

  return (
    <Box>
      <PageHeader
        title={displayName}
        subtitle={`${pagination.total} entries found`}
        primaryAction={
          <LinkButton href={`/admin/content-manager/${slug}/new`} startIcon={<Plus />}>
            Create new entry
          </LinkButton>
        }
      />

      <Flex gap={2} alignItems="center" paddingTop={4} paddingBottom={2} wrap="wrap">
        <Box maxWidth="25rem" flex={1}>
          <SearchForm onSubmit={handleSearchSubmit}>
            <Searchbar
              name="q"
              value={searchValue}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchValue(e.target.value)}
              clearLabel="Clear search"
              onClear={() => {
                setSearchValue('');
                navigateWithFilters({ q: '' });
              }}
            >
              Search
            </Searchbar>
          </SearchForm>
        </Box>

        {filterableFields.length > 0 && (
          <Popover.Root open={filterPopoverOpen} onOpenChange={setFilterPopoverOpen}>
            <Popover.Trigger>
              <Button variant="tertiary" startIcon={<FilterIcon />}>
                Filters{appliedFilters.length > 0 ? ` (${appliedFilters.length})` : ''}
              </Button>
            </Popover.Trigger>
            <Popover.Content sideOffset={4}>
              <Box padding={4} width="24rem">
                <Flex direction="column" gap={2} alignItems="stretch">
                  <SingleSelect
                    aria-label="Field"
                    value={draftField}
                    onChange={(value) => {
                      const name = String(value);
                      setDraftField(name);
                      const schema = attributes[name];
                      const operators = schema?.kind === 'relation' ? RELATION_OPERATORS : schema?.kind === 'scalar' ? OPERATORS_BY_TYPE[schema.type] : [];
                      setDraftOperator(operators[0]?.value ?? 'contains');
                      setDraftValue('');
                    }}
                  >
                    {filterableFields.map(([name]) => (
                      <SingleSelectOption key={name} value={name}>
                        {name}
                      </SingleSelectOption>
                    ))}
                  </SingleSelect>

                  <SingleSelect aria-label="Condition" value={draftOperator} onChange={(value) => setDraftOperator(String(value))}>
                    {draftOperators.map((op) => (
                      <SingleSelectOption key={op.value} value={op.value}>
                        {op.label}
                      </SingleSelectOption>
                    ))}
                  </SingleSelect>

                  {draftFieldSchema?.kind === 'relation' ? (
                    <SingleSelect aria-label="Value" value={draftValue} onChange={(value) => setDraftValue(String(value))}>
                      {(relationFilterOptions[draftField] ?? []).map((option) => (
                        <SingleSelectOption key={option.id} value={String(option.id)}>
                          {option.label}
                        </SingleSelectOption>
                      ))}
                    </SingleSelect>
                  ) : draftFieldSchema?.kind === 'scalar' && draftFieldSchema.type === 'boolean' ? (
                    <SingleSelect aria-label="Value" value={draftValue} onChange={(value) => setDraftValue(String(value))}>
                      <SingleSelectOption value="true">True</SingleSelectOption>
                      <SingleSelectOption value="false">False</SingleSelectOption>
                    </SingleSelect>
                  ) : draftFieldSchema?.kind === 'scalar' && draftFieldSchema.type === 'enumeration' ? (
                    <SingleSelect aria-label="Value" value={draftValue} onChange={(value) => setDraftValue(String(value))}>
                      {(draftFieldSchema.enum ?? []).map((option) => (
                        <SingleSelectOption key={option} value={option}>
                          {option}
                        </SingleSelectOption>
                      ))}
                    </SingleSelect>
                  ) : (
                    <TextInput
                      aria-label="Value"
                      type={
                        draftFieldSchema?.kind === 'scalar' && (draftFieldSchema.type === 'date' || draftFieldSchema.type === 'datetime')
                          ? 'date'
                          : 'text'
                      }
                      value={draftValue}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraftValue(e.target.value)}
                    />
                  )}

                  <Button onClick={applyFilter} disabled={!draftValue.trim()}>
                    Add filter
                  </Button>
                </Flex>
              </Box>
            </Popover.Content>
          </Popover.Root>
        )}

        <Popover.Root
          open={columnPopoverOpen}
          onOpenChange={(open) => {
            setColumnPopoverOpen(open);
            if (open) setDraftColumns(displayColumns);
          }}
        >
          <Popover.Trigger>
            <Button variant="tertiary" startIcon={<Cog />}>
              View settings
            </Button>
          </Popover.Trigger>
          <Popover.Content sideOffset={4}>
            <Box padding={4} width="18rem">
              <Typography variant="sigma" textColor="neutral600">
                Displayed fields
              </Typography>
              <Flex direction="column" gap={2} alignItems="stretch" paddingTop={3}>
                {allColumns.map((col) => (
                  <Flex key={col} gap={2} alignItems="center">
                    <Checkbox
                      aria-label={col}
                      checked={draftColumns.includes(col)}
                      onCheckedChange={() =>
                        setDraftColumns((prev) => (prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]))
                      }
                    />
                    <Typography>{col}</Typography>
                  </Flex>
                ))}
              </Flex>
              <Box paddingTop={3}>
                <Button onClick={() => applyColumns(draftColumns)} disabled={draftColumns.length === 0}>
                  Apply
                </Button>
              </Box>
            </Box>
          </Popover.Content>
        </Popover.Root>

        {appliedFilters.map((f, i) => (
          <Badge key={`${f.field}-${i}`} variant="secondary">
            <Flex gap={1} alignItems="center">
              <Typography variant="pi">
                {f.field} {operatorLabelFor(attributes[f.field], f.operator)} {filterValueLabel(attributes[f.field], f.field, f.value)}
              </Typography>
              <button
                type="button"
                onClick={() => removeFilter(i)}
                aria-label={`Remove filter on ${f.field}`}
                style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, lineHeight: 0 }}
              >
                ×
              </button>
            </Flex>
          </Badge>
        ))}
      </Flex>

      {someSelected && (
        <Flex justifyContent="space-between" alignItems="center" padding={3} background="primary100" hasRadius marginBottom={2}>
          <Typography>{selected.size} selected</Typography>
          <Flex gap={2}>
            {draftAndPublish && (
              <>
                <Button
                  variant="tertiary"
                  loading={isPending}
                  onClick={() =>
                    setConfirmAction({ label: `Publish ${selected.size} entries?`, run: () => runBulk(bulkPublishAction) })
                  }
                >
                  Publish
                </Button>
                <Button
                  variant="tertiary"
                  loading={isPending}
                  onClick={() =>
                    setConfirmAction({ label: `Unpublish ${selected.size} entries?`, run: () => runBulk(bulkUnpublishAction) })
                  }
                >
                  Unpublish
                </Button>
              </>
            )}
            <Button
              variant="danger-light"
              loading={isPending}
              onClick={() => setConfirmAction({ label: `Delete ${selected.size} entries?`, run: () => runBulk(bulkDeleteAction) })}
            >
              Delete
            </Button>
          </Flex>
        </Flex>
      )}

      {data.length === 0 ? (
        <EmptyStateLayout
          content="No content found"
          action={
            <LinkButton href={`/admin/content-manager/${slug}/new`} variant="secondary" startIcon={<Plus />}>
              Create new entry
            </LinkButton>
          }
        />
      ) : (
        <>
          <Table colCount={colCount} rowCount={data.length + 1}>
            <Thead>
              <Tr>
                <Th>
                  <Checkbox aria-label="Select all entries" checked={allSelected} onCheckedChange={toggleAll} />
                </Th>
                {displayColumns.map((col) => (
                  <Th key={col}>
                    <button
                      type="button"
                      onClick={() => handleSort(col)}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      <Typography variant="sigma">{col}</Typography>
                      {sortField === col && (
                        <span style={{ display: 'inline-flex', transform: sortDir === 'asc' ? 'rotate(180deg)' : undefined }}>
                          <CaretDown width="0.8rem" height="0.8rem" />
                        </span>
                      )}
                    </button>
                  </Th>
                ))}
                {draftAndPublish && (
                  <Th>
                    <Typography variant="sigma">Status</Typography>
                  </Th>
                )}
                <Th>
                  <VisuallyHidden>Actions</VisuallyHidden>
                </Th>
              </Tr>
            </Thead>
            <Tbody>
              {data.map((row) => (
                <Tr
                  key={row.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => router.push(`/admin/content-manager/${slug}/${row.documentId}`)}
                >
                  <Td onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                    <Checkbox
                      aria-label={`Select ${row.documentId}`}
                      checked={selected.has(row.documentId)}
                      onCheckedChange={() => toggleRow(row.documentId)}
                    />
                  </Td>
                  {displayColumns.map((col) => (
                    <Td key={col}>{renderCell(attributes[col], row[col])}</Td>
                  ))}
                  {draftAndPublish && (
                    <Td>
                      <Badge active={row.isPublished}>{row.isPublished ? 'Published' : 'Draft'}</Badge>
                    </Td>
                  )}
                  <Td onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                    <Flex gap={1}>
                      <IconButton tag={NextLink} href={`/admin/content-manager/${slug}/${row.documentId}`} label="Edit">
                        <Pencil />
                      </IconButton>
                      <IconButton label="Duplicate" variant="ghost" onClick={() => runDuplicate(row.documentId)}>
                        <Duplicate />
                      </IconButton>
                      <IconButton
                        label="Delete"
                        variant="ghost"
                        onClick={() =>
                          setConfirmAction({ label: 'Delete this entry?', run: () => runSingleDelete(row.documentId) })
                        }
                      >
                        <Trash />
                      </IconButton>
                    </Flex>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>

          <Box paddingTop={4}>
            <Pagination activePage={pagination.page} pageCount={pagination.pageCount} label={`${displayName} pagination`}>
              <Flex gap={1}>
                {pagination.page > 1 && (
                  <PreviousLink tag={NextLink} href={paginationUrl(pagination.page - 1)}>
                    Previous
                  </PreviousLink>
                )}
                {pageWindow(pagination.page, pagination.pageCount).map((p) => (
                  <PageLink key={p} number={p} tag={NextLink} href={paginationUrl(p)}>
                    {p}
                  </PageLink>
                ))}
                {pagination.page < pagination.pageCount && (
                  <PaginationNextLink tag={NextLink} href={paginationUrl(pagination.page + 1)}>
                    Next
                  </PaginationNextLink>
                )}
              </Flex>
            </Pagination>
          </Box>
        </>
      )}

      <Dialog.Root open={duplicateError != null} onOpenChange={(open) => !open && setDuplicateError(null)}>
        <Dialog.Content>
          <Dialog.Header>Duplication failed</Dialog.Header>
          <Dialog.Body>{duplicateError}</Dialog.Body>
          <Dialog.Footer>
            <Dialog.Cancel>
              <Button variant="tertiary">Close</Button>
            </Dialog.Cancel>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Root>

      <Dialog.Root open={confirmAction != null} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <Dialog.Content>
          <Dialog.Header>Confirmation</Dialog.Header>
          <Dialog.Body>{confirmAction?.label}</Dialog.Body>
          <Dialog.Footer>
            <Dialog.Cancel>
              <Button variant="tertiary">Cancel</Button>
            </Dialog.Cancel>
            <Dialog.Action>
              <Button
                variant="danger-light"
                onClick={() => {
                  confirmAction?.run();
                  setConfirmAction(null);
                }}
              >
                Confirm
              </Button>
            </Dialog.Action>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Root>
    </Box>
  );
}

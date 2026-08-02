'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import NextLink from 'next/link';
import {
  Badge,
  Box,
  Button,
  Checkbox,
  EmptyStateLayout,
  Flex,
  IconButton,
  LinkButton,
  NextLink as PaginationNextLink,
  PageLink,
  Pagination,
  PreviousLink,
  SearchForm,
  Searchbar,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  Typography,
  VisuallyHidden,
} from '@strapi/design-system';
import { CaretDown, Pencil, Plus } from '@strapi/icons';
import type { FieldSchema } from '@/lib/content-schema/types';
import { bulkDeleteAction, bulkPublishAction, bulkUnpublishAction } from './bulkActions';

interface Row {
  id: number;
  documentId: string;
  isPublished: boolean;
  [key: string]: unknown;
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
}

function formatCell(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'object') return Array.isArray(value) ? `${value.length} item(s)` : '(object)';
  return String(value);
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
}: ListViewProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchValue, setSearchValue] = useState(query);
  const [isPending, startTransition] = useTransition();

  const scalarColumns = Object.entries(attributes)
    .filter(([, field]) => field.kind === 'scalar')
    .slice(0, 6)
    .map(([name]) => name);

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

  function handleSort(field: string) {
    const nextDir = sortField === field && sortDir === 'asc' ? 'desc' : 'asc';
    router.push(buildUrl(slug, { q: query, sortField: field, sortDir: nextDir }));
  }

  function handleSearchSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    router.push(buildUrl(slug, { q: searchValue, sortField, sortDir }));
  }

  function runBulk(action: (slug: string, ids: string[]) => Promise<void>) {
    startTransition(async () => {
      await action(slug, Array.from(selected));
      setSelected(new Set());
      router.refresh();
    });
  }

  const colCount = 1 + scalarColumns.length + (draftAndPublish ? 1 : 0) + 1;

  return (
    <Box>
      <Flex justifyContent="space-between" alignItems="flex-start" paddingBottom={2}>
        <Box>
          <Typography variant="alpha" tag="h1">
            {displayName}
          </Typography>
          <Typography textColor="neutral600">{pagination.total} entries found</Typography>
        </Box>
        <LinkButton href={`/admin/content-manager/${slug}/new`} startIcon={<Plus />}>
          Create new entry
        </LinkButton>
      </Flex>

      <Box paddingTop={4} paddingBottom={4} maxWidth="25rem">
        <SearchForm onSubmit={handleSearchSubmit}>
          <Searchbar
            name="q"
            value={searchValue}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchValue(e.target.value)}
            clearLabel="Clear search"
            onClear={() => {
              setSearchValue('');
              router.push(buildUrl(slug, { sortField, sortDir }));
            }}
          >
            Search
          </Searchbar>
        </SearchForm>
      </Box>

      {someSelected && (
        <Flex justifyContent="space-between" alignItems="center" padding={3} background="primary100" hasRadius marginBottom={2}>
          <Typography>{selected.size} selected</Typography>
          <Flex gap={2}>
            {draftAndPublish && (
              <>
                <Button variant="tertiary" onClick={() => runBulk(bulkPublishAction)} loading={isPending}>
                  Publish
                </Button>
                <Button variant="tertiary" onClick={() => runBulk(bulkUnpublishAction)} loading={isPending}>
                  Unpublish
                </Button>
              </>
            )}
            <Button variant="danger-light" onClick={() => runBulk(bulkDeleteAction)} loading={isPending}>
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
                {scalarColumns.map((col) => (
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
                  {scalarColumns.map((col) => (
                    <Td key={col}>
                      <Typography ellipsis>{formatCell(row[col])}</Typography>
                    </Td>
                  ))}
                  {draftAndPublish && (
                    <Td>
                      <Badge active={row.isPublished}>{row.isPublished ? 'Published' : 'Draft'}</Badge>
                    </Td>
                  )}
                  <Td onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                    <IconButton tag={NextLink} href={`/admin/content-manager/${slug}/${row.documentId}`} label="Edit">
                      <Pencil />
                    </IconButton>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>

          <Box paddingTop={4}>
            <Pagination activePage={pagination.page} pageCount={pagination.pageCount} label={`${displayName} pagination`}>
              <Flex gap={1}>
                {pagination.page > 1 && (
                  <PreviousLink tag={NextLink} href={buildUrl(slug, { page: pagination.page - 1, q: query, sortField, sortDir })}>
                    Previous
                  </PreviousLink>
                )}
                {pageWindow(pagination.page, pagination.pageCount).map((p) => (
                  <PageLink key={p} number={p} tag={NextLink} href={buildUrl(slug, { page: p, q: query, sortField, sortDir })}>
                    {p}
                  </PageLink>
                ))}
                {pagination.page < pagination.pageCount && (
                  <PaginationNextLink tag={NextLink} href={buildUrl(slug, { page: pagination.page + 1, q: query, sortField, sortDir })}>
                    Next
                  </PaginationNextLink>
                )}
              </Flex>
            </Pagination>
          </Box>
        </>
      )}
    </Box>
  );
}

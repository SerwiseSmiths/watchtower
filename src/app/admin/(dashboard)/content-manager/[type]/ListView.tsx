'use client';

import NextLink from 'next/link';
import {
  Badge,
  Box,
  Flex,
  LinkButton,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  Typography,
} from '@strapi/design-system';
import { Plus } from '@strapi/icons';
import type { FieldSchema } from '@/lib/content-schema/types';

interface Row {
  id: number;
  documentId: string;
  publishedAt: string | null;
  [key: string]: unknown;
}

export interface ListViewProps {
  displayName: string;
  slug: string;
  attributes: Record<string, FieldSchema>;
  draftAndPublish: boolean;
  data: Row[];
  pagination: { page: number; pageSize: number; pageCount: number; total: number };
}

function formatCell(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'object') return Array.isArray(value) ? `${value.length} item(s)` : '(object)';
  return String(value);
}

export default function ListView({ displayName, slug, attributes, draftAndPublish, data, pagination }: ListViewProps) {
  const scalarColumns = Object.entries(attributes)
    .filter(([, field]) => field.kind === 'scalar')
    .slice(0, 6)
    .map(([name]) => name);

  return (
    <Box>
      <Flex justifyContent="space-between" alignItems="center" paddingBottom={6}>
        <Typography variant="alpha" tag="h1">
          {displayName}
        </Typography>
        <LinkButton href={`/admin/content-manager/${slug}/new`} startIcon={<Plus />}>
          Create new entry
        </LinkButton>
      </Flex>

      <Table colCount={scalarColumns.length + (draftAndPublish ? 3 : 2)} rowCount={data.length + 1}>
        <Thead>
          <Tr>
            <Th>
              <Typography variant="sigma">ID</Typography>
            </Th>
            {scalarColumns.map((col) => (
              <Th key={col}>
                <Typography variant="sigma">{col}</Typography>
              </Th>
            ))}
            {draftAndPublish && (
              <Th>
                <Typography variant="sigma">Status</Typography>
              </Th>
            )}
            <Th>
              <Typography variant="sigma">Actions</Typography>
            </Th>
          </Tr>
        </Thead>
        <Tbody>
          {data.length === 0 && (
            <Tr>
              <Td colSpan={scalarColumns.length + (draftAndPublish ? 3 : 2)}>
                <Typography textColor="neutral600">No entries yet.</Typography>
              </Td>
            </Tr>
          )}
          {data.map((row) => (
            <Tr key={row.id}>
              <Td>
                <Typography>{row.id}</Typography>
              </Td>
              {scalarColumns.map((col) => (
                <Td key={col}>
                  <Typography ellipsis>{formatCell(row[col])}</Typography>
                </Td>
              ))}
              {draftAndPublish && (
                <Td>
                  <Badge active={!!row.publishedAt}>{row.publishedAt ? 'Published' : 'Draft'}</Badge>
                </Td>
              )}
              <Td>
                <NextLink href={`/admin/content-manager/${slug}/${row.documentId}`}>Edit</NextLink>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      <Box paddingTop={4}>
        <Flex gap={2}>
          {pagination.page > 1 && (
            <NextLink href={`/admin/content-manager/${slug}?page=${pagination.page - 1}`}>Previous</NextLink>
          )}
          <Typography>
            Page {pagination.page} of {pagination.pageCount} ({pagination.total} total)
          </Typography>
          {pagination.page < pagination.pageCount && (
            <NextLink href={`/admin/content-manager/${slug}?page=${pagination.page + 1}`}>Next</NextLink>
          )}
        </Flex>
      </Box>
    </Box>
  );
}

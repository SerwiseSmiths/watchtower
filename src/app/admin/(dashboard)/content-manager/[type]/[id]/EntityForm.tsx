'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Button,
  Dialog,
  Divider,
  Field,
  Flex,
  Grid,
  IconButton,
  MenuItem,
  SimpleMenu,
  Status,
  Typography,
} from '@strapi/design-system';
import { More } from '@strapi/icons';
import type { FieldSchema } from '@/lib/content-schema/types';
import AttributeField, { type ComponentDef, type MediaLibraryFile, type RelationOption } from './AttributeField';
import { deleteEntityAction, duplicateEntityAction, publishEntityAction, saveEntityAction, unpublishEntityAction } from './actions';
import PageHeader from '../../../PageHeader';

export type DocumentStatus = 'draft' | 'published' | 'modified';

export interface EntityFormProps {
  slug: string;
  id: string;
  displayName: string;
  attributes: Record<string, FieldSchema>;
  draftAndPublish: boolean;
  entity: Record<string, unknown> | null;
  documentStatus: DocumentStatus;
  isSingleType: boolean;
  authors: { createdBy: string | null; updatedBy: string | null };
  components: Record<string, ComponentDef>;
  relationOptions: Record<string, RelationOption[]>;
  mediaLibrary: MediaLibraryFile[];
}

const LABEL_FIELD_CANDIDATES = ['name', 'title', 'label', 'key'];

function labelFor(row: Record<string, unknown>, fallback: string): string {
  for (const field of LABEL_FIELD_CANDIDATES) {
    if (typeof row[field] === 'string' && row[field]) return row[field] as string;
  }
  return fallback;
}

function formatTimestamp(value: unknown): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

const STATUS_CONFIG: Record<DocumentStatus, { label: string; variant: 'neutral' | 'success' | 'alternative' }> = {
  draft: { label: 'Draft', variant: 'neutral' },
  published: { label: 'Published', variant: 'success' },
  modified: { label: 'Modified', variant: 'alternative' },
};

export default function EntityForm({
  slug,
  id,
  displayName,
  attributes,
  draftAndPublish,
  entity,
  documentStatus,
  isSingleType,
  authors,
  components,
  relationOptions,
  mediaLibrary,
}: EntityFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState<Record<string, unknown>>(entity ?? {});
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);

  const isNew = id === 'new';
  const isPublished = !!formData.publishedAt;
  const title = isNew ? `Create an entry` : labelFor(formData, displayName);
  const status = STATUS_CONFIG[isNew ? 'draft' : documentStatus];

  function handleSave() {
    startTransition(async () => {
      try {
        const result = await saveEntityAction(slug, id, formData);
        setMessage('Saved.');
        if (id === 'new') {
          router.push(`/admin/content-manager/${slug}/${result.documentId}`);
        } else {
          router.refresh();
        }
      } catch (err) {
        setMessage(err instanceof Error ? err.message : 'Save failed');
      }
    });
  }

  function handlePublish() {
    startTransition(async () => {
      try {
        await publishEntityAction(slug, id);
        setMessage('Published.');
        router.refresh();
      } catch (err) {
        setMessage(err instanceof Error ? err.message : 'Publish failed');
      }
    });
  }

  function handleUnpublish() {
    startTransition(async () => {
      try {
        await unpublishEntityAction(slug, id);
        setMessage('Unpublished.');
        router.refresh();
      } catch (err) {
        setMessage(err instanceof Error ? err.message : 'Unpublish failed');
      }
    });
  }

  function handleDuplicate() {
    startTransition(async () => {
      try {
        const result = await duplicateEntityAction(slug, id);
        router.push(`/admin/content-manager/${slug}/${result.documentId}`);
      } catch (err) {
        setDuplicateError(err instanceof Error ? err.message : 'Could not duplicate this entry.');
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteEntityAction(slug, id);
        router.push(`/admin/content-manager/${slug}`);
      } catch (err) {
        setMessage(err instanceof Error ? err.message : 'Delete failed');
        setConfirmDelete(false);
      }
    });
  }

  return (
    <Box>
      <PageHeader
        title={title}
        backHref={`/admin/content-manager/${slug}`}
        status={
          draftAndPublish && (
            <Status variant={status.variant} size="S">
              <Typography variant="omega" fontWeight="bold">
                {status.label}
              </Typography>
            </Status>
          )
        }
        secondaryActions={
          <>
            {!isNew && (
              <SimpleMenu tag={IconButton} label="More document actions" icon={<More />}>
                {!isSingleType && <MenuItem onSelect={handleDuplicate}>Duplicate entry</MenuItem>}
                <MenuItem onSelect={() => setConfirmDelete(true)}>Delete entry</MenuItem>
              </SimpleMenu>
            )}
            {draftAndPublish &&
              !isNew &&
              (isPublished ? (
                <Button variant="tertiary" onClick={handleUnpublish} loading={isPending}>
                  Unpublish
                </Button>
              ) : (
                <Button variant="secondary" onClick={handlePublish} loading={isPending}>
                  Publish
                </Button>
              ))}
          </>
        }
        primaryAction={
          <Button onClick={handleSave} loading={isPending}>
            Save
          </Button>
        }
      />

      {message && (
        <Box paddingBottom={4}>
          <Typography textColor="neutral600">{message}</Typography>
        </Box>
      )}

      <Grid.Root gap={4}>
        <Grid.Item col={8} s={12} direction="column" alignItems="stretch">
          <Flex direction="column" alignItems="stretch" gap={6}>
            {Object.entries(attributes).map(([name, field]) => (
              <Field.Root key={name} name={name} required={'required' in field ? field.required : false}>
                <Field.Label>{name}</Field.Label>
                <AttributeField
                  name={name}
                  field={field}
                  value={formData[name]}
                  onChange={(value) => setFormData((prev) => ({ ...prev, [name]: value }))}
                  components={components}
                  relationOptions={relationOptions}
                  mediaLibrary={mediaLibrary}
                />
              </Field.Root>
            ))}
          </Flex>
        </Grid.Item>

        <Grid.Item col={4} s={12} direction="column" alignItems="stretch">
          <Box background="neutral0" hasRadius borderColor="neutral150" padding={4} style={{ borderWidth: 1, borderStyle: 'solid' }}>
            <Typography variant="sigma" textColor="neutral600">
              Information
            </Typography>
            <Box paddingTop={3} paddingBottom={3}>
              <Divider />
            </Box>
            <Flex direction="column" alignItems="stretch" gap={3}>
              <Flex direction="column" gap={1} alignItems="flex-start">
                <Typography variant="pi" fontWeight="bold" textColor="neutral600">
                  Document ID
                </Typography>
                <Typography variant="pi">{isNew ? 'Not saved yet' : String(formData.documentId ?? '—')}</Typography>
              </Flex>
              <Flex direction="column" gap={1} alignItems="flex-start">
                <Typography variant="pi" fontWeight="bold" textColor="neutral600">
                  Created
                </Typography>
                <Typography variant="pi">
                  {formatTimestamp(formData.createdAt)}
                  {authors.createdBy ? ` by ${authors.createdBy}` : ''}
                </Typography>
              </Flex>
              <Flex direction="column" gap={1} alignItems="flex-start">
                <Typography variant="pi" fontWeight="bold" textColor="neutral600">
                  Last updated
                </Typography>
                <Typography variant="pi">
                  {formatTimestamp(formData.updatedAt)}
                  {authors.updatedBy ? ` by ${authors.updatedBy}` : ''}
                </Typography>
              </Flex>
              {draftAndPublish && (
                <Flex direction="column" gap={1} alignItems="flex-start">
                  <Typography variant="pi" fontWeight="bold" textColor="neutral600">
                    Published
                  </Typography>
                  <Typography variant="pi">{isPublished ? formatTimestamp(formData.publishedAt) : 'Not published'}</Typography>
                </Flex>
              )}
            </Flex>
          </Box>
        </Grid.Item>
      </Grid.Root>

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

      <Dialog.Root open={confirmDelete} onOpenChange={setConfirmDelete}>
        <Dialog.Content>
          <Dialog.Header>Confirmation</Dialog.Header>
          <Dialog.Body>Delete this entry? This action cannot be undone.</Dialog.Body>
          <Dialog.Footer>
            <Dialog.Cancel>
              <Button variant="tertiary">Cancel</Button>
            </Dialog.Cancel>
            <Dialog.Action>
              <Button variant="danger-light" onClick={handleDelete} loading={isPending}>
                Confirm
              </Button>
            </Dialog.Action>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Root>
    </Box>
  );
}

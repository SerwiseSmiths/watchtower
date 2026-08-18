'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Button, Field, Flex, Typography } from '@strapi/design-system';
import type { FieldSchema } from '@/lib/content-schema/types';
import AttributeField, { type ComponentDef, type MediaLibraryFile, type RelationOption } from './AttributeField';
import { publishEntityAction, saveEntityAction, unpublishEntityAction } from './actions';

export interface EntityFormProps {
  slug: string;
  id: string;
  displayName: string;
  attributes: Record<string, FieldSchema>;
  draftAndPublish: boolean;
  entity: Record<string, unknown> | null;
  components: Record<string, ComponentDef>;
  relationOptions: Record<string, RelationOption[]>;
  mediaLibrary: MediaLibraryFile[];
}

export default function EntityForm({
  slug,
  id,
  displayName,
  attributes,
  draftAndPublish,
  entity,
  components,
  relationOptions,
  mediaLibrary,
}: EntityFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState<Record<string, unknown>>(entity ?? {});
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const isPublished = !!formData.publishedAt;

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

  return (
    <Box>
      <Flex justifyContent="space-between" alignItems="center" paddingBottom={6}>
        <Typography variant="alpha" tag="h1">
          {displayName}
        </Typography>
        <Flex gap={2}>
          {draftAndPublish && id !== 'new' && (
            <>
              {isPublished ? (
                <Button variant="tertiary" onClick={handleUnpublish} loading={isPending}>
                  Unpublish
                </Button>
              ) : (
                <Button variant="secondary" onClick={handlePublish} loading={isPending}>
                  Publish
                </Button>
              )}
            </>
          )}
          <Button onClick={handleSave} loading={isPending}>
            Save
          </Button>
        </Flex>
      </Flex>

      {message && (
        <Box paddingBottom={4}>
          <Typography textColor="neutral600">{message}</Typography>
        </Box>
      )}

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
    </Box>
  );
}

'use client';

import { Box, Flex, Grid, Typography } from '@strapi/design-system';

export interface MediaLibraryFileRow {
  id: number;
  url: string | null;
  name: string | null;
  mime: string | null;
  ext: string | null;
  alternativeText: string | null;
}

export default function MediaLibraryView({ files }: { files: MediaLibraryFileRow[] }) {
  return (
    <Box>
      <Typography variant="alpha" tag="h1">
        Media Library
      </Typography>
      <Box paddingTop={2} paddingBottom={6}>
        <Typography textColor="neutral600">
          {files.length} file(s). Uploads go through the same Cloudinary account console uses — upload flow
          is not wired up in this panel yet (see PROGRESS.md); pick from these existing files via a content
          entry&apos;s media field.
        </Typography>
      </Box>

      <Grid.Root gap={4}>
        {files.map((file) => (
          <Grid.Item key={file.id} col={3} s={6} xs={12}>
            <Box background="neutral0" padding={2} hasRadius borderColor="neutral200" style={{ borderWidth: 1, borderStyle: 'solid' }}>
              {file.mime?.startsWith('image/') && file.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={file.url} alt={file.alternativeText ?? file.name ?? ''} style={{ width: '100%', height: 120, objectFit: 'cover' }} />
              ) : (
                <Flex height="120px" alignItems="center" justifyContent="center" background="neutral100">
                  <Typography variant="pi">{file.ext}</Typography>
                </Flex>
              )}
              <Box paddingTop={2}>
                <Typography variant="pi" ellipsis>
                  {file.name}
                </Typography>
                <Typography variant="pi" textColor="neutral600">
                  id: {file.id}
                </Typography>
              </Box>
            </Box>
          </Grid.Item>
        ))}
      </Grid.Root>
    </Box>
  );
}

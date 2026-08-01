import { Box, Flex, Grid, Typography } from '@strapi/design-system';
import { prisma } from '@/lib/db/prisma';

export default async function MediaLibraryPage() {
  const files = await prisma.files.findMany({ orderBy: { created_at: 'desc' }, take: 100 });

  return (
    <Box>
      <Typography variant="alpha" tag="h1">
        Media Library
      </Typography>
      <Box paddingTop={2} paddingBottom={6}>
        <Typography textColor="neutral600">
          {files.length} file(s). Uploads go through the same Cloudinary account console uses — upload flow
          is not wired up in this panel yet (see PROGRESS.md); reference existing files by ID from a
          content entry&apos;s media field for now.
        </Typography>
      </Box>

      <Grid.Root gap={4}>
        {files.map((file) => (
          <Grid.Item key={file.id} col={3} s={6} xs={12}>
            <Box background="neutral0" padding={2} hasRadius borderColor="neutral200" style={{ borderWidth: 1, borderStyle: 'solid' }}>
              {file.mime?.startsWith('image/') && file.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={file.url} alt={file.alternative_text ?? file.name ?? ''} style={{ width: '100%', height: 120, objectFit: 'cover' }} />
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

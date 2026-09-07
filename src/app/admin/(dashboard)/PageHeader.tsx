'use client';

import NextLink from 'next/link';
import { Box, Flex, IconButton, Typography } from '@strapi/design-system';
import { ArrowLeft } from '@strapi/icons';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backHref?: string;
  status?: React.ReactNode;
  primaryAction?: React.ReactNode;
  secondaryActions?: React.ReactNode;
}

/** Strapi's real admin has no exported `HeaderLayout` in `@strapi/design-system` (it lives inside
 * `@strapi/admin`, which isn't a public component library) — this mirrors its title/subtitle/
 * back-button/primary-action structure so every `/admin` page composes its header the same way. */
export default function PageHeader({ title, subtitle, backHref, status, primaryAction, secondaryActions }: PageHeaderProps) {
  return (
    <Flex justifyContent="space-between" alignItems="flex-start" paddingBottom={subtitle ? 2 : 4}>
      <Flex gap={3} alignItems={subtitle ? 'center' : 'flex-start'}>
        {backHref && (
          <IconButton tag={NextLink} href={backHref} label="Back">
            <ArrowLeft />
          </IconButton>
        )}
        <Box>
          <Flex gap={2} alignItems="center">
            <Typography variant="alpha" tag="h1">
              {title}
            </Typography>
            {status}
          </Flex>
          {subtitle && <Typography textColor="neutral600">{subtitle}</Typography>}
        </Box>
      </Flex>
      <Flex gap={2}>
        {secondaryActions}
        {primaryAction}
      </Flex>
    </Flex>
  );
}

'use client';

import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import { Avatar, Box, Flex, IconButton, MenuItem, SimpleMenu, Tooltip, Typography } from '@strapi/design-system';
import { Stack, Image, Key } from '@strapi/icons';
import { logoutAction } from '../login/actions';

const NAV_WIDTH = '5.6rem';

interface NavIconLinkProps {
  href: string;
  label: string;
  active: boolean;
  children: React.ReactNode;
}

function NavIconLink({ href, label, active, children }: NavIconLinkProps) {
  return (
    <Tooltip label={label} side="right">
      <Flex tag="li" style={{ listStyle: 'none' }}>
        <IconButton
          tag={NextLink}
          href={href}
          label={label}
          variant={active ? 'secondary' : 'ghost'}
          style={{ width: '4.6rem', height: '4.6rem' }}
        >
          {children}
        </IconButton>
      </Flex>
    </Tooltip>
  );
}

export default function GlobalNavRail({ userInitials }: { userInitials: string }) {
  const pathname = usePathname();

  return (
    <Flex
      tag="nav"
      aria-label="Main navigation"
      direction="column"
      alignItems="center"
      justifyContent="space-between"
      background="neutral0"
      borderColor="neutral150"
      width={NAV_WIDTH}
      minHeight="100vh"
      paddingTop={3}
      paddingBottom={3}
      style={{ borderRightWidth: 1, borderRightStyle: 'solid', flexShrink: 0 }}
    >
      <Flex direction="column" alignItems="center" gap={4} tag="ul" style={{ width: '100%', padding: 0 }}>
        <Box paddingBottom={2}>
          <Flex
            width="3.2rem"
            height="3.2rem"
            hasRadius
            background="primary600"
            alignItems="center"
            justifyContent="center"
          >
            <Typography variant="omega" fontWeight="bold" textColor="neutral0">
              W
            </Typography>
          </Flex>
        </Box>

        <NavIconLink href="/admin/content-manager" label="Content Manager" active={pathname?.startsWith('/admin/content-manager') ?? false}>
          <Stack width="2rem" height="2rem" fill={pathname?.startsWith('/admin/content-manager') ? 'primary600' : 'neutral500'} />
        </NavIconLink>
        <NavIconLink href="/admin/media-library" label="Media Library" active={pathname?.startsWith('/admin/media-library') ?? false}>
          <Image width="2rem" height="2rem" fill={pathname?.startsWith('/admin/media-library') ? 'primary600' : 'neutral500'} />
        </NavIconLink>
        <NavIconLink href="/admin/operators" label="Operators" active={pathname?.startsWith('/admin/operators') ?? false}>
          <Key width="2rem" height="2rem" fill={pathname?.startsWith('/admin/operators') ? 'primary600' : 'neutral500'} />
        </NavIconLink>
      </Flex>

      <SimpleMenu
        tag={IconButton}
        label="User menu"
        icon={<Avatar.Item delayMs={0} fallback={userInitials} />}
      >
        <MenuItem onSelect={() => {}} disabled>
          Signed in
        </MenuItem>
        <MenuItem onSelect={() => logoutAction()}>Sign out</MenuItem>
      </SimpleMenu>
    </Flex>
  );
}

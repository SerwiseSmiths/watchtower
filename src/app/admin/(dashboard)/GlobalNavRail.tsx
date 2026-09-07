'use client';

import { useSyncExternalStore } from 'react';
import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import { Avatar, Box, Flex, IconButton, MenuItem, SimpleMenu, Tooltip, Typography } from '@strapi/design-system';
import { ChevronLeft, ChevronRight, Stack, Image, Key, User } from '@strapi/icons';
import { logoutAction } from '../login/actions';

const COLLAPSED_WIDTH = '7.4rem';
const EXPANDED_WIDTH = '15rem';
const STORAGE_KEY = 'watchtower_nav_expanded';

// A tiny external store over localStorage: `useSyncExternalStore` renders `getServerSnapshot`
// (false) during SSR/hydration, then flips to the real preference right after — the
// React-sanctioned way to read a browser-only value without a setState-in-effect hydration
// mismatch or lint violation.
const navExpandedListeners = new Set<() => void>();

function getNavExpandedSnapshot(): boolean {
  return window.localStorage.getItem(STORAGE_KEY) === '1';
}

function getNavExpandedServerSnapshot(): boolean {
  return false;
}

function subscribeNavExpanded(listener: () => void): () => void {
  navExpandedListeners.add(listener);
  return () => navExpandedListeners.delete(listener);
}

function setNavExpanded(value: boolean): void {
  window.localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
  navExpandedListeners.forEach((listener) => listener());
}

interface NavLinkProps {
  href: string;
  label: string;
  active: boolean;
  expanded: boolean;
  children: React.ReactNode;
}

function NavLink({ href, label, active, expanded, children }: NavLinkProps) {
  const link = (
    <Box
      tag={NextLink}
      href={href}
      aria-label={label}
      hasRadius
      background={active ? 'primary100' : 'transparent'}
      style={
        expanded
          ? { display: 'flex', alignItems: 'center', gap: '0.8rem', width: '100%', height: '4rem', padding: '0 1.2rem', transition: 'background-color 120ms ease' }
          : { width: '4.6rem', height: '4.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 120ms ease' }
      }
    >
      {children}
      {expanded && (
        <Typography textColor={active ? 'primary600' : 'neutral700'} fontWeight={active ? 'bold' : 'regular'}>
          {label}
        </Typography>
      )}
    </Box>
  );

  return (
    <Flex tag="li" style={{ listStyle: 'none', width: '100%' }} justifyContent="center">
      {expanded ? link : <Tooltip label={label} side="right">{link}</Tooltip>}
    </Flex>
  );
}

export default function GlobalNavRail({ userInitials }: { userInitials: string }) {
  const pathname = usePathname();
  const isExpanded = useSyncExternalStore(subscribeNavExpanded, getNavExpandedSnapshot, getNavExpandedServerSnapshot);

  function toggleExpanded() {
    setNavExpanded(!isExpanded);
  }

  return (
    <Flex
      tag="nav"
      aria-label="Main navigation"
      direction="column"
      alignItems="center"
      justifyContent="space-between"
      background="neutral0"
      borderColor="neutral150"
      width={isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH}
      minHeight="100vh"
      paddingBottom={3}
      style={{ borderRightWidth: 1, borderRightStyle: 'solid', flexShrink: 0, transition: 'width 150ms ease' }}
    >
      <Flex direction="column" alignItems="stretch" style={{ width: '100%' }}>
        <Flex
          tag={NextLink}
          href="/admin/content-manager"
          aria-label="Home"
          width="100%"
          height="5.6rem"
          alignItems="center"
          justifyContent={isExpanded ? 'flex-start' : 'center'}
          gap={3}
          paddingLeft={isExpanded ? 4 : 0}
          borderColor="neutral150"
          style={{ borderBottomWidth: 1, borderBottomStyle: 'solid', flexShrink: 0 }}
        >
          <Flex
            width="3.2rem"
            height="3.2rem"
            hasRadius
            background="primary600"
            alignItems="center"
            justifyContent="center"
            style={{ flexShrink: 0 }}
          >
            <Typography variant="omega" fontWeight="bold" textColor="neutral0">
              W
            </Typography>
          </Flex>
          {isExpanded && (
            <Typography variant="omega" fontWeight="bold">
              Watchtower
            </Typography>
          )}
        </Flex>

        <Flex
          direction="column"
          alignItems="center"
          gap={2}
          tag="ul"
          paddingTop={4}
          paddingLeft={isExpanded ? 2 : 0}
          paddingRight={isExpanded ? 2 : 0}
          style={{ width: '100%', listStyle: 'none', paddingInlineStart: isExpanded ? undefined : 0, marginBlock: 0 }}
        >
          <NavLink href="/admin/content-manager" label="Content Manager" expanded={isExpanded} active={pathname?.startsWith('/admin/content-manager') ?? false}>
            <Stack width="2rem" height="2rem" fill={pathname?.startsWith('/admin/content-manager') ? 'primary600' : 'neutral600'} />
          </NavLink>
          <NavLink href="/admin/media-library" label="Media Library" expanded={isExpanded} active={pathname?.startsWith('/admin/media-library') ?? false}>
            <Image width="2rem" height="2rem" fill={pathname?.startsWith('/admin/media-library') ? 'primary600' : 'neutral600'} />
          </NavLink>
          <NavLink href="/admin/operators" label="Operators" expanded={isExpanded} active={pathname?.startsWith('/admin/operators') ?? false}>
            <Key width="2rem" height="2rem" fill={pathname?.startsWith('/admin/operators') ? 'primary600' : 'neutral600'} />
          </NavLink>
          <NavLink href="/admin/users" label="Users" expanded={isExpanded} active={pathname?.startsWith('/admin/users') ?? false}>
            <User width="2rem" height="2rem" fill={pathname?.startsWith('/admin/users') ? 'primary600' : 'neutral600'} />
          </NavLink>
        </Flex>
      </Flex>

      <Flex direction="column" alignItems="center" gap={2} style={{ width: '100%' }}>
        <Tooltip label={isExpanded ? 'Collapse' : 'Expand'} side="right">
          <IconButton label={isExpanded ? 'Collapse navigation' : 'Expand navigation'} onClick={toggleExpanded} variant="ghost">
            {isExpanded ? <ChevronLeft /> : <ChevronRight />}
          </IconButton>
        </Tooltip>

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
    </Flex>
  );
}

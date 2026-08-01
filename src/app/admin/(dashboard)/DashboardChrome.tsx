'use client';

import { usePathname } from 'next/navigation';
import {
  Box,
  Flex,
  SubNav,
  SubNavHeader,
  SubNavLink,
  SubNavSection,
  SubNavSections,
  TextButton,
} from '@strapi/design-system';
import { logoutAction } from '../login/actions';

export interface NavContentType {
  uid: string;
  displayName: string;
  singularName: string;
  pluralName: string;
  kind: 'collectionType' | 'singleType';
}

export default function DashboardChrome({
  contentTypes,
  children,
}: {
  contentTypes: NavContentType[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const collectionTypes = contentTypes.filter((c) => c.kind === 'collectionType');
  const singleTypes = contentTypes.filter((c) => c.kind === 'singleType');

  const slugFor = (c: NavContentType) => (c.kind === 'collectionType' ? c.pluralName : c.singularName);

  return (
    <Flex alignItems="flex-start" minHeight="100vh">
      <SubNav aria-label="Content manager navigation" style={{ minWidth: '14rem' }}>
        <SubNavHeader label="Watchtower" />
        <SubNavSections>
          <SubNavSection label="Collection Types">
            {collectionTypes.map((c) => (
              <SubNavLink
                key={c.uid}
                href={`/admin/content-manager/${slugFor(c)}`}
                active={pathname?.startsWith(`/admin/content-manager/${slugFor(c)}`)}
              >
                {c.displayName}
              </SubNavLink>
            ))}
          </SubNavSection>
          <SubNavSection label="Single Types">
            {singleTypes.map((c) => (
              <SubNavLink
                key={c.uid}
                href={`/admin/content-manager/${slugFor(c)}`}
                active={pathname?.startsWith(`/admin/content-manager/${slugFor(c)}`)}
              >
                {c.displayName}
              </SubNavLink>
            ))}
          </SubNavSection>
          <SubNavSection label="Media">
            <SubNavLink href="/admin/media-library" active={pathname?.startsWith('/admin/media-library')}>
              Media Library
            </SubNavLink>
          </SubNavSection>
        </SubNavSections>
        <Box padding={4}>
          <form action={logoutAction}>
            <TextButton type="submit">Sign out</TextButton>
          </form>
        </Box>
      </SubNav>

      <Box flex={1} padding={8} background="neutral100" minHeight="100vh">
        {children}
      </Box>
    </Flex>
  );
}

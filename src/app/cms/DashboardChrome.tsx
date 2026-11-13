'use client';

import { usePathname } from 'next/navigation';
import { Box, Flex, SubNav, SubNavHeader, SubNavLink, SubNavSection, SubNavSections } from '@strapi/design-system';
import GlobalNavRail from './GlobalNavRail';

export interface NavContentType {
  uid: string;
  displayName: string;
  singularName: string;
  pluralName: string;
  kind: 'collectionType' | 'singleType';
}

export default function DashboardChrome({
  contentTypes,
  userInitials,
  children,
}: {
  contentTypes: NavContentType[];
  userInitials: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const collectionTypes = contentTypes.filter((c) => c.kind === 'collectionType');
  const singleTypes = contentTypes.filter((c) => c.kind === 'singleType');
  const inContentManager = pathname?.startsWith('/cms/content-manager') ?? false;
  // The builder renders its own full-height menu + scrolling content, so it gets the bare area.
  const inBuilder = pathname?.startsWith('/cms/content-type-builder') ?? false;

  const slugFor = (c: NavContentType) => (c.kind === 'collectionType' ? c.pluralName : c.singularName);

  return (
    // Fixed-height shell: the nav rail and the sub-nav stay put (each scrolls on its own only if it
    // overflows) and only the main content area scrolls — same as Strapi's admin.
    // Pinned to the viewport (and the window itself can't scroll, see cms/layout.tsx), so nothing
    // that grows the document — popovers, portals, expanded blocks — can drag the panels along.
    <Flex alignItems="stretch" height="100vh" style={{ overflow: 'hidden', position: 'fixed', inset: 0 }}>
      <Box height="100vh" style={{ overflowY: 'auto', flexShrink: 0 }}>
        <GlobalNavRail userInitials={userInitials} />
      </Box>

      {inContentManager && (
        <SubNav aria-label="Content manager navigation" style={{ minWidth: '14rem', height: '100vh', overflowY: 'auto', flexShrink: 0 }}>
          <SubNavHeader label="Content Manager" />
          <SubNavSections>
            <SubNavSection label="Collection Types">
              {collectionTypes.map((c) => (
                <SubNavLink
                  key={c.uid}
                  href={`/cms/content-manager/${slugFor(c)}`}
                  active={pathname?.startsWith(`/cms/content-manager/${slugFor(c)}`)}
                >
                  {c.displayName}
                </SubNavLink>
              ))}
            </SubNavSection>
            <SubNavSection label="Single Types">
              {singleTypes.map((c) => (
                <SubNavLink
                  key={c.uid}
                  href={`/cms/content-manager/${slugFor(c)}`}
                  active={pathname?.startsWith(`/cms/content-manager/${slugFor(c)}`)}
                >
                  {c.displayName}
                </SubNavLink>
              ))}
            </SubNavSection>
          </SubNavSections>
        </SubNav>
      )}

      <Box flex={1} padding={inBuilder ? 0 : 8} background="neutral100" height="100vh" style={{ overflowY: inBuilder ? 'hidden' : 'auto', minWidth: 0 }}>
        {children}
      </Box>
    </Flex>
  );
}

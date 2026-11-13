'use client';

import { Suspense } from 'react';
import NextLink from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import type { CSSProperties } from 'react';

interface SubNavItem {
  href: string;
  label: string;
  tab: string;
}

interface NavItem {
  href: string;
  label: string;
  children?: SubNavItem[];
}

// Add new root-session pages here as they're built — this is the single place that drives the left
// nav. Presentation content (incl. Device Types) is edited in the CMS; Pricing stays here because it's
// core service data with its own business rules.
const NAV_ITEMS: NavItem[] = [
  { href: '/tickets', label: 'Tickets' },
  { href: '/providers', label: 'Providers' },
  { href: '/provider-tiers', label: 'Provider Tiers' },
  { href: '/device-type-groups', label: 'Device Type Groups' },
  { href: '/customers', label: 'Customers' },
  { href: '/operators', label: 'Operators' },
  {
    href: '/pricing',
    label: 'Pricing',
    children: [
      { href: '/pricing?tab=plans', label: 'Subscription Plans', tab: 'plans' },
      { href: '/pricing?tab=addons', label: 'Subscription Addons', tab: 'addons' },
      { href: '/pricing?tab=parts', label: 'Service Parts', tab: 'parts' },
    ],
  },
  // Opens the full-screen Strapi-style CMS, which has its own navigation (and a link back here).
  { href: '/cms', label: 'CMS' },
  { href: '/audit-log', label: 'Audit Log' },
];

// useSearchParams() forces this subtree to opt out of static rendering, which Next.js
// requires to happen inside a Suspense boundary (build fails otherwise — every page
// renders <RootSidebar>, so an unwrapped hook here broke `yarn build` for all of them,
// not just the page that looked like it was missing one). The fallback is only ever
// visible for a build-time static pass / an instant of client hydration, so it doesn't
// need the real active-tab state — just the same-sized shell to avoid layout shift.
function RootSidebarFallback() {
  return <aside style={{ width: 214, background: '#FFFFFF', flexShrink: 0, paddingTop: 24 }} />;
}

export default function RootSidebar() {
  return (
    <Suspense fallback={<RootSidebarFallback />}>
      <RootSidebarContent />
    </Suspense>
  );
}

function RootSidebarContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const itemStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 24px',
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: '-0.03em',
    textDecoration: 'none',
  };
  const subItemStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    padding: '9px 24px 9px 40px',
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '-0.03em',
    textDecoration: 'none',
  };

  const activeTab = searchParams?.get('tab');

  return (
    <aside style={{ width: 214, background: '#FFFFFF', flexShrink: 0, paddingTop: 24 }}>
      <nav className="d-flex flex-column">
        {NAV_ITEMS.map((item) => {
          const active = pathname?.startsWith(item.href) && !item.children;
          const parentActive = pathname?.startsWith(item.href);
          return (
            <div key={item.href}>
              <NextLink
                href={item.children ? item.children[0].href : item.href}
                style={{
                  ...itemStyle,
                  color: active ? '#181818' : '#B7B7B7',
                  background: active ? '#F2F2F2' : 'transparent',
                  borderRight: active ? '3px solid #181818' : '3px solid transparent',
                }}
              >
                {item.label}
              </NextLink>
              {item.children && parentActive && (
                <div className="d-flex flex-column">
                  {item.children.map((sub) => {
                    const subActive = activeTab ? activeTab === sub.tab : sub.tab === item.children![0].tab;
                    return (
                      <NextLink
                        key={sub.href}
                        href={sub.href}
                        style={{
                          ...subItemStyle,
                          color: subActive ? '#181818' : '#B7B7B7',
                          background: subActive ? '#F2F2F2' : 'transparent',
                          borderRight: subActive ? '3px solid #181818' : '3px solid transparent',
                        }}
                      >
                        {sub.label}
                      </NextLink>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

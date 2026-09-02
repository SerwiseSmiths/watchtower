'use client';

import { Suspense, useState } from 'react';
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

type Group = 'data' | 'content';

// Add new root-session pages here as they're built — this is the single place that
// drives the left nav. Split into two groups the sidebar toggles between; Audit Log
// intentionally appears in both since it spans every module.
const DATA_ITEMS: NavItem[] = [
  { href: '/tickets', label: 'Tickets' },
  { href: '/providers', label: 'Providers' },
  { href: '/provider-tiers', label: 'Provider Tiers' },
  { href: '/customers', label: 'Customers' },
  { href: '/audit-log', label: 'Audit Log' },
];

const CONTENT_ITEMS: NavItem[] = [
  { href: '/device-types', label: 'Device Types' },
  {
    href: '/pricing',
    label: 'Pricing',
    children: [
      { href: '/pricing?tab=plans', label: 'Subscription Plans', tab: 'plans' },
      { href: '/pricing?tab=addons', label: 'Subscription Addons', tab: 'addons' },
      { href: '/pricing?tab=parts', label: 'Service Parts', tab: 'parts' },
    ],
  },
  { href: '/audit-log', label: 'Audit Log' },
];

function groupForPathname(pathname: string | null): Group {
  if (DATA_ITEMS.some((item) => pathname?.startsWith(item.href))) return 'data';
  return 'content';
}

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
  const [group, setGroup] = useState<Group>(() => groupForPathname(pathname));

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

  const items = group === 'data' ? DATA_ITEMS : CONTENT_ITEMS;
  const activeTab = searchParams?.get('tab');

  return (
    <aside style={{ width: 214, background: '#FFFFFF', flexShrink: 0, paddingTop: 24 }}>
      <div className="d-flex" style={{ margin: '0 16px 16px', background: '#F2F2F2', borderRadius: 6, padding: 3, gap: 2 }}>
        <button
          type="button"
          onClick={() => setGroup('data')}
          style={{
            flex: 1,
            background: group === 'data' ? '#181818' : 'transparent',
            color: group === 'data' ? '#FFFFFF' : '#454545',
            border: 'none',
            borderRadius: 5,
            padding: '7px 0',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '-0.03em',
          }}
        >
          Data
        </button>
        <button
          type="button"
          onClick={() => setGroup('content')}
          style={{
            flex: 1,
            background: group === 'content' ? '#181818' : 'transparent',
            color: group === 'content' ? '#FFFFFF' : '#454545',
            border: 'none',
            borderRadius: 5,
            padding: '7px 0',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '-0.03em',
          }}
        >
          Content
        </button>
      </div>

      <nav className="d-flex flex-column">
        {items.map((item) => {
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

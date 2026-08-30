'use client';

import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import type { CSSProperties } from 'react';

interface NavItem {
  href: string;
  label: string;
}

// Add new root-session pages here as they're built — this is the single place
// that drives the left nav across /tickets, /providers, etc.
const NAV_ITEMS: NavItem[] = [
  { href: '/tickets', label: 'Tickets' },
  { href: '/providers', label: 'Providers' },
  { href: '/provider-tiers', label: 'Provider Tiers' },
  { href: '/customers', label: 'Customers' },
];

export default function RootSidebar() {
  const pathname = usePathname();

  const itemStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 24px',
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: '-0.03em',
    textDecoration: 'none',
  };

  return (
    <aside style={{ width: 214, background: '#FFFFFF', flexShrink: 0, paddingTop: 24 }}>
      <nav className="d-flex flex-column">
        {NAV_ITEMS.map((item) => {
          const active = pathname?.startsWith(item.href) ?? false;
          return (
            <NextLink
              key={item.href}
              href={item.href}
              style={{
                ...itemStyle,
                color: active ? '#181818' : '#B7B7B7',
                background: active ? '#F2F2F2' : 'transparent',
                borderRight: active ? '3px solid #181818' : '3px solid transparent',
              }}
            >
              {item.label}
            </NextLink>
          );
        })}
      </nav>
    </aside>
  );
}

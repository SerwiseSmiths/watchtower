'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { dmSans } from '../tickets/fonts';
import { ChevronRightIcon } from '../tickets/icons';
import { formatDate, formatCurrency } from '../providers/mapProvider';
import RootSidebar from '@/components/RootSidebar';
import type { NexusCustomerListItem } from '@/lib/nexus/customers';

function initialsFor(firstName: string | null, lastName: string | null, fallback: string): string {
  const first = firstName?.trim()?.[0] ?? '';
  const last = lastName?.trim()?.[0] ?? '';
  return (first + last).toUpperCase() || fallback.slice(-2);
}

function Avatar({ initials, photo }: { initials: string; photo: string | null }) {
  if (photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photo} alt={initials} className="rounded-circle flex-shrink-0" style={{ width: 25, height: 25, objectFit: 'cover' }} />
    );
  }
  return (
    <span
      className="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0"
      style={{ width: 25, height: 25, background: '#E5E5E5', fontSize: 10, fontWeight: 500, color: '#454545' }}
    >
      {initials}
    </span>
  );
}

export default function CustomersView({ customers }: { customers: NexusCustomerListItem[] }) {
  const router = useRouter();
  const labelStyle: CSSProperties = { fontSize: 10, fontWeight: 600, letterSpacing: '-0.03em', color: '#B7B7B7' };
  const cellStyle: CSSProperties = { fontSize: 12, fontWeight: 600, letterSpacing: '-0.03em', color: '#000000' };

  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return customers;
    return customers.filter((c) => {
      const name = [c.firstName, c.lastName].filter(Boolean).join(' ');
      return (
        name.toLowerCase().includes(normalized) ||
        c.phoneNo.toLowerCase().includes(normalized) ||
        (c.pinCode?.toLowerCase().includes(normalized) ?? false)
      );
    });
  }, [customers, query]);

  return (
    <div className={dmSans.className} style={{ minHeight: '100vh', background: '#F2F2F2', display: 'flex' }}>
      <RootSidebar />

      <main className="flex-grow-1" style={{ padding: '44px 40px' }}>
        <h1 className="mb-3" style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', color: '#181818' }}>
          Customers
        </h1>

        <div className="d-flex justify-content-between align-items-center mb-3">
          <div
            className="d-flex align-items-center"
            style={{ width: 718, background: '#E4E4E4', border: '1px solid #B7B7B7', borderRadius: 6, padding: '11px', gap: 9 }}
          >
            <span style={{ width: 14, height: 14, border: '1px solid #000', borderRadius: '50%', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search By Name, Phone Number, Pin code"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-grow-1"
              style={{ ...labelStyle, background: 'transparent', border: 'none', outline: 'none', width: '100%' }}
            />
          </div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 5, overflow: 'hidden' }}>
          <div className="d-flex align-items-center" style={{ padding: '0 13px', height: 35, borderBottom: '1px solid #E5E5E5' }}>
            <div style={{ width: 26 }}>
              <input type="checkbox" />
            </div>
            <div style={{ width: 200, ...labelStyle }}>Name</div>
            <div style={{ width: 130, ...labelStyle }}>Phone Number</div>
            <div style={{ width: 80, ...labelStyle }}>Pin code</div>
            <div style={{ width: 130, ...labelStyle }}>Location</div>
            <div style={{ width: 110, ...labelStyle }}>Wallet Balance</div>
            <div style={{ width: 120, ...labelStyle }}>Connected Since</div>
            <div style={{ width: 24 }} />
          </div>

          {filtered.length === 0 && (
            <div className="d-flex align-items-center justify-content-center" style={{ height: 80, ...labelStyle }}>
              No customers match your search.
            </div>
          )}

          {filtered.map((customer, i) => {
            const name = [customer.firstName, customer.lastName].filter(Boolean).join(' ') || customer.phoneNo;
            return (
              <div
                key={customer.id}
                className="d-flex align-items-center"
                style={{ padding: '0 13px', height: 35, borderBottom: i === filtered.length - 1 ? 'none' : '1px solid #E5E5E5', cursor: 'pointer' }}
                onClick={() => router.push(`/customers/${customer.id}`)}
              >
                <div style={{ width: 26 }} onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" />
                </div>
                <div className="d-flex align-items-center" style={{ width: 200, gap: 9, ...cellStyle }}>
                  <Avatar initials={initialsFor(customer.firstName, customer.lastName, customer.phoneNo)} photo={customer.avatar} />
                  {name}
                </div>
                <div style={{ width: 130, ...cellStyle }}>{customer.phoneNo}</div>
                <div style={{ width: 80, ...cellStyle }}>{customer.pinCode ?? '—'}</div>
                <div style={{ width: 130, ...cellStyle }}>{customer.location ?? '—'}</div>
                <div style={{ width: 110, ...cellStyle, color: customer.walletBalance > 0 ? '#0C8D6E' : customer.walletBalance < 0 ? '#E53935' : '#000' }}>
                  {formatCurrency(customer.walletBalance)}
                </div>
                <div style={{ width: 120, ...cellStyle }}>{formatDate(customer.createdAt)}</div>
                <div style={{ width: 24 }} className="d-flex justify-content-center">
                  <ChevronRightIcon />
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

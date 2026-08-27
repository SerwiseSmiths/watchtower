'use client';

import { useEffect, useMemo, useRef, useState, useTransition, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { dmSans } from './fonts';
import RootSidebar from '@/components/RootSidebar';
import type { Ticket, TicketStatus } from './mapComplaint';
import { bypassEntrance } from './actions';
import { FilterIcon, ChevronRightIcon, RaisedIcon, InWarrantyIcon, InProgressIcon, CancelledIcon, CompletedIcon } from './icons';
import { STATUS_COLORS } from './statusColors';
import TicketDetailPanel from './TicketDetailPanel';
import AddTicketModal from './AddTicketModal';

const ALL_STATUSES: TicketStatus[] = ['Raised', 'In-Warranty', 'In Progress', 'Cancelled', 'Completed'];

const STATUS_ICONS: Record<TicketStatus, React.ReactNode> = {
  Raised: <RaisedIcon />,
  'In-Warranty': <InWarrantyIcon />,
  'In Progress': <InProgressIcon />,
  Cancelled: <CancelledIcon />,
  Completed: <CompletedIcon />,
};

function Avatar({ initials, photo }: { initials: string; photo: string | null }) {
  if (photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photo}
        alt={initials}
        className="rounded-circle flex-shrink-0"
        style={{ width: 25, height: 25, objectFit: 'cover' }}
      />
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

function BypassButton({ ticket }: { ticket: Ticket }) {
  const [isPending, startTransition] = useTransition();
  const enabled = ticket.stage === 'ENTRANCE';

  return (
    <button
      type="button"
      disabled={!enabled || isPending}
      onClick={() => startTransition(() => bypassEntrance(ticket.complaintId))}
      style={{
        background: enabled ? '#000' : '#E5E5E5',
        color: enabled ? '#FFF' : '#B7B7B7',
        border: 'none',
        borderRadius: 5,
        width: 50,
        height: 25,
        fontSize: 10,
        fontWeight: 500,
        letterSpacing: '-0.03em',
        cursor: enabled ? 'pointer' : 'not-allowed',
      }}
    >
      {isPending ? '…' : 'Confirm'}
    </button>
  );
}

function StatusBadge({ status }: { status: TicketStatus }) {
  const { bg, color } = STATUS_COLORS[status];
  const icon = STATUS_ICONS[status];
  return (
    <span
      className="d-inline-flex align-items-center justify-content-center"
      style={{ background: bg, color, borderRadius: 5, padding: '5px 8px', gap: 4, fontSize: 8, fontWeight: 600, letterSpacing: '-0.03em' }}
    >
      {icon}
      {status}
    </span>
  );
}

function FilterPopover({
  selected,
  onToggle,
  onClear,
  onClose,
}: {
  selected: Set<TicketStatus>;
  onToggle: (status: TicketStatus) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const labelStyle: CSSProperties = { fontSize: 12, fontWeight: 600, letterSpacing: '-0.03em', color: '#181818' };

  return (
    <div
      style={{
        position: 'absolute',
        top: 'calc(100% + 8px)',
        right: 0,
        width: 220,
        background: '#FFFFFF',
        border: '1px solid #E5E5E5',
        borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        padding: 16,
        zIndex: 20,
      }}
    >
      <div className="d-flex justify-content-between align-items-center mb-3">
        <span style={{ ...labelStyle, fontSize: 13 }}>Filter by status</span>
        <button
          type="button"
          onClick={onClear}
          style={{ background: 'none', border: 'none', color: '#B7B7B7', fontSize: 11, fontWeight: 600, letterSpacing: '-0.03em' }}
        >
          Clear
        </button>
      </div>

      <div className="d-flex flex-column" style={{ gap: 10 }}>
        {ALL_STATUSES.map((status) => (
          <label key={status} className="d-flex align-items-center" style={{ gap: 8, cursor: 'pointer', ...labelStyle }}>
            <input type="checkbox" checked={selected.has(status)} onChange={() => onToggle(status)} />
            <StatusBadge status={status} />
          </label>
        ))}
      </div>

      <button
        type="button"
        onClick={onClose}
        className="w-100 mt-3"
        style={{ background: '#181818', color: '#FFF', border: 'none', borderRadius: 6, padding: '8px', fontSize: 12, fontWeight: 600, letterSpacing: '-0.03em' }}
      >
        Done
      </button>
    </div>
  );
}

export default function TicketsView({ tickets }: { tickets: Ticket[] }) {
  const router = useRouter();
  const labelStyle: CSSProperties = { fontSize: 10, fontWeight: 600, letterSpacing: '-0.03em', color: '#B7B7B7' };
  const cellStyle: CSSProperties = { fontSize: 12, fontWeight: 600, letterSpacing: '-0.03em', color: '#000000' };

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<Set<TicketStatus>>(new Set());
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setFilterOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredTickets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return tickets.filter((ticket) => {
      if (statusFilter.size > 0 && !statusFilter.has(ticket.status)) return false;

      if (!normalizedQuery) return true;
      return (
        ticket.name.toLowerCase().includes(normalizedQuery) ||
        ticket.phoneNumber.toLowerCase().includes(normalizedQuery) ||
        ticket.assignTo.toLowerCase().includes(normalizedQuery) ||
        (ticket.assignPhoneNumber?.toLowerCase().includes(normalizedQuery) ?? false) ||
        (ticket.pinCode?.toLowerCase().includes(normalizedQuery) ?? false)
      );
    });
  }, [tickets, query, statusFilter]);

  useEffect(() => {
    if (selectedIndex !== null && selectedIndex >= filteredTickets.length) {
      setSelectedIndex(null);
    }
  }, [filteredTickets, selectedIndex]);

  function toggleStatus(status: TicketStatus) {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  return (
    <div className={dmSans.className} style={{ minHeight: '100vh', background: '#F2F2F2', display: 'flex' }}>
      <RootSidebar />

      <main className="flex-grow-1" style={{ padding: '44px 40px' }}>
        <h1 className="mb-3" style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', color: '#181818' }}>
          Tickets
        </h1>

        <nav className="d-flex mb-4" style={{ gap: 15 }}>
          <span style={{ ...labelStyle, padding: '10px' }}>Dashboard</span>
          <span style={{ ...labelStyle, padding: '10px' }}>Analytics</span>
          <span style={{ ...labelStyle, padding: '10px', color: '#181818', borderBottom: '2px solid #181818' }}>Table</span>
        </nav>

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

          <div className="d-flex align-items-center" style={{ gap: 10 }}>
            <div ref={filterRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setFilterOpen((open) => !open)}
                className="d-flex align-items-center"
                style={{ background: '#E4E4E4', border: '1px solid #B7B7B7', borderRadius: 6, padding: '11px', gap: 9, ...labelStyle }}
              >
                <FilterIcon />
                Filter{statusFilter.size > 0 ? ` (${statusFilter.size})` : ''}
              </button>

              {filterOpen && (
                <FilterPopover
                  selected={statusFilter}
                  onToggle={toggleStatus}
                  onClear={() => setStatusFilter(new Set())}
                  onClose={() => setFilterOpen(false)}
                />
              )}
            </div>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              style={{ background: '#181818', color: '#FFFFFF', borderRadius: 5, padding: '10px 16px', fontSize: 12, fontWeight: 500, letterSpacing: '-0.03em', border: 'none' }}
            >
              + Add
            </button>
          </div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 5, overflow: 'hidden' }}>
          <div className="d-flex align-items-center" style={{ padding: '0 13px', height: 35, borderBottom: '1px solid #E5E5E5' }}>
            <div style={{ width: 26 }}>
              <input type="checkbox" />
            </div>
            <div style={{ width: 118, ...labelStyle }}>Ticket Id</div>
            <div style={{ width: 200, ...labelStyle }}>Name</div>
            <div style={{ width: 133, ...labelStyle }}>Phone Number</div>
            <div style={{ width: 118, ...labelStyle }}>Status</div>
            <div style={{ width: 200, ...labelStyle }}>Assign To</div>
            <div style={{ width: 112, ...labelStyle }}>Start Date</div>
            <div style={{ width: 118, ...labelStyle }}>End Date</div>
            <div style={{ width: 118, ...labelStyle }}>By Pass</div>
            <div style={{ width: 24 }} />
          </div>

          {filteredTickets.length === 0 && (
            <div className="d-flex align-items-center justify-content-center" style={{ height: 80, ...labelStyle }}>
              No tickets match your search.
            </div>
          )}

          {filteredTickets.map((ticket, i) => (
            <div
              key={`${ticket.id}-${i}`}
              className="d-flex align-items-center"
              style={{ padding: '0 13px', height: 35, borderBottom: i === filteredTickets.length - 1 ? 'none' : '1px solid #E5E5E5', cursor: 'pointer' }}
              onClick={() => setSelectedIndex(i)}
            >
              <div style={{ width: 26 }} onClick={(e) => e.stopPropagation()}>
                <input type="checkbox" />
              </div>
              <div style={{ width: 118, ...cellStyle }}>{ticket.id}</div>
              <div className="d-flex align-items-center" style={{ width: 200, gap: 9, ...cellStyle }}>
                <Avatar initials={ticket.initials} photo={ticket.avatar} />
                {ticket.name}
              </div>
              <div style={{ width: 133, ...cellStyle }}>{ticket.phoneNumber}</div>
              <div style={{ width: 118 }}>
                <StatusBadge status={ticket.status} />
              </div>
              <div className="d-flex align-items-center" style={{ width: 200, gap: 9, ...cellStyle }}>
                <Avatar initials={ticket.assignInitials} photo={ticket.assignAvatar} />
                {ticket.assignTo}
              </div>
              <div style={{ width: 112, ...cellStyle }}>{ticket.startDate}</div>
              <div style={{ width: 118, ...cellStyle }}>{ticket.endDate ?? '—'}</div>
              <div style={{ width: 118 }} onClick={(e) => e.stopPropagation()}>
                <BypassButton ticket={ticket} />
              </div>
              <div style={{ width: 24 }} className="d-flex justify-content-center">
                <ChevronRightIcon />
              </div>
            </div>
          ))}
        </div>
      </main>

      <TicketDetailPanel
        ticket={selectedIndex !== null ? filteredTickets[selectedIndex] : null}
        open={selectedIndex !== null}
        onClose={() => setSelectedIndex(null)}
        onPrev={() => setSelectedIndex((i) => (i !== null && i > 0 ? i - 1 : i))}
        onNext={() => setSelectedIndex((i) => (i !== null && i < filteredTickets.length - 1 ? i + 1 : i))}
        hasPrev={selectedIndex !== null && selectedIndex > 0}
        hasNext={selectedIndex !== null && selectedIndex < filteredTickets.length - 1}
      />

      {addOpen && (
        <AddTicketModal
          onClose={() => setAddOpen(false)}
          onCreated={() => {
            setAddOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

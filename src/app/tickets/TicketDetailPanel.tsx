'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import type { Ticket, TicketStatus, TicketQuoteItem } from './mapComplaint';
import { formatDeviceType, formatDate } from './mapComplaint';
import {
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CloseIcon,
  AddressIcon,
  RaisedIcon,
  InWarrantyIcon,
  InProgressIcon,
  CancelledIcon,
  CompletedIcon,
} from './icons';
import { STATUS_COLORS } from './statusColors';
import AddApplianceForm from './AddApplianceForm';
import ReassignPopover from './ReassignPopover';
import QuoteResponseActions from './QuoteResponseActions';

type StageKey = 'RAISED' | 'ASSIGNED' | 'ENTRANCE' | 'ESTIMATION' | 'APPROVAL' | 'PAYMENT' | 'IN_WARRANTY' | 'COMPLETED' | 'CANCELLED';

const STAGE_RANK: Record<Ticket['stage'], number> = {
  ENTRANCE: 0,
  QR_VALIDATED: 1,
  ESTIMATION: 2,
  APPROVAL: 3,
  PAYMENT: 4,
  COMPLETED: 5,
  REJECTED: -1,
};

// Each stage reuses the same background/icon as its matching status badge in the table,
// so the two views read as one consistent color language.
const STAGE_DEFS: { key: StageKey; label: string; status: TicketStatus; icon: React.ReactNode }[] = [
  { key: 'RAISED', label: 'Raised', status: 'Raised', icon: <RaisedIcon /> },
  { key: 'ASSIGNED', label: 'Assigned', status: 'Raised', icon: <RaisedIcon /> },
  { key: 'ENTRANCE', label: 'Entrance', status: 'In Progress', icon: <InProgressIcon /> },
  { key: 'ESTIMATION', label: 'Estimation', status: 'In Progress', icon: <InProgressIcon /> },
  { key: 'APPROVAL', label: 'Approval', status: 'In Progress', icon: <InProgressIcon /> },
  { key: 'PAYMENT', label: 'Payment', status: 'In Progress', icon: <InProgressIcon /> },
  { key: 'IN_WARRANTY', label: 'In-Warranty', status: 'In-Warranty', icon: <InWarrantyIcon /> },
  { key: 'COMPLETED', label: 'Completed', status: 'Completed', icon: <CompletedIcon /> },
  { key: 'CANCELLED', label: 'Cancelled', status: 'Cancelled', icon: <CancelledIcon /> },
];

function isAchieved(key: StageKey, ticket: Ticket): boolean {
  const rank = STAGE_RANK[ticket.stage];
  switch (key) {
    case 'RAISED':
      return true;
    case 'ASSIGNED':
      return ticket.hasProvider;
    case 'ENTRANCE':
      return rank >= 1;
    case 'ESTIMATION':
      return rank >= 2;
    case 'APPROVAL':
      return rank >= 3;
    case 'PAYMENT':
      return rank >= 4;
    case 'COMPLETED':
      return ticket.stage === 'COMPLETED';
    case 'CANCELLED':
      return ticket.stage === 'REJECTED';
    case 'IN_WARRANTY':
      return Boolean(ticket.subscriptionId);
    default:
      return false;
  }
}

const MAIN_SEQUENCE: StageKey[] = ['RAISED', 'ASSIGNED', 'ENTRANCE', 'ESTIMATION', 'APPROVAL', 'PAYMENT', 'COMPLETED'];

function currentStageKey(ticket: Ticket): StageKey {
  if (ticket.stage === 'REJECTED') return 'CANCELLED';
  const nextUnachieved = MAIN_SEQUENCE.find((key) => !isAchieved(key, ticket));
  return nextUnachieved ?? 'COMPLETED';
}

function currentStageLabel(ticket: Ticket): string {
  return STAGE_DEFS.find((s) => s.key === currentStageKey(ticket))!.label;
}

function achievedCount(ticket: Ticket): number {
  return MAIN_SEQUENCE.filter((key) => isAchieved(key, ticket)).length;
}

function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type QuoteTab = 'activity' | 'estimation' | 'acceptance';

function StatRow({ label, value, valueColor = '#000000' }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="d-flex justify-content-between align-items-center">
      <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '-0.03em', color: '#B7B7B7' }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '-0.03em', color: valueColor }}>{value}</span>
    </div>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        background: 'none',
        border: 'none',
        borderBottom: active ? '1px solid #000000' : '1px solid transparent',
        padding: '10px 0',
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '-0.03em',
        color: active ? '#000000' : '#B7B7B7',
      }}
    >
      {label}
    </button>
  );
}

function QuoteItemsList({ items }: { items: TicketQuoteItem[] }) {
  if (items.length === 0) {
    return <div style={{ fontSize: 10, fontWeight: 600, color: '#B7B7B7' }}>No items in this quote.</div>;
  }
  return (
    <div className="d-flex flex-column" style={{ gap: 18 }}>
      {items.map((item, i) => (
        <div key={i} className="d-flex justify-content-between align-items-start" style={{ gap: 10 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.03em', color: '#000000' }}>{item.name}</div>
            <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: '-0.03em', color: '#B7B7B7', marginTop: 2 }}>
              Qty {item.quantity} × {formatCurrency(item.unitPrice)}
            </div>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '-0.03em', color: '#000000', whiteSpace: 'nowrap' }}>
            {formatCurrency(item.amount)}
          </div>
        </div>
      ))}
    </div>
  );
}

function Avatar({ initials, photo, size = 26 }: { initials: string; photo: string | null; size?: number }) {
  if (photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photo} alt={initials} className="rounded-circle flex-shrink-0" style={{ width: size, height: size, objectFit: 'cover' }} />
    );
  }
  return (
    <span
      className="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0"
      style={{ width: size, height: size, background: '#E5E5E5', fontSize: 10, fontWeight: 500, color: '#454545' }}
    >
      {initials}
    </span>
  );
}

function ContactButtons({ phone, email }: { phone: string | null; email: string | null }) {
  const pillStyle: CSSProperties = {
    background: '#E5E5E5',
    borderRadius: 5,
    padding: '5px 15px',
    fontSize: 8,
    fontWeight: 600,
    letterSpacing: '-0.03em',
    color: '#181818',
    textDecoration: 'none',
  };
  return (
    <div className="d-flex align-items-center" style={{ gap: 5 }}>
      {phone && (
        <a href={`tel:${phone}`} style={pillStyle}>
          Call Now
        </a>
      )}
      {email && (
        <a href={`mailto:${email}`} style={pillStyle}>
          Send Mail
        </a>
      )}
    </div>
  );
}

function PersonCard({
  label,
  name,
  initials,
  avatar,
  addressShort,
  phone,
  email,
  extraAction,
}: {
  label: string;
  name: string;
  initials: string;
  avatar: string | null;
  addressShort: string | null;
  phone: string | null;
  email: string | null;
  extraAction?: React.ReactNode;
}) {
  return (
    <div className="flex-grow-1" style={{ minWidth: 260 }}>
      <div className="mb-2" style={{ fontSize: 12, fontWeight: 600, letterSpacing: '-0.03em', color: '#B7B7B7' }}>
        {label}
      </div>
      <div className="d-flex align-items-center justify-content-between flex-wrap" style={{ background: '#FFFFFF', borderRadius: 5, padding: '10px 15px', gap: 10 }}>
        <div className="d-flex align-items-center" style={{ gap: 10 }}>
          <Avatar initials={initials} photo={avatar} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '-0.03em', color: '#000000' }}>{name}</div>
            {addressShort && (
              <div style={{ fontSize: 8, fontWeight: 600, letterSpacing: '-0.03em', color: '#B7B7B7' }}>{addressShort}</div>
            )}
          </div>
        </div>
        <div className="d-flex align-items-center" style={{ gap: 5 }}>
          {extraAction}
          <ContactButtons phone={phone} email={email} />
        </div>
      </div>
    </div>
  );
}

export default function TicketDetailPanel({
  ticket,
  open,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: {
  ticket: Ticket | null;
  open: boolean;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}) {
  const [content, setContent] = useState<Ticket | null>(ticket);
  const [visible, setVisible] = useState(false);
  const [addingAppliance, setAddingAppliance] = useState(false);
  const [tab, setTab] = useState<QuoteTab>('activity');

  useEffect(() => {
    if (ticket) {
      setContent(ticket);
      setAddingAppliance(false);
      setTab('activity');
    }
  }, [ticket]);

  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
  }, [open]);

  if (!content) return null;

  const labelStyle: CSSProperties = { fontSize: 10, fontWeight: 600, letterSpacing: '-0.03em', color: '#B7B7B7' };
  const cellStyle: CSSProperties = { fontSize: 12, fontWeight: 600, letterSpacing: '-0.03em', color: '#000000' };
  const progress = achievedCount(content);

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 50, pointerEvents: open ? 'auto' : 'none' }}
      onTransitionEnd={() => {
        if (!open) setContent(null);
      }}
    >
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.45)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.25s ease',
        }}
      />

      <div
        className="d-flex align-items-center"
        style={{
          position: 'absolute',
          top: '50%',
          right: 'min(1050px, 96vw)',
          transform: `translate(${visible ? '0' : '20px'}, -50%)`,
          opacity: visible ? 1 : 0,
          transition: 'transform 0.28s ease, opacity 0.28s ease',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        <button
          type="button"
          disabled={!hasPrev}
          onClick={onPrev}
          className="d-flex align-items-center justify-content-center"
          style={{ width: 32, height: 32, borderRadius: '50%', background: '#FFFFFF', border: 'none', opacity: hasPrev ? 1 : 0.35 }}
        >
          <ChevronUpIcon />
        </button>
        <button
          type="button"
          disabled={!hasNext}
          onClick={onNext}
          className="d-flex align-items-center justify-content-center"
          style={{ width: 32, height: 32, borderRadius: '50%', background: '#FFFFFF', border: 'none', opacity: hasNext ? 1 : 0.35 }}
        >
          <ChevronDownIcon />
        </button>
      </div>

      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(1050px, 96vw)',
          background: '#F2F2F2',
          borderTopLeftRadius: 10,
          borderBottomLeftRadius: 10,
          transform: `translateX(${visible ? '0' : '100%'})`,
          transition: 'transform 0.28s ease',
          display: 'flex',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          className="d-flex align-items-center justify-content-center"
          style={{ position: 'absolute', top: 15, right: 15, width: 26, height: 26, borderRadius: '50%', background: '#FFFFFF', border: 'none' }}
        >
          <CloseIcon />
        </button>

        <div className="d-flex flex-column" style={{ width: 269, padding: 15, gap: 15, flexShrink: 0, height: '100%', minHeight: 0 }}>
          <div>
            <div style={{ ...cellStyle, marginBottom: 6 }}>{content.id}</div>
            <div className="d-flex align-items-center" style={{ gap: 8 }}>
              <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.03em', color: '#000000' }}>
                {content.device ? formatDeviceType(content.device.type) : content.title}
              </span>
              <span style={{ background: '#E5E5E5', color: '#181818', borderRadius: 5, padding: '4px 8px', fontSize: 11, fontWeight: 600 }}>
                Service
              </span>
            </div>
            <div style={{ ...labelStyle, marginTop: 4 }}>{content.startDate}</div>
          </div>

          <div style={{ borderBottom: '2px solid #E5E5E5', paddingBottom: 15 }}>
            <div style={{ ...labelStyle, marginBottom: 6 }}>Current Stage &amp; Activity</div>
            <div className="d-flex justify-content-between align-items-end mb-2">
              <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.03em', color: '#000000' }}>
                {currentStageLabel(content)}
              </span>
              <span style={{ ...labelStyle, color: '#000000' }}>{formatDate(content.updatedAtRaw)}</span>
            </div>
            <div className="d-flex" style={{ gap: 5 }}>
              {MAIN_SEQUENCE.map((key, i) => (
                <span
                  key={key}
                  style={{
                    flex: 1,
                    height: 5,
                    borderRadius: 500,
                    background: i < progress ? '#0C8D6E' : '#D9D9D9',
                  }}
                />
              ))}
            </div>
          </div>

          {content.quote && (() => {
            const quote = content.quote;
            const rate =
              quote.status === 'APPROVED'
                ? { label: '100.00%', color: '#2ABA65' }
                : quote.status === 'REJECTED'
                  ? { label: '0.00%', color: '#FF5E5E' }
                  : { label: 'Pending', color: '#B7B7B7' };
            return (
              <div className="d-flex flex-column" style={{ gap: 2, borderBottom: '2px solid #E5E5E5', paddingBottom: 15 }}>
                <StatRow label="Total Paid" value={content.stage === 'COMPLETED' ? formatCurrency(quote.totalAmount) : '—'} />
                <StatRow label="Approval/Rejection Rate" value={rate.label} valueColor={rate.color} />
                {tab !== 'activity' && (
                  <>
                    <StatRow label="Total Acceptance" value={quote.status === 'APPROVED' ? formatCurrency(quote.totalAmount) : '—'} />
                    <StatRow label="Total Estimation" value={formatCurrency(quote.totalAmount)} />
                  </>
                )}
              </div>
            );
          })()}

          {content.quote && (
            <div className="d-flex" style={{ borderBottom: '1px solid #E5E5E5' }}>
              <TabButton label="Ticket Activity" active={tab === 'activity'} onClick={() => setTab('activity')} />
              <TabButton label="Estimation" active={tab === 'estimation'} onClick={() => setTab('estimation')} />
              <TabButton label="Acceptance" active={tab === 'acceptance'} onClick={() => setTab('acceptance')} />
            </div>
          )}

          <div className="d-flex flex-column tw-thin-scroll" style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto' }}>
            {(!content.quote || tab === 'activity') ? (
              <div className="d-flex flex-column" style={{ width: '100%' }}>
                {STAGE_DEFS.map((stage, idx) => {
                  const achieved = isAchieved(stage.key, content);
                  const { bg, color } = STATUS_COLORS[stage.status];
                  const isCurrent = stage.key === currentStageKey(content);
                  const dateLabel = stage.key === 'RAISED' ? content.startDate : isCurrent ? formatDate(content.updatedAtRaw) : null;
                  return (
                    <div key={stage.key}>
                      <div className="d-flex align-items-start justify-content-between" style={{ opacity: achieved ? 1 : 0.4 }}>
                        <div className="d-flex align-items-start" style={{ gap: 6 }}>
                          <span
                            className="d-flex align-items-center justify-content-center"
                            style={{ width: 20, height: 20, borderRadius: 5, background: bg, color, flexShrink: 0 }}
                          >
                            {stage.icon}
                          </span>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '-0.03em', color: '#181818' }}>{stage.label}</div>
                            {dateLabel && (
                              <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: '-0.03em', color: '#000000' }}>{dateLabel}</div>
                            )}
                          </div>
                        </div>
                        <span style={{ fontSize: 8, fontWeight: 600, letterSpacing: '-0.03em', color: '#0D67CE' }}>View</span>
                      </div>
                      {idx < STAGE_DEFS.length - 1 && (
                        <div style={{ width: 20, display: 'flex', justifyContent: 'center', margin: '4px 0' }}>
                          <span style={{ width: 2, height: 14, background: '#D9D9D9', borderRadius: 500 }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <QuoteItemsList items={content.quote.items} />
            )}
          </div>

          {content.quote && content.quote.status === 'PENDING' && (
            <div style={{ paddingTop: 15, flexShrink: 0 }}>
              <QuoteResponseActions complaintId={content.complaintId} />
            </div>
          )}

          {content.quote && content.quote.status !== 'PENDING' && (
            <div className="d-flex" style={{ gap: 10, paddingTop: 15, flexShrink: 0 }}>
              <button type="button" style={{ flex: 1, background: '#E5E5E5', border: 'none', borderRadius: 5, padding: '10px', fontSize: 10, fontWeight: 600, letterSpacing: '-0.03em', color: '#000000' }}>
                invoice
              </button>
              <button type="button" style={{ flex: 1, background: '#E5E5E5', border: 'none', borderRadius: 5, padding: '10px', fontSize: 10, fontWeight: 600, letterSpacing: '-0.03em', color: '#000000' }}>
                Receipt
              </button>
            </div>
          )}
        </div>

        <div className="flex-grow-1 tw-thin-scroll" style={{ borderLeft: '2px solid #E5E5E5', padding: '16px 15px', overflowX: 'hidden', overflowY: 'auto', height: '100%', minHeight: 0 }}>
          <div className="d-flex flex-wrap" style={{ gap: 15, paddingBottom: 16, borderBottom: '2px solid #E5E5E5', marginBottom: 25 }}>
            <PersonCard
              label="Customer Details"
              name={content.name}
              initials={content.initials}
              avatar={content.avatar}
              addressShort={content.address?.short ?? null}
              phone={content.phoneNumber}
              email={content.email}
            />
            <PersonCard
              label="Provider Details"
              name={content.assignTo}
              initials={content.assignInitials}
              avatar={content.assignAvatar}
              addressShort={null}
              phone={content.assignPhoneNumber}
              email={content.assignEmail}
              extraAction={
                <ReassignPopover complaintId={content.complaintId} currentProviderId={content.assignId} onDone={() => {}} />
              }
            />
          </div>

          {content.address && (
            <div className="d-flex align-items-start mb-4" style={{ gap: 15 }}>
              <AddressIcon />
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.03em', color: '#000000' }}>{content.address.short}</div>
                <div style={{ fontSize: 10.5, fontWeight: 500, letterSpacing: '-0.03em', color: '#B7B7B7' }}>{content.address.full}</div>
              </div>
            </div>
          )}

          <div className="d-flex justify-content-between align-items-center mb-3">
            <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.03em', color: '#000000' }}>Ticket Appliances</span>
          </div>

          <div style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 5, overflow: 'hidden' }}>
            <div className="d-flex align-items-center" style={{ padding: '0 13px', height: 35, borderBottom: '1px solid #E5E5E5' }}>
              <div style={{ width: 26 }}>
                <input type="checkbox" />
              </div>
              <div style={{ width: 118, ...labelStyle }}>Description</div>
              <div style={{ width: 118, ...labelStyle }}>Appliance</div>
              <div style={{ width: 30 }} />
            </div>

            {content.device ? (
              <div className="d-flex align-items-center" style={{ padding: '0 13px', height: 44 }}>
                <div style={{ width: 26 }}>
                  <input type="checkbox" />
                </div>
                <div style={{ width: 118, ...cellStyle }}>{content.device.deviceKey}</div>
                <div style={{ width: 118, ...cellStyle }}>{formatDeviceType(content.device.type)}</div>
                <div style={{ width: 30 }}>
                  <ChevronRightIcon />
                </div>
              </div>
            ) : (
              <div className="d-flex align-items-center justify-content-center" style={{ height: 60, ...labelStyle }}>
                No appliance linked to this ticket.
              </div>
            )}
          </div>

          <div className="d-flex align-items-center justify-content-between mt-3">
            <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.03em', color: '#000000' }}>
              {content.device ? 1 : 0} Found!
            </span>
            {!addingAppliance && (
              <button
                type="button"
                onClick={() => setAddingAppliance(true)}
                style={{ background: '#181818', color: '#FFFFFF', border: 'none', borderRadius: 5, padding: '8px 16px', fontSize: 12, fontWeight: 500, letterSpacing: '-0.03em' }}
              >
                Add Appliance
              </button>
            )}
          </div>

          {addingAppliance && (
            <div className="mt-3">
              <AddApplianceForm ticket={content} onCancel={() => setAddingAppliance(false)} onDone={() => setAddingAppliance(false)} />
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .tw-thin-scroll {
          scrollbar-width: none;
        }
        .tw-thin-scroll::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}

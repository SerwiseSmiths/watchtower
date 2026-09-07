// Simple monochrome glyphs — a stand-in for the device-type artwork in the
// design file, which isn't available as exportable assets in this codebase.
import type { DeviceTypeKey } from '@/lib/nexus/providers';

const wrap = (children: React.ReactNode) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    {children}
  </svg>
);

export const SKILL_LABELS: Record<DeviceTypeKey, string> = {
  AIR_CONDITIONER: 'Air Conditioner',
  FRIDGE: 'Fridge',
  WASHING_MACHINE: 'Washing Machine',
  MASTER_PURIFIER: 'Water Purifier / RO',
  GEYSER: 'Geyser',
};

export const SKILL_ORDER: DeviceTypeKey[] = [
  'AIR_CONDITIONER',
  'FRIDGE',
  'WASHING_MACHINE',
  'MASTER_PURIFIER',
  'GEYSER',
];

export function SkillIcon({ type }: { type: DeviceTypeKey }) {
  switch (type) {
    case 'AIR_CONDITIONER':
      return wrap(
        <>
          <rect x="2" y="6" width="20" height="7" rx="2" stroke="#000" strokeWidth="1.4" />
          <path d="M6 16v2M10 16v3M14 16v2M18 16v3" stroke="#000" strokeWidth="1.4" strokeLinecap="round" />
        </>,
      );
    case 'FRIDGE':
      return wrap(
        <>
          <rect x="6" y="2" width="12" height="20" rx="1.5" stroke="#000" strokeWidth="1.4" />
          <line x1="6" y1="9" x2="18" y2="9" stroke="#000" strokeWidth="1.4" />
          <line x1="9" y1="4" x2="9" y2="6.5" stroke="#000" strokeWidth="1.4" strokeLinecap="round" />
          <line x1="9" y1="11.5" x2="9" y2="14" stroke="#000" strokeWidth="1.4" strokeLinecap="round" />
        </>,
      );
    case 'WASHING_MACHINE':
      return wrap(
        <>
          <rect x="3" y="3" width="18" height="18" rx="2" stroke="#000" strokeWidth="1.4" />
          <line x1="3" y1="7" x2="21" y2="7" stroke="#000" strokeWidth="1.4" />
          <circle cx="12" cy="14" r="4.5" stroke="#000" strokeWidth="1.4" />
          <circle cx="6" cy="5" r="0.9" fill="#000" />
        </>,
      );
    case 'MASTER_PURIFIER':
      return wrap(
        <path
          d="M12 2C12 2 6 10 6 14.5C6 18 8.7 21 12 21C15.3 21 18 18 18 14.5C18 10 12 2 12 2Z"
          stroke="#000"
          strokeWidth="1.4"
        />,
      );
    case 'GEYSER':
      return wrap(
        <>
          <rect x="7" y="2" width="10" height="18" rx="4" stroke="#000" strokeWidth="1.4" />
          <line x1="7" y1="9" x2="17" y2="9" stroke="#000" strokeWidth="1.4" />
          <line x1="12" y1="20" x2="12" y2="22" stroke="#000" strokeWidth="1.4" strokeLinecap="round" />
        </>,
      );
    default:
      return wrap(<circle cx="12" cy="12" r="9" stroke="#000" strokeWidth="1.4" />);
  }
}

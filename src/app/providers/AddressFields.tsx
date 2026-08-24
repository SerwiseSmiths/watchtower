'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { NexusProviderAddress } from '@/lib/nexus/providers';
import { searchAddressAction } from './actions';
import type { AddressPrediction } from '@/lib/nexus/geocode';

const inputStyle: CSSProperties = {
  width: '100%',
  background: '#EFEFEF',
  border: '1px solid #E5E5E5',
  borderRadius: 6,
  padding: '11px',
  fontSize: 14,
  fontWeight: 600,
  letterSpacing: '-0.03em',
  color: '#000000',
  outline: 'none',
};

const labelStyle: CSSProperties = { fontSize: 12, fontWeight: 600, letterSpacing: '-0.03em', color: '#454545', marginBottom: 4 };

/** Ola Maps' autocomplete only returns free-text description strings, not
 *  structured fields — this is a best-effort split, not a real geocoder. */
function deriveLocationFromPrediction(prediction: AddressPrediction): Pick<NexusProviderAddress, 'city' | 'state' | 'country'> {
  const parts = prediction.secondaryText.split(',').map((p) => p.trim()).filter(Boolean);
  const country = parts[parts.length - 1];
  const state = parts[parts.length - 2];
  const city = parts[parts.length - 3] ?? parts[0];
  return { city, state, country };
}

export default function AddressFields({
  label,
  value,
  onChange,
}: {
  label: string;
  value: NexusProviderAddress;
  onChange: (next: NexusProviderAddress) => void;
}) {
  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState<AddressPrediction[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSearchChange(text: string) {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const results = await searchAddressAction(text);
      setPredictions(results);
      setOpen(results.length > 0);
    }, 300);
  }

  function selectPrediction(prediction: AddressPrediction) {
    const location = deriveLocationFromPrediction(prediction);
    onChange({
      ...value,
      ...location,
      latitude: String(prediction.lat),
      longitude: String(prediction.lng),
    });
    setQuery(prediction.description);
    setOpen(false);
  }

  return (
    <div className="d-flex flex-column" style={{ gap: 5 }}>
      <div className="d-flex justify-content-between align-items-center">
        <span style={labelStyle}>{label}</span>
      </div>

      <div ref={boxRef} style={{ position: 'relative' }}>
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearchChange(e.target.value)}
          onFocus={() => predictions.length > 0 && setOpen(true)}
          placeholder="Search Here"
          style={{ ...inputStyle, fontSize: 11, fontWeight: 600, padding: '9px 11px' }}
        />
        {open && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              right: 0,
              background: '#FFFFFF',
              border: '1px solid #E5E5E5',
              borderRadius: 6,
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              zIndex: 30,
              maxHeight: 200,
              overflowY: 'auto',
            }}
          >
            {predictions.map((p) => (
              <button
                key={p.placeId}
                type="button"
                onClick={() => selectPrediction(p)}
                className="d-block w-100 text-start"
                style={{ background: 'none', border: 'none', padding: '8px 11px', fontSize: 12, fontWeight: 500 }}
              >
                <div style={{ color: '#000', fontWeight: 600 }}>{p.mainText}</div>
                <div style={{ color: '#B7B7B7', fontSize: 10 }}>{p.secondaryText}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      <input
        type="text"
        value={value.houseNo ?? ''}
        onChange={(e) => onChange({ ...value, houseNo: e.target.value })}
        placeholder="House / Flat / Floor / Building No."
        style={inputStyle}
      />
      <input
        type="text"
        value={value.addressLineOne ?? ''}
        onChange={(e) => onChange({ ...value, addressLineOne: e.target.value })}
        placeholder="Street / Road / Area Name"
        style={inputStyle}
      />
    </div>
  );
}

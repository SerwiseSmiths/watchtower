'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import dynamic from 'next/dynamic';
import type { NexusCustomerAddress, CustomerAddressInput } from '@/lib/nexus/customers';
import type { AddressPrediction } from '@/lib/nexus/geocode';
import { searchAddressAction, reverseGeocodeAction } from './actions';

const AddressMap = dynamic(() => import('./AddressMap'), { ssr: false });

// Default center — Surat, matching this project's primary service area — used
// only until the admin searches or drops the pin somewhere real.
const DEFAULT_LAT = 21.1702;
const DEFAULT_LNG = 72.8311;

type SaveAs = 'Home' | 'Office' | 'Other';

const inputStyle: CSSProperties = {
  width: '100%',
  background: '#E5E5E5',
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

/** Ola Maps' geocoding only returns free-text description strings, not
 *  structured fields — this is a best-effort split, not a real geocoder. */
function deriveLocation(prediction: AddressPrediction): { city?: string; state?: string; country?: string } {
  const parts = prediction.secondaryText.split(',').map((p) => p.trim()).filter(Boolean);
  const country = parts[parts.length - 1];
  const state = parts[parts.length - 2];
  const city = parts[parts.length - 3] ?? parts[0];
  return { city, state, country };
}

export default function AddressMapModal({
  initial,
  onSave,
  onDelete,
  onCancel,
  saving,
}: {
  initial: Partial<NexusCustomerAddress>;
  onSave: (input: CustomerAddressInput) => void;
  onDelete?: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [saveAs, setSaveAs] = useState<SaveAs>((initial.title as SaveAs) ?? 'Home');
  const [houseNo, setHouseNo] = useState(initial.houseNo ?? '');
  const [street, setStreet] = useState(initial.addressLineOne ?? '');
  const [autofillText, setAutofillText] = useState(
    [initial.addressLineOne, initial.area, initial.city, initial.state].filter(Boolean).join(', '),
  );
  const [directionNote, setDirectionNote] = useState(initial.directionNote ?? '');
  const [lat, setLat] = useState(initial.latitude ? Number(initial.latitude) : DEFAULT_LAT);
  const [lng, setLng] = useState(initial.longitude ? Number(initial.longitude) : DEFAULT_LNG);
  const [location, setLocation] = useState<{ city?: string; state?: string; country?: string; pinCode?: string }>({
    city: initial.city ?? undefined,
    state: initial.state ?? undefined,
    country: initial.country ?? undefined,
    pinCode: initial.pinCode ?? undefined,
  });

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
    setLat(prediction.lat);
    setLng(prediction.lng);
    setAutofillText(prediction.description);
    setLocation(deriveLocation(prediction));
    setQuery('');
    setOpen(false);
  }

  async function handleMapChange(newLat: number, newLng: number) {
    setLat(newLat);
    setLng(newLng);
    const prediction = await reverseGeocodeAction(newLat, newLng);
    if (prediction) {
      setAutofillText(prediction.description);
      setLocation(deriveLocation(prediction));
    }
  }

  function submit() {
    onSave({
      title: saveAs,
      houseNo,
      // Address requires a societyName; this compact map-picker UI doesn't
      // collect one separately, so it falls back to the house/flat text.
      societyName: houseNo || 'Address',
      addressLineOne: street || undefined,
      city: location.city,
      state: location.state,
      country: location.country,
      pinCode: location.pinCode,
      latitude: String(lat),
      longitude: String(lng),
      directionNote: directionNote || undefined,
    });
  }

  const canSave = houseNo.trim().length > 0;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)' }}>
      <div
        className="d-flex"
        style={{ width: 768, background: '#FFFFFF', border: '2px solid #E5E5E5', borderRadius: 10, padding: 20, gap: 19 }}
      >
        <div style={{ width: 375, height: 502, borderRadius: 5, position: 'relative', flexShrink: 0 }}>
          <AddressMap lat={lat} lng={lng} onChange={handleMapChange} />

          <div
            ref={boxRef}
            style={{ position: 'absolute', top: 15, left: 15, right: 15, zIndex: 10 }}
          >
            <div className="d-flex align-items-center" style={{ background: '#FFFFFF', borderRadius: 5, padding: '12px 15px', gap: 9 }}>
              <span style={{ width: 13, height: 13, border: '2px solid #000', borderRadius: '50%', flexShrink: 0 }} />
              <input
                type="text"
                value={query}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={() => predictions.length > 0 && setOpen(true)}
                placeholder="Search Address"
                style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 16, fontWeight: 600, letterSpacing: '-0.03em', width: '100%' }}
              />
            </div>
            {open && (
              <div style={{ background: '#FFFFFF', borderRadius: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', marginTop: 4, maxHeight: 220, overflowY: 'auto' }}>
                {predictions.map((p) => (
                  <button
                    key={p.placeId}
                    type="button"
                    onClick={() => selectPrediction(p)}
                    className="d-block w-100 text-start"
                    style={{ background: 'none', border: 'none', padding: '8px 15px', fontSize: 12 }}
                  >
                    <div style={{ color: '#000', fontWeight: 600 }}>{p.mainText}</div>
                    <div style={{ color: '#B7B7B7', fontSize: 10 }}>{p.secondaryText}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="d-flex flex-column" style={{ width: 334, gap: 15 }}>
          <div>
            <div style={labelStyle}>Save As</div>
            <div className="d-flex" style={{ gap: 5 }}>
              {(['Home', 'Office', 'Other'] as SaveAs[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setSaveAs(option)}
                  style={{
                    flex: 1,
                    background: saveAs === option ? '#181818' : '#E5E5E5',
                    color: saveAs === option ? '#FFF' : '#454545',
                    border: 'none',
                    borderRadius: 5,
                    padding: '9px 0',
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: '-0.03em',
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={labelStyle}>House / Flat / Floor / Building No.</div>
            <input value={houseNo} onChange={(e) => setHouseNo(e.target.value)} style={inputStyle} />
          </div>

          <div>
            <div style={labelStyle}>Street / Road / Area Name</div>
            <input value={street} onChange={(e) => setStreet(e.target.value)} style={inputStyle} />
          </div>

          <div>
            <div style={labelStyle}>Location Autofill Box</div>
            <div style={{ ...inputStyle, minHeight: 60, color: autofillText ? '#000' : '#B7B7B7' }}>
              {autofillText || 'Search or drop the pin to fill this in'}
            </div>
          </div>

          <div>
            <div style={labelStyle}>Direction Note</div>
            <textarea
              value={directionNote}
              onChange={(e) => setDirectionNote(e.target.value)}
              rows={2}
              style={{ ...inputStyle, resize: 'none' }}
            />
          </div>

          <div className="d-flex" style={{ gap: 6 }}>
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="d-flex align-items-center justify-content-center"
                style={{ width: 50, height: 55, background: '#FFC3C3', border: 'none', borderRadius: 5, flexShrink: 0 }}
              >
                <svg width="16" height="20" viewBox="0 0 16 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 5h14M6 1h4a1 1 0 0 1 1 1v3H5V2a1 1 0 0 1 1-1ZM3 5h10l-1 13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1L3 5Z"
                    stroke="#FF0000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
            <button
              type="button"
              onClick={submit}
              disabled={!canSave || saving}
              className="flex-grow-1"
              style={{ background: '#000000', color: '#FFFFFF', border: 'none', borderRadius: 5, fontSize: 16, fontWeight: 700, letterSpacing: '-0.03em', opacity: !canSave || saving ? 0.5 : 1 }}
            >
              {saving ? 'Saving…' : 'Save Address'}
            </button>
          </div>

          <button type="button" onClick={onCancel} style={{ background: 'none', border: 'none', color: '#B7B7B7', fontSize: 12, fontWeight: 600, alignSelf: 'flex-start' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

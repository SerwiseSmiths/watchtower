'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const MARKER_ICON = L.divIcon({
  className: '',
  html: `<div style="width:19px;height:19px;border-radius:50%;background:#266BFF;border:5px solid #FFFFFF;box-shadow:0 0 17.8px 5px rgba(0,0,0,0.25);"></div>`,
  iconSize: [19, 19],
  iconAnchor: [9, 9],
});

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  return null;
}

function DragTarget({ onDragEnd }: { onDragEnd: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => onDragEnd(e.latlng.lat, e.latlng.lng),
  });
  return null;
}

export default function AddressMap({
  lat,
  lng,
  onChange,
}: {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
}) {
  return (
    <MapContainer center={[lat, lng]} zoom={15} style={{ width: '100%', height: '100%', borderRadius: 5 }} attributionControl={false}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Marker
        position={[lat, lng]}
        icon={MARKER_ICON}
        draggable
        eventHandlers={{
          dragend: (e) => {
            const { lat: newLat, lng: newLng } = e.target.getLatLng();
            onChange(newLat, newLng);
          },
        }}
      />
      <DragTarget onDragEnd={onChange} />
      <Recenter lat={lat} lng={lng} />
    </MapContainer>
  );
}

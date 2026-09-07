import { nexusFetch } from './client';

export interface AddressPrediction {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
  lat: number;
  lng: number;
  types: string[];
}

export async function autocompleteAddress(input: string): Promise<AddressPrediction[]> {
  if (input.trim().length < 3) return [];
  const res = await nexusFetch(`/address/autocomplete?input=${encodeURIComponent(input)}`);
  const body = await res.json();
  return body.data?.predictions ?? [];
}

export async function reverseGeocodeAddress(lat: number, lng: number): Promise<AddressPrediction | null> {
  const res = await nexusFetch(`/address/reverse-geocode?lat=${lat}&lng=${lng}`);
  const body = await res.json();
  return body.data?.prediction ?? null;
}

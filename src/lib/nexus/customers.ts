import { nexusFetch } from './client';

export interface NexusCustomerAddress {
  id: string;
  title: string | null;
  houseNo: string;
  societyName: string;
  addressLineOne: string | null;
  addressLineTwo: string | null;
  area: string | null;
  pinCode: string | null;
  city: string | null;
  state: string | null;
  country: string;
  latitude: string | null;
  longitude: string | null;
  directionNote: string | null;
  isDeleted: boolean;
  createdAt: string;
}

export interface NexusCustomerListItem {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phoneNo: string;
  email: string | null;
  avatar: string | null;
  createdAt: string;
  pinCode: string | null;
  location: string | null;
  walletBalance: number;
}

export interface NexusCustomerDetail {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phoneNo: string;
  email: string | null;
  avatar: string | null;
  createdAt: string;
  updatedAt: string;
  addresses: NexusCustomerAddress[];
  walletBalance: number;
}

export async function fetchAllCustomers(search?: string): Promise<NexusCustomerListItem[]> {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  const res = await nexusFetch(`/user/customers${query}`);
  const body = await res.json();
  return body.data.customers as NexusCustomerListItem[];
}

export async function fetchCustomer(id: string): Promise<NexusCustomerDetail> {
  const res = await nexusFetch(`/user/customers/${id}`);
  const body = await res.json();
  return body.data.customer as NexusCustomerDetail;
}

export interface UpdateCustomerInput {
  firstName?: string;
  lastName?: string;
  phoneNo?: string;
  email?: string;
}

export async function updateCustomer(id: string, input: UpdateCustomerInput): Promise<NexusCustomerDetail> {
  const res = await nexusFetch(`/user/customers/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await res.json();
  return body.data.customer as NexusCustomerDetail;
}

export interface CustomerAddressInput {
  title?: string;
  houseNo: string;
  societyName: string;
  addressLineOne?: string;
  addressLineTwo?: string;
  area?: string;
  pinCode?: string;
  city?: string;
  state?: string;
  country?: string;
  latitude?: string;
  longitude?: string;
  directionNote?: string;
}

export async function createCustomerAddress(customerId: string, input: CustomerAddressInput): Promise<NexusCustomerAddress> {
  const res = await nexusFetch(`/user/customers/${customerId}/addresses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await res.json();
  return body.data.address as NexusCustomerAddress;
}

export async function updateCustomerAddress(
  customerId: string,
  addressId: string,
  input: Partial<CustomerAddressInput>,
): Promise<NexusCustomerAddress> {
  const res = await nexusFetch(`/user/customers/${customerId}/addresses/${addressId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await res.json();
  return body.data.address as NexusCustomerAddress;
}

export async function archiveCustomerAddress(customerId: string, addressId: string): Promise<void> {
  await nexusFetch(`/user/customers/${customerId}/addresses/${addressId}/archive`, { method: 'PATCH' });
}

export async function restoreCustomerAddress(customerId: string, addressId: string): Promise<void> {
  await nexusFetch(`/user/customers/${customerId}/addresses/${addressId}/restore`, { method: 'PATCH' });
}

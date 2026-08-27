'use server';

import { revalidatePath } from 'next/cache';
import { createCustomer, type NexusCustomerDetail, type CreateCustomerInput } from '@/lib/nexus/customers';

export async function createCustomerAction(input: CreateCustomerInput): Promise<NexusCustomerDetail> {
  const customer = await createCustomer(input);
  revalidatePath('/customers');
  return customer;
}

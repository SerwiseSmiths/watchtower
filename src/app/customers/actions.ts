'use server';

import { revalidatePath } from 'next/cache';
import { createCustomer, type NexusCustomerDetail, type CreateCustomerInput } from '@/lib/nexus/customers';
import { logAudit } from '@/lib/audit/log';

export async function createCustomerAction(input: CreateCustomerInput): Promise<NexusCustomerDetail> {
  const customer = await createCustomer(input);
  revalidatePath('/customers');
  await logAudit({
    module: 'customer',
    action: 'CREATE',
    entityId: customer.id,
    entityLabel: [customer.firstName, customer.lastName].filter(Boolean).join(' ') || customer.phoneNo,
    after: { ...customer },
  });
  return customer;
}

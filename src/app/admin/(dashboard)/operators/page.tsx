import { listOperatorsWithCredentials } from '@/lib/auth/operators';
import OperatorsView from './OperatorsView';

export default async function OperatorsPage() {
  const operators = await listOperatorsWithCredentials();

  return (
    <OperatorsView
      operators={operators.map((op) => ({
        id: op.id,
        phoneNumber: op.phone_number,
        isActive: op.is_active,
        adminUser: {
          id: op.admin_user.id,
          email: op.admin_user.email,
          name: [op.admin_user.firstname, op.admin_user.lastname].filter(Boolean).join(' ') || op.admin_user.email || `#${op.admin_user.id}`,
        },
        credentials: op.credentials.map((c) => ({
          id: c.id,
          deviceLabel: c.device_label,
          createdAt: c.created_at.toISOString(),
          lastUsedAt: c.last_used_at ? c.last_used_at.toISOString() : null,
        })),
        pendingEnrollments: op.enrollments.length,
      }))}
    />
  );
}

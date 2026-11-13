import { redirect } from 'next/navigation';
import RootSidebar from '@/components/RootSidebar';
import StyledComponentsRegistry from '@/lib/admin/styled-components-registry';
import { listOperatorsWithCredentials } from '@/lib/auth/operators';
import { getRootSession } from '@/lib/auth/require-root-session';
import CmsThemeProvider from '../cms/CmsThemeProvider';
import OperatorsView from './OperatorsView';

export default async function OperatorsPage() {
  const session = await getRootSession();
  if (!session) redirect('/');

  const operators = await listOperatorsWithCredentials();

  return (
    <div style={{ minHeight: '100vh', minWidth: 'fit-content', background: '#F2F2F2', display: 'flex' }}>
      <RootSidebar />
      <main className="flex-grow-1" style={{ padding: '44px 40px' }}>
        <StyledComponentsRegistry>
          <CmsThemeProvider>
            <OperatorsView
              currentOperatorId={session.operatorId}
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
          </CmsThemeProvider>
        </StyledComponentsRegistry>
      </main>
    </div>
  );
}

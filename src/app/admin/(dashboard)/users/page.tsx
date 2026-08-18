import { listAdminUsers } from '@/lib/auth/admin-users';
import UsersView from './UsersView';

export default async function UsersPage() {
  const users = await listAdminUsers();

  return (
    <UsersView
      users={users.map((u) => ({
        id: u.id,
        name: [u.firstname, u.lastname].filter(Boolean).join(' ') || u.email || `#${u.id}`,
        email: u.email,
        isActive: u.is_active ?? false,
        createdAt: u.created_at ? u.created_at.toISOString() : null,
      }))}
    />
  );
}

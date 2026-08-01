import type { Metadata } from 'next';
import StyledComponentsRegistry from '@/lib/admin/styled-components-registry';
import AdminThemeProvider from './AdminThemeProvider';

export const metadata: Metadata = {
  title: 'Watchtower Admin',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <StyledComponentsRegistry>
      <AdminThemeProvider>{children}</AdminThemeProvider>
    </StyledComponentsRegistry>
  );
}

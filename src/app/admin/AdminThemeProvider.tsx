'use client';

import { DesignSystemProvider, lightTheme, Main } from '@strapi/design-system';

export default function AdminThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <DesignSystemProvider theme={lightTheme}>
      <Main>{children}</Main>
    </DesignSystemProvider>
  );
}

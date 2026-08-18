'use client';

import { DesignSystemProvider, lightTheme, Main } from '@strapi/design-system';

// The landing page's next/font (Outfit) sets font-family via a CSS class on <body>, which — being a
// class selector — outranks the design system's own `body { font-family: ... }` global style. Since
// <body> is owned by the shared root layout, the only way to give /admin its correct Strapi font
// stack back is an inline style on a wrapper here (inline styles beat any class-selector rule).
const STRAPI_FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif";

export default function AdminThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: STRAPI_FONT_STACK, height: '100%' }}>
      <DesignSystemProvider theme={lightTheme}>
        <Main>{children}</Main>
      </DesignSystemProvider>
    </div>
  );
}

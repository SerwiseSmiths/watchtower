'use client';

import { Flex, Loader } from '@strapi/design-system';

// Shown the instant a row/Edit click navigates here, while the entry, its relations and the
// media list load — without it the list looks unresponsive for a few seconds.
export default function EntryLoading() {
  return (
    <Flex justifyContent="center" alignItems="center" minHeight="60vh">
      <Loader>Loading entry…</Loader>
    </Flex>
  );
}

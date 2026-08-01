'use client';

import { useActionState } from 'react';
import { Box, Button, Field, Flex, TextInput, Typography } from '@strapi/design-system';
import { loginAction, type LoginState } from './actions';

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<LoginState | undefined, FormData>(loginAction, undefined);

  return (
    <Flex alignItems="center" justifyContent="center" minHeight="100vh" background="neutral100">
      <Box background="neutral0" padding={8} shadow="tableShadow" hasRadius width="30rem">
        <Typography variant="alpha" tag="h1">
          Watchtower
        </Typography>
        <Box paddingTop={2} paddingBottom={6}>
          <Typography textColor="neutral600">Sign in to manage content</Typography>
        </Box>

        <form action={formAction}>
          <Box paddingBottom={4}>
            <Field.Root name="email" required>
              <Field.Label>Email</Field.Label>
              <TextInput name="email" type="email" placeholder="you@serwise.co.in" />
            </Field.Root>
          </Box>
          <Box paddingBottom={4}>
            <Field.Root name="password" required>
              <Field.Label>Password</Field.Label>
              <TextInput name="password" type="password" placeholder="••••••••" />
            </Field.Root>
          </Box>

          {state?.error && (
            <Box paddingBottom={4}>
              <Typography textColor="danger600">{state.error}</Typography>
            </Box>
          )}

          <Button type="submit" fullWidth loading={pending}>
            Sign in
          </Button>
        </form>
      </Box>
    </Flex>
  );
}

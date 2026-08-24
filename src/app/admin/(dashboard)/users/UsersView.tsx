'use client';

import { useState, useTransition } from 'react';
import {
  Box,
  Button,
  Field,
  Flex,
  Modal,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  TextInput,
  Toggle,
  Tr,
  Typography,
} from '@strapi/design-system';
import { Plus, User as UserIcon } from '@strapi/icons';
import { createUserAction, toggleUserActiveAction } from './actions';
import PageHeader from '../PageHeader';

interface AdminUser {
  id: number;
  name: string;
  email: string | null;
  isActive: boolean;
  createdAt: string | null;
}

export default function UsersView({ users }: { users: AdminUser[] }) {
  const [isPending, startTransition] = useTransition();
  const [addOpen, setAddOpen] = useState(false);

  const [firstname, setFirstname] = useState('');
  const [lastname, setLastname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setFirstname('');
    setLastname('');
    setEmail('');
    setPassword('');
    setError(null);
  }

  function submitCreate() {
    setError(null);
    startTransition(async () => {
      try {
        await createUserAction(firstname, lastname, email, password);
        setAddOpen(false);
        resetForm();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create user');
      }
    });
  }

  const canSubmit = firstname.trim() && lastname.trim() && email.trim() && password.length >= 8;

  return (
    <Box>
      <PageHeader
        title="Users"
        subtitle="Admin accounts for watchtower and console — used to sign in at /admin and to become Operators."
        primaryAction={
          <Button startIcon={<Plus />} onClick={() => setAddOpen(true)}>
            Add user
          </Button>
        }
      />

      <Table colCount={4} rowCount={users.length + 1}>
        <Thead>
          <Tr>
            <Th><Typography variant="sigma">Name</Typography></Th>
            <Th><Typography variant="sigma">Email</Typography></Th>
            <Th><Typography variant="sigma">Active</Typography></Th>
            <Th><Typography variant="sigma">Created</Typography></Th>
          </Tr>
        </Thead>
        <Tbody>
          {users.map((u) => (
            <Tr key={u.id}>
              <Td>
                <Flex gap={2} alignItems="center">
                  <UserIcon width="1.4rem" height="1.4rem" fill="neutral500" />
                  <Typography>{u.name}</Typography>
                </Flex>
              </Td>
              <Td><Typography>{u.email ?? '—'}</Typography></Td>
              <Td>
                <Toggle
                  checked={u.isActive}
                  onLabel="Active"
                  offLabel="Inactive"
                  onChange={() => startTransition(() => toggleUserActiveAction(u.id, !u.isActive))}
                />
              </Td>
              <Td>
                <Typography textColor="neutral600">
                  {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                </Typography>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      {addOpen && (
        <Modal.Root
          open
          onOpenChange={(open: boolean) => {
            if (!open) {
              setAddOpen(false);
              resetForm();
            }
          }}
        >
          <Modal.Content>
            <Modal.Header>
              <Modal.Title>Add user</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Flex direction="column" gap={4} alignItems="stretch">
                <Field.Root name="firstname">
                  <Field.Label>First name</Field.Label>
                  <TextInput
                    value={firstname}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFirstname(e.target.value)}
                  />
                </Field.Root>
                <Field.Root name="lastname">
                  <Field.Label>Last name</Field.Label>
                  <TextInput
                    value={lastname}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLastname(e.target.value)}
                  />
                </Field.Root>
                <Field.Root name="email">
                  <Field.Label>Email</Field.Label>
                  <TextInput
                    type="email"
                    value={email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                    placeholder="name@serwise.co.in"
                  />
                </Field.Root>
                <Field.Root name="password" hint="Share this with them directly — there's no invite email yet.">
                  <Field.Label>Password</Field.Label>
                  <TextInput
                    type="password"
                    value={password}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                  />
                  <Field.Hint />
                </Field.Root>
                {error && (
                  <Typography textColor="danger600">{error}</Typography>
                )}
              </Flex>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="tertiary" onClick={() => { setAddOpen(false); resetForm(); }}>Cancel</Button>
              <Button onClick={submitCreate} loading={isPending} disabled={!canSubmit}>
                Add
              </Button>
            </Modal.Footer>
          </Modal.Content>
        </Modal.Root>
      )}
    </Box>
  );
}

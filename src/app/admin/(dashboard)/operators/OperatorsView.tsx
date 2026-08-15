'use client';

import { useState, useTransition } from 'react';
import {
  Box,
  Button,
  Combobox,
  ComboboxOption,
  Field,
  Flex,
  IconButton,
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
import { Plus, Trash, Key } from '@strapi/icons';
import {
  createOperatorAction,
  generateEnrollmentAction,
  revokeCredentialAction,
  searchAdminUsersAction,
  toggleOperatorActiveAction,
} from './actions';

interface Credential {
  id: number;
  deviceLabel: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

interface Operator {
  id: number;
  phoneNumber: string;
  isActive: boolean;
  adminUser: { id: number; email: string | null; name: string };
  credentials: Credential[];
  pendingEnrollments: number;
}

export default function OperatorsView({ operators }: { operators: Operator[] }) {
  const [isPending, startTransition] = useTransition();
  const [addOpen, setAddOpen] = useState(false);
  const [enrollFor, setEnrollFor] = useState<Operator | null>(null);
  const [enrollUrl, setEnrollUrl] = useState<string | null>(null);
  const [deviceLabel, setDeviceLabel] = useState('');

  const [candidates, setCandidates] = useState<{ id: number; name: string; email: string | null }[]>([]);
  const [selectedAdminId, setSelectedAdminId] = useState<string | null>(null);
  const [newPhone, setNewPhone] = useState('');

  async function onSearch(value: string) {
    const results = await searchAdminUsersAction(value);
    setCandidates(results);
  }

  function submitAddOperator() {
    if (!selectedAdminId || !newPhone.trim()) return;
    startTransition(async () => {
      await createOperatorAction(Number(selectedAdminId), newPhone);
      setAddOpen(false);
      setSelectedAdminId(null);
      setNewPhone('');
    });
  }

  function openEnroll(op: Operator) {
    setEnrollFor(op);
    setEnrollUrl(null);
    setDeviceLabel('');
  }

  function submitEnroll() {
    if (!enrollFor) return;
    startTransition(async () => {
      const result = await generateEnrollmentAction(enrollFor.id, deviceLabel);
      setEnrollUrl(result.url);
    });
  }

  return (
    <Box>
      <Flex justifyContent="space-between" alignItems="flex-start" paddingBottom={4}>
        <Box>
          <Typography variant="alpha" tag="h1">
            Operators
          </Typography>
          <Typography textColor="neutral600">
            Accounts authorized to sign in at the root (`/`) phone+OTP+passkey login.
          </Typography>
        </Box>
        <Button startIcon={<Plus />} onClick={() => setAddOpen(true)}>
          Add operator
        </Button>
      </Flex>

      <Table colCount={5} rowCount={operators.length + 1}>
        <Thead>
          <Tr>
            <Th><Typography variant="sigma">Admin</Typography></Th>
            <Th><Typography variant="sigma">Phone</Typography></Th>
            <Th><Typography variant="sigma">Active</Typography></Th>
            <Th><Typography variant="sigma">Passkeys</Typography></Th>
            <Th><Typography variant="sigma">Actions</Typography></Th>
          </Tr>
        </Thead>
        <Tbody>
          {operators.map((op) => (
            <Tr key={op.id}>
              <Td>
                <Typography>{op.adminUser.name}</Typography>
                <Typography variant="pi" textColor="neutral600">{op.adminUser.email}</Typography>
              </Td>
              <Td><Typography>{op.phoneNumber}</Typography></Td>
              <Td>
                <Toggle
                  checked={op.isActive}
                  onLabel="Active"
                  offLabel="Inactive"
                  onChange={() => startTransition(() => toggleOperatorActiveAction(op.id, !op.isActive))}
                />
              </Td>
              <Td>
                {op.credentials.length === 0 ? (
                  <Typography textColor="neutral600">None registered</Typography>
                ) : (
                  op.credentials.map((c) => (
                    <Flex key={c.id} gap={2} alignItems="center">
                      <Typography variant="pi">{c.deviceLabel ?? 'Unlabeled device'}</Typography>
                      <IconButton
                        label="Revoke"
                        variant="ghost"
                        onClick={() => startTransition(() => revokeCredentialAction(c.id))}
                      >
                        <Trash />
                      </IconButton>
                    </Flex>
                  ))
                )}
              </Td>
              <Td>
                <Button variant="secondary" startIcon={<Key />} onClick={() => openEnroll(op)} loading={isPending}>
                  Generate enrollment link
                </Button>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      {addOpen && (
        <Modal.Root open onOpenChange={(open: boolean) => !open && setAddOpen(false)}>
          <Modal.Content>
            <Modal.Header>
              <Modal.Title>Add operator</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Box paddingBottom={4}>
                <Field.Root name="adminUser">
                  <Field.Label>Admin account</Field.Label>
                  <Combobox
                    value={selectedAdminId ?? undefined}
                    onChange={(value: string | null) => setSelectedAdminId(value)}
                    onInputChange={(e: React.ChangeEvent<HTMLInputElement>) => onSearch(e.target.value)}
                    onOpenChange={(open: boolean) => open && onSearch('')}
                  >
                    {candidates.map((c) => (
                      <ComboboxOption key={c.id} value={String(c.id)}>
                        {c.name}
                        {c.email ? ` (${c.email})` : ''}
                      </ComboboxOption>
                    ))}
                  </Combobox>
                </Field.Root>
              </Box>
              <Field.Root name="phoneNumber">
                <Field.Label>Phone number</Field.Label>
                <TextInput
                  value={newPhone}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPhone(e.target.value)}
                  placeholder="9112345678"
                />
              </Field.Root>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="tertiary" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button onClick={submitAddOperator} loading={isPending} disabled={!selectedAdminId || !newPhone.trim()}>
                Add
              </Button>
            </Modal.Footer>
          </Modal.Content>
        </Modal.Root>
      )}

      {enrollFor && (
        <Modal.Root open onOpenChange={(open: boolean) => !open && setEnrollFor(null)}>
          <Modal.Content>
            <Modal.Header>
              <Modal.Title>Enrollment link for {enrollFor.adminUser.name}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              {!enrollUrl ? (
                <Field.Root name="deviceLabel">
                  <Field.Label>Device label (optional)</Field.Label>
                  <TextInput
                    value={deviceLabel}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDeviceLabel(e.target.value)}
                    placeholder="e.g. work laptop"
                  />
                </Field.Root>
              ) : (
                <Box>
                  <Typography textColor="neutral600">
                    Single-use, expires in 15 minutes. Send it only to the person and device it&apos;s meant for:
                  </Typography>
                  <Box paddingTop={2}>
                    <Typography fontWeight="bold" style={{ wordBreak: 'break-all' }}>{enrollUrl}</Typography>
                  </Box>
                </Box>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="tertiary" onClick={() => setEnrollFor(null)}>Close</Button>
              {!enrollUrl && (
                <Button onClick={submitEnroll} loading={isPending}>
                  Generate
                </Button>
              )}
            </Modal.Footer>
          </Modal.Content>
        </Modal.Root>
      )}
    </Box>
  );
}

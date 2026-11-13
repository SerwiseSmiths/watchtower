'use client';

import { useState, useTransition } from 'react';
import {
  Box,
  Button,
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
  toggleOperatorActiveAction,
} from './actions';
import PageHeader from '../cms/PageHeader';

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

const EMPTY_NEW_OPERATOR = { firstname: '', lastname: '', email: '', phoneNumber: '' };

export default function OperatorsView({ operators, currentOperatorId }: { operators: Operator[]; currentOperatorId: number }) {
  const [isPending, startTransition] = useTransition();
  const [addOpen, setAddOpen] = useState(false);
  const [enrollFor, setEnrollFor] = useState<Operator | null>(null);
  const [enrollUrl, setEnrollUrl] = useState<string | null>(null);
  const [deviceLabel, setDeviceLabel] = useState('');

  const [newOperator, setNewOperator] = useState(EMPTY_NEW_OPERATOR);
  const [addError, setAddError] = useState<string | null>(null);
  const canSubmitNew = Object.values(newOperator).every((v) => v.trim());

  function closeAdd() {
    setAddOpen(false);
    setNewOperator(EMPTY_NEW_OPERATOR);
    setAddError(null);
  }

  function submitAddOperator() {
    if (!canSubmitNew) return;
    startTransition(async () => {
      try {
        await createOperatorAction(newOperator);
        closeAdd();
      } catch (err) {
        setAddError(err instanceof Error ? err.message : 'Could not add operator');
      }
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
      <PageHeader
        title="Operators"
        subtitle="Accounts authorized to sign in at the root (`/`) phone+OTP+passkey login."
        primaryAction={
          <Button startIcon={<Plus />} onClick={() => setAddOpen(true)}>
            Add operator
          </Button>
        }
      />

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
                  disabled={op.id === currentOperatorId}
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
        <Modal.Root open onOpenChange={(open: boolean) => !open && closeAdd()}>
          <Modal.Content>
            <Modal.Header>
              <Modal.Title>Add operator</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Flex direction="column" alignItems="stretch" gap={4}>
                <Flex gap={4}>
                  <Field.Root name="firstname" style={{ flex: 1 }}>
                    <Field.Label>First name</Field.Label>
                    <TextInput
                      value={newOperator.firstname}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewOperator({ ...newOperator, firstname: e.target.value })}
                    />
                  </Field.Root>
                  <Field.Root name="lastname" style={{ flex: 1 }}>
                    <Field.Label>Last name</Field.Label>
                    <TextInput
                      value={newOperator.lastname}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewOperator({ ...newOperator, lastname: e.target.value })}
                    />
                  </Field.Root>
                </Flex>
                <Field.Root name="email">
                  <Field.Label>Email</Field.Label>
                  <TextInput
                    type="email"
                    value={newOperator.email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewOperator({ ...newOperator, email: e.target.value })}
                  />
                </Field.Root>
                <Field.Root name="phoneNumber">
                  <Field.Label>Phone number</Field.Label>
                  <TextInput
                    value={newOperator.phoneNumber}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewOperator({ ...newOperator, phoneNumber: e.target.value })}
                    placeholder="9112345678"
                  />
                </Field.Root>
                {addError && <Typography textColor="danger600">{addError}</Typography>}
              </Flex>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="tertiary" onClick={closeAdd}>Cancel</Button>
              <Button onClick={submitAddOperator} loading={isPending} disabled={!canSubmitNew}>
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

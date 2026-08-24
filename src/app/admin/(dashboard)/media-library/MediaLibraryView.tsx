'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import NextLink from 'next/link';
import {
  Badge,
  Box,
  Button,
  Checkbox,
  Dialog,
  EmptyStateLayout,
  Field,
  Flex,
  IconButton,
  Modal,
  NextLink as PaginationNextLink,
  PageLink,
  Pagination,
  PreviousLink,
  SearchForm,
  Searchbar,
  SingleSelect,
  SingleSelectOption,
  TextInput,
  Textarea,
  Typography,
} from '@strapi/design-system';
import { Plus, Trash, Upload } from '@strapi/icons';
import { createFolderAction, deleteFolderAction, deleteMediaAction, updateMediaAction, uploadMediaAction } from './actions';
import PageHeader from '../PageHeader';

export interface MediaLibraryFileRow {
  id: number;
  url: string | null;
  name: string | null;
  mime: string | null;
  ext: string | null;
  size: number | null;
  width: number | null;
  height: number | null;
  alternativeText: string | null;
  caption: string | null;
}

export interface MediaFolderRow {
  id: number;
  name: string;
}

export interface MediaLibraryViewProps {
  files: MediaLibraryFileRow[];
  folders: MediaFolderRow[];
  pagination: { page: number; pageSize: number; pageCount: number; total: number };
  query: string;
  activeFolderId: number | null;
  activeType: string;
}

function buildUrl(params: Record<string, string | number | undefined>): string {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') usp.set(key, String(value));
  }
  const qs = usp.toString();
  return `/admin/media-library${qs ? `?${qs}` : ''}`;
}

function pageWindow(active: number, count: number): number[] {
  const start = Math.max(1, active - 2);
  const end = Math.min(count, start + 4);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

function isImage(mime: string | null): boolean {
  return !!mime && mime.startsWith('image/');
}

function FileThumb({ file }: { file: MediaLibraryFileRow }) {
  if (isImage(file.mime) && file.url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={file.url} alt={file.alternativeText ?? file.name ?? ''} style={{ width: '100%', height: 140, objectFit: 'cover' }} />;
  }
  return (
    <Flex height="140px" alignItems="center" justifyContent="center" background="neutral100">
      <Typography variant="pi" textColor="neutral600">
        {(file.ext ?? '').replace('.', '').toUpperCase() || 'FILE'}
      </Typography>
    </Flex>
  );
}

function EditAssetModal({ file, onClose }: { file: MediaLibraryFileRow; onClose: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(file.name ?? '');
  const [alternativeText, setAlternativeText] = useState(file.alternativeText ?? '');
  const [caption, setCaption] = useState(file.caption ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    startTransition(async () => {
      await updateMediaAction(file.id, { name, alternativeText, caption });
      router.refresh();
      onClose();
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteMediaAction([file.id]);
      if (result.blockedIds.length > 0) {
        setError('This asset is used by at least one entry and cannot be deleted.');
        setConfirmDelete(false);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <Modal.Root open onOpenChange={(open) => !open && onClose()}>
      <Modal.Content>
        <Modal.Header>
          <Modal.Title>Edit asset</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Flex direction="column" alignItems="stretch" gap={4}>
            <Box hasRadius overflow="hidden" background="neutral150">
              <FileThumb file={file} />
            </Box>

            {error && (
              <Typography variant="pi" textColor="danger600">
                {error}
              </Typography>
            )}

            <Field.Root>
              <Field.Label>Name</Field.Label>
              <TextInput value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} />
            </Field.Root>
            <Field.Root>
              <Field.Label>Alternative text</Field.Label>
              <TextInput
                value={alternativeText}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAlternativeText(e.target.value)}
              />
            </Field.Root>
            <Field.Root>
              <Field.Label>Caption</Field.Label>
              <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} />
            </Field.Root>

            <Flex direction="column" gap={1} alignItems="flex-start">
              <Typography variant="pi" fontWeight="bold" textColor="neutral600">
                Details
              </Typography>
              <Typography variant="pi" textColor="neutral600">
                {file.mime ?? 'unknown type'}
                {file.width && file.height ? ` · ${file.width}×${file.height}` : ''}
                {file.size != null ? ` · ${file.size} KB` : ''}
              </Typography>
            </Flex>
          </Flex>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="danger-light" startIcon={<Trash />} onClick={() => setConfirmDelete(true)}>
            Delete
          </Button>
          <Flex gap={2}>
            <Button variant="tertiary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={isPending}>
              Save
            </Button>
          </Flex>
        </Modal.Footer>
      </Modal.Content>

      <Dialog.Root open={confirmDelete} onOpenChange={setConfirmDelete}>
        <Dialog.Content>
          <Dialog.Header>Confirmation</Dialog.Header>
          <Dialog.Body>Delete this asset? This action cannot be undone.</Dialog.Body>
          <Dialog.Footer>
            <Dialog.Cancel>
              <Button variant="tertiary">Cancel</Button>
            </Dialog.Cancel>
            <Dialog.Action>
              <Button variant="danger-light" onClick={handleDelete} loading={isPending}>
                Confirm
              </Button>
            </Dialog.Action>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Root>
    </Modal.Root>
  );
}

export default function MediaLibraryView({ files, folders, pagination, query, activeFolderId, activeType }: MediaLibraryViewProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [searchValue, setSearchValue] = useState(query);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editingFile, setEditingFile] = useState<MediaLibraryFileRow | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [bulkDeleteMessage, setBulkDeleteMessage] = useState<string | null>(null);

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSearchSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    router.push(buildUrl({ q: searchValue, folder: activeFolderId ?? undefined, type: activeType }));
  }

  function handleUploadClick() {
    fileInputRef.current?.click();
  }

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    setUploadError(null);
    const formData = new FormData();
    for (const file of Array.from(fileList)) formData.append('files', file);
    if (activeFolderId != null) formData.set('folderId', String(activeFolderId));
    startTransition(async () => {
      try {
        await uploadMediaAction(formData);
        router.refresh();
      } catch {
        setUploadError('Upload failed. Check your Cloudinary configuration and try again.');
      }
    });
    e.target.value = '';
  }

  function handleBulkDelete() {
    startTransition(async () => {
      const result = await deleteMediaAction(Array.from(selected));
      setSelected(new Set());
      setConfirmBulkDelete(false);
      if (result.blockedIds.length > 0) {
        setBulkDeleteMessage(`${result.blockedIds.length} asset(s) are still used by an entry and were not deleted.`);
      }
      router.refresh();
    });
  }

  function handleCreateFolder() {
    if (!newFolderName.trim()) return;
    startTransition(async () => {
      await createFolderAction(newFolderName.trim());
      setNewFolderName('');
      setCreatingFolder(false);
      router.refresh();
    });
  }

  return (
    <Box>
      <input ref={fileInputRef} type="file" multiple hidden onChange={handleFilesSelected} />

      <PageHeader
        title="Media Library"
        subtitle={`${pagination.total} asset(s)`}
        primaryAction={
          <Button startIcon={<Upload />} onClick={handleUploadClick} loading={isPending}>
            Upload assets
          </Button>
        }
      />

      {uploadError && (
        <Box paddingBottom={2}>
          <Typography textColor="danger600">{uploadError}</Typography>
        </Box>
      )}
      {bulkDeleteMessage && (
        <Box paddingBottom={2}>
          <Typography textColor="warning600">{bulkDeleteMessage}</Typography>
        </Box>
      )}

      <Flex alignItems="flex-start" gap={6}>
        <Box width="16rem" style={{ flexShrink: 0 }}>
          <Typography variant="sigma" textColor="neutral600">
            Folders
          </Typography>
          <Flex direction="column" alignItems="stretch" gap={1} paddingTop={2}>
            <NextLink href={buildUrl({ q: query, type: activeType })} style={{ textDecoration: 'none' }}>
              <Box padding={2} hasRadius background={activeFolderId == null ? 'primary100' : undefined}>
                <Typography fontWeight={activeFolderId == null ? 'bold' : 'regular'}>All assets</Typography>
              </Box>
            </NextLink>
            {folders.map((folder) => (
              <Flex key={folder.id} justifyContent="space-between" alignItems="center" gap={1}>
                <NextLink href={buildUrl({ q: query, folder: folder.id, type: activeType })} style={{ textDecoration: 'none', flex: 1, minWidth: 0 }}>
                  <Box padding={2} hasRadius background={activeFolderId === folder.id ? 'primary100' : undefined}>
                    <Typography fontWeight={activeFolderId === folder.id ? 'bold' : 'regular'} ellipsis>
                      {folder.name}
                    </Typography>
                  </Box>
                </NextLink>
                <IconButton
                  label={`Delete ${folder.name}`}
                  variant="ghost"
                  onClick={() => startTransition(async () => { await deleteFolderAction(folder.id); router.refresh(); })}
                >
                  <Trash />
                </IconButton>
              </Flex>
            ))}
          </Flex>

          {creatingFolder ? (
            <Flex direction="column" gap={2} paddingTop={2}>
              <TextInput
                aria-label="Folder name"
                value={newFolderName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewFolderName(e.target.value)}
                placeholder="Folder name"
              />
              <Flex gap={2}>
                <Button size="S" onClick={handleCreateFolder} loading={isPending}>
                  Create
                </Button>
                <Button size="S" variant="tertiary" onClick={() => setCreatingFolder(false)}>
                  Cancel
                </Button>
              </Flex>
            </Flex>
          ) : (
            <Box paddingTop={2}>
              <Button variant="ghost" startIcon={<Plus />} onClick={() => setCreatingFolder(true)}>
                New folder
              </Button>
            </Box>
          )}
        </Box>

        <Box flex={1} style={{ minWidth: 0 }}>
          <Flex gap={2} alignItems="center" paddingBottom={4} wrap="wrap">
            <Box maxWidth="20rem" flex={1}>
              <SearchForm onSubmit={handleSearchSubmit}>
                <Searchbar
                  name="q"
                  value={searchValue}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchValue(e.target.value)}
                  clearLabel="Clear search"
                  onClear={() => {
                    setSearchValue('');
                    router.push(buildUrl({ folder: activeFolderId ?? undefined, type: activeType }));
                  }}
                >
                  Search assets
                </Searchbar>
              </SearchForm>
            </Box>
            <Box maxWidth="12rem">
              <SingleSelect
                aria-label="Filter by type"
                value={activeType || 'all'}
                onChange={(value) =>
                  router.push(buildUrl({ q: query, folder: activeFolderId ?? undefined, type: value === 'all' ? undefined : String(value) }))
                }
              >
                <SingleSelectOption value="all">All types</SingleSelectOption>
                <SingleSelectOption value="image">Images</SingleSelectOption>
                <SingleSelectOption value="video">Videos</SingleSelectOption>
                <SingleSelectOption value="audio">Audio</SingleSelectOption>
              </SingleSelect>
            </Box>
          </Flex>

          {selected.size > 0 && (
            <Flex justifyContent="space-between" alignItems="center" padding={3} background="primary100" hasRadius marginBottom={4}>
              <Typography>{selected.size} selected</Typography>
              <Button variant="danger-light" onClick={() => setConfirmBulkDelete(true)}>
                Delete
              </Button>
            </Flex>
          )}

          {files.length === 0 ? (
            <EmptyStateLayout content="No assets found" />
          ) : (
            <>
              <Flex gap={4} wrap="wrap">
                {files.map((file) => (
                  <Box key={file.id} width="16rem" position="relative">
                    <Box position="absolute" top={2} left={2} style={{ zIndex: 1 }}>
                      <Checkbox aria-label={`Select ${file.name}`} checked={selected.has(file.id)} onCheckedChange={() => toggleSelect(file.id)} />
                    </Box>
                    <button
                      type="button"
                      onClick={() => setEditingFile(file)}
                      style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%' }}
                    >
                      <Box background="neutral0" hasRadius overflow="hidden" borderColor="neutral200" style={{ borderWidth: 1, borderStyle: 'solid' }}>
                        <FileThumb file={file} />
                        <Box padding={2}>
                          <Typography variant="pi" ellipsis fontWeight="bold" tag="div">
                            {file.name}
                          </Typography>
                          <Flex gap={1} paddingTop={1}>
                            <Badge variant="neutral">{(file.ext ?? '').replace('.', '').toUpperCase() || '—'}</Badge>
                            {file.size != null && <Typography variant="pi" textColor="neutral600">{file.size} KB</Typography>}
                          </Flex>
                        </Box>
                      </Box>
                    </button>
                  </Box>
                ))}
              </Flex>

              <Box paddingTop={6}>
                <Pagination activePage={pagination.page} pageCount={pagination.pageCount} label="Media library pagination">
                  <Flex gap={1}>
                    {pagination.page > 1 && (
                      <PreviousLink tag={NextLink} href={buildUrl({ page: pagination.page - 1, q: query, folder: activeFolderId ?? undefined, type: activeType })}>
                        Previous
                      </PreviousLink>
                    )}
                    {pageWindow(pagination.page, pagination.pageCount).map((p) => (
                      <PageLink key={p} number={p} tag={NextLink} href={buildUrl({ page: p, q: query, folder: activeFolderId ?? undefined, type: activeType })}>
                        {p}
                      </PageLink>
                    ))}
                    {pagination.page < pagination.pageCount && (
                      <PaginationNextLink tag={NextLink} href={buildUrl({ page: pagination.page + 1, q: query, folder: activeFolderId ?? undefined, type: activeType })}>
                        Next
                      </PaginationNextLink>
                    )}
                  </Flex>
                </Pagination>
              </Box>
            </>
          )}
        </Box>
      </Flex>

      {editingFile && <EditAssetModal file={editingFile} onClose={() => setEditingFile(null)} />}

      <Dialog.Root open={confirmBulkDelete} onOpenChange={setConfirmBulkDelete}>
        <Dialog.Content>
          <Dialog.Header>Confirmation</Dialog.Header>
          <Dialog.Body>Delete {selected.size} asset(s)? This action cannot be undone.</Dialog.Body>
          <Dialog.Footer>
            <Dialog.Cancel>
              <Button variant="tertiary">Cancel</Button>
            </Dialog.Cancel>
            <Dialog.Action>
              <Button variant="danger-light" onClick={handleBulkDelete} loading={isPending}>
                Confirm
              </Button>
            </Dialog.Action>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Root>
    </Box>
  );
}

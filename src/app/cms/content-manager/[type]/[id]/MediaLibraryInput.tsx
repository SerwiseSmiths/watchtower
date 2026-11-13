'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Button,
  CarouselActions,
  CarouselInput,
  CarouselSlide,
  EmptyStateLayout,
  Flex,
  Grid,
  IconButton,
  Modal,
  Searchbar,
  Typography,
} from '@strapi/design-system';
import { Link as LinkIcon, Plus, PlusCircle, Trash, Upload } from '@strapi/icons';
import { uploadMediaAction } from '../../../media-library/actions';
import AssetCard, { assetExtension, assetVariant, type Asset } from '../../../media/AssetCard';

/**
 * Strapi's media field (@strapi/upload MediaLibraryInput): a carousel of the selected assets with
 * add / copy-link / remove actions, an empty "click to add" slide, and an asset-picker dialog.
 */

function CarouselAsset({ asset }: { asset: Asset }) {
  const variant = assetVariant(asset.mime);
  if (variant === 'Image' && asset.url) {
    return <Box tag="img" maxHeight="100%" maxWidth="100%" src={asset.url} alt={asset.alternativeText || asset.name || ''} />;
  }
  if (variant === 'Video' && asset.url) {
    return <Box tag="video" src={asset.url} controls maxHeight="100%" maxWidth="100%" />;
  }
  return (
    <Flex width="100%" height="100%" justifyContent="center" alignItems="center" hasRadius style={{ background: 'linear-gradient(180deg, #ffffff 0%, #f6f6f9 121.48%)' }}>
      <Typography variant="beta" textColor="neutral600">
        {assetExtension(asset) || 'FILE'}
      </Typography>
    </Flex>
  );
}

function EmptyStateAsset({ onClick }: { onClick: () => void }) {
  return (
    <Flex direction="column" justifyContent="center" alignItems="center" height="100%" width="100%" tag="button" type="button" onClick={onClick} gap={3} style={{ cursor: 'pointer' }}>
      <PlusCircle aria-hidden width="3.2rem" height="3.2rem" fill="primary600" />
      <Typography variant="pi" fontWeight="bold" textColor="neutral600" style={{ textAlign: 'center' }} tag="span">
        Click to add an asset
      </Typography>
    </Flex>
  );
}

function AssetPickerDialog({
  library,
  multiple,
  initiallySelected,
  onClose,
  onFinish,
}: {
  library: Asset[];
  multiple: boolean;
  initiallySelected: Asset[];
  onClose: () => void;
  onFinish: (assets: Asset[]) => void;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, startUpload] = useTransition();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Asset[]>(initiallySelected);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? library.filter((a) => a.name?.toLowerCase().includes(q)) : library;
  }, [library, query]);

  function toggle(asset: Asset) {
    const isSelected = selected.some((s) => s.id === asset.id);
    if (multiple) setSelected(isSelected ? selected.filter((s) => s.id !== asset.id) : [...selected, asset]);
    else setSelected(isSelected ? [] : [asset]);
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    const formData = new FormData();
    for (const file of Array.from(files)) formData.append('files', file);
    setUploadError(null);
    startUpload(async () => {
      try {
        await uploadMediaAction(formData);
        router.refresh(); // reloads the page's media list so the new assets appear here
      } catch {
        setUploadError('Upload failed. Check the Cloudinary configuration and try again.');
      }
    });
    e.target.value = '';
  }

  return (
    <Modal.Root open onOpenChange={(open: boolean) => !open && onClose()}>
      <Modal.Content style={{ maxWidth: '83rem', width: '100%' }}>
        <Modal.Header>
          <Modal.Title>Add new assets</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <input ref={fileInputRef} type="file" multiple hidden onChange={handleUpload} />
          <Flex justifyContent="space-between" alignItems="center" gap={2} paddingBottom={4}>
            <Box flex={1} maxWidth="24rem">
              <Searchbar
                name="asset-search"
                value={query}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
                onClear={() => setQuery('')}
                clearLabel="Clear search"
              >
                Search assets
              </Searchbar>
            </Box>
            <Button variant="secondary" startIcon={<Upload />} onClick={() => fileInputRef.current?.click()} loading={isUploading}>
              Upload assets
            </Button>
          </Flex>
          {uploadError && (
            <Box paddingBottom={2}>
              <Typography textColor="danger600">{uploadError}</Typography>
            </Box>
          )}
          {visible.length === 0 ? (
            <EmptyStateLayout content={query ? 'No assets match this search' : 'No assets in the media library yet'} />
          ) : (
            <Grid.Root gap={4}>
              {visible.map((asset) => {
                const isSelected = selected.some((s) => s.id === asset.id);
                return (
                  <Grid.Item key={asset.id} col={3} m={4} s={6} xs={12} height="100%" direction="column" alignItems="stretch">
                    <AssetCard asset={asset} size="S" selectable selected={isSelected} onSelect={() => toggle(asset)} onClick={() => toggle(asset)} />
                  </Grid.Item>
                );
              })}
            </Grid.Root>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="tertiary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onFinish(selected)}>Finish{selected.length > 0 ? ` (${selected.length})` : ''}</Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  );
}

export default function MediaLibraryInput({
  label,
  multiple,
  value,
  onChange,
  library,
}: {
  label: string;
  multiple: boolean;
  value: unknown;
  onChange: (value: unknown) => void;
  library: Asset[];
}) {
  const assets = useMemo<Asset[]>(() => {
    if (multiple) return (Array.isArray(value) ? value : []) as Asset[];
    return value ? [value as Asset] : [];
  }, [multiple, value]);
  const [index, setIndex] = useState(0);
  const [picking, setPicking] = useState(false);
  const [copied, setCopied] = useState(false);
  const selectedIndex = Math.min(index, Math.max(assets.length - 1, 0));
  const current = assets[selectedIndex];

  function commit(next: Asset[]) {
    onChange(multiple ? next : next[0] ?? null);
  }

  function handleFinish(picked: Asset[]) {
    setPicking(false);
    if (!multiple) {
      commit(picked.slice(0, 1));
      return;
    }
    // Keep already-attached assets, append newly picked ones (Strapi appends after the current slide).
    const pickedIds = new Set(picked.map((a) => a.id));
    const kept = assets.filter((a) => pickedIds.has(a.id));
    const added = picked.filter((a) => !assets.some((existing) => existing.id === a.id));
    commit([...kept, ...added]);
  }

  function removeCurrent() {
    if (!current) return;
    commit(assets.filter((a) => a.id !== current.id));
    setIndex(Math.max(selectedIndex - 1, 0));
  }

  async function copyLink() {
    if (!current?.url) return;
    await navigator.clipboard.writeText(current.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <>
      <CarouselInput
        label={label}
        secondaryLabel={current?.name ?? undefined}
        selectedSlide={selectedIndex}
        previousLabel="Previous slide"
        nextLabel="Next slide"
        onNext={() => setIndex(assets.length ? (selectedIndex + 1) % assets.length : 0)}
        onPrevious={() => setIndex(assets.length ? (selectedIndex - 1 + assets.length) % assets.length : 0)}
        actions={
          current ? (
            <CarouselActions>
              <IconButton label={multiple ? 'Add' : 'Replace'} onClick={() => setPicking(true)}>
                <Plus />
              </IconButton>
              <IconButton label={copied ? 'Link copied' : 'Copy link'} onClick={copyLink}>
                <LinkIcon />
              </IconButton>
              <IconButton label="Delete" onClick={removeCurrent}>
                <Trash />
              </IconButton>
            </CarouselActions>
          ) : undefined
        }
      >
        {assets.length === 0 ? (
          <CarouselSlide label="1 of 1 slides">
            <EmptyStateAsset onClick={() => setPicking(true)} />
          </CarouselSlide>
        ) : (
          assets.map((asset, i) => (
            <CarouselSlide key={asset.id} label={`${i + 1} of ${assets.length} slides`} selected={i === selectedIndex}>
              <CarouselAsset asset={asset} />
            </CarouselSlide>
          ))
        )}
      </CarouselInput>

      {picking && (
        <AssetPickerDialog
          library={library}
          multiple={multiple}
          initiallySelected={multiple ? assets : []}
          onClose={() => setPicking(false)}
          onFinish={handleFinish}
        />
      )}
    </>
  );
}

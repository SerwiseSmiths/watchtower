'use client';

import {
  Box,
  Card,
  CardAction,
  CardAsset,
  CardBadge,
  CardBody,
  CardCheckbox,
  CardContent,
  CardHeader,
  CardSubtitle,
  CardTitle,
  Flex,
  IconButton,
  Typography,
} from '@strapi/design-system';
import { Pencil, Trash } from '@strapi/icons';
import { styled } from 'styled-components';

export interface Asset {
  id: number;
  url: string | null;
  name: string | null;
  mime: string | null;
  ext?: string | null;
  width?: number | null;
  height?: number | null;
  size?: number | null;
  alternativeText?: string | null;
}

export type AssetVariant = 'Image' | 'Video' | 'Audio' | 'Doc';

export function assetVariant(mime: string | null | undefined): AssetVariant {
  if (mime?.startsWith('image/')) return 'Image';
  if (mime?.startsWith('video/')) return 'Video';
  if (mime?.startsWith('audio/')) return 'Audio';
  return 'Doc';
}

export function assetExtension(asset: Pick<Asset, 'ext' | 'name' | 'mime'>): string {
  const fromExt = asset.ext?.replace('.', '');
  if (fromExt) return fromExt.toUpperCase();
  const fromName = asset.name?.includes('.') ? asset.name.split('.').pop() : undefined;
  return (fromName ?? asset.mime?.split('/').pop() ?? '').toUpperCase();
}

/** Strapi's transparency checkerboard, used behind every asset preview so transparent PNG/SVG
 *  logos stay visible instead of disappearing into a white card. */
export const CHECKERBOARD_BACKGROUND =
  'repeating-conic-gradient(#f0f0ff 0% 25%, transparent 0% 50%) 50% / 20px 20px';

// Mirrors @strapi/upload's AssetCardBase: actions fade in on hover, checkbox top-left.
const CardActionsContainer = styled(CardAction)`
  opacity: 0;
  z-index: 1;
  &:focus-within {
    opacity: 1;
  }
`;

const CardContainer = styled(Card)`
  cursor: pointer;
  &:hover ${CardActionsContainer} {
    opacity: 1;
  }
`;

const DocPreview = styled(Flex)`
  background: linear-gradient(180deg, #ffffff 0%, #f6f6f9 121.48%);
`;

export function AssetPreview({ asset, size = 'M' }: { asset: Asset; size?: 'S' | 'M' }) {
  const variant = assetVariant(asset.mime);
  if (variant === 'Image' && asset.url) {
    return <CardAsset src={asset.url} alt={asset.alternativeText || asset.name || ''} size={size} loading="lazy" />;
  }
  if (variant === 'Video' && asset.url) {
    return (
      <CardAsset size={size}>
        <Box tag="video" src={asset.url} muted preload="metadata" maxHeight="100%" maxWidth="100%" />
      </CardAsset>
    );
  }
  return (
    <CardAsset size={size}>
      <DocPreview width="100%" height="100%" justifyContent="center" alignItems="center">
        <Typography variant="omega" fontWeight="bold" textColor="neutral600">
          {assetExtension(asset) || 'FILE'}
        </Typography>
      </DocPreview>
    </CardAsset>
  );
}

export interface AssetCardProps {
  asset: Asset;
  size?: 'S' | 'M';
  selectable?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  onClick?: () => void;
  onEdit?: () => void;
  onRemove?: () => void;
}

export default function AssetCard({ asset, size = 'M', selectable, selected = false, onSelect, onClick, onEdit, onRemove }: AssetCardProps) {
  const variant = assetVariant(asset.mime);
  const dimensions = asset.width && asset.height ? ` - ${asset.width}✕${asset.height}` : '';
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <CardContainer role="button" height="100%" tabIndex={-1} onClick={onClick ?? onEdit}>
      <CardHeader>
        {selectable && (
          <Box onClick={stop} style={{ zIndex: 1 }}>
            <CardCheckbox checked={selected} onCheckedChange={() => onSelect?.()} />
          </Box>
        )}
        {(onEdit || onRemove) && (
          <CardActionsContainer onClick={stop} position="end">
            {onRemove && (
              <IconButton label="Remove from selection" onClick={onRemove}>
                <Trash />
              </IconButton>
            )}
            {onEdit && (
              <IconButton label="Edit" onClick={onEdit}>
                <Pencil />
              </IconButton>
            )}
          </CardActionsContainer>
        )}
        <AssetPreview asset={asset} size={size} />
      </CardHeader>
      <CardBody>
        {/* minWidth 0 lets the flex item shrink so long names ellipsize instead of wrapping. */}
        <CardContent style={{ minWidth: 0, flex: 1 }}>
          <Box paddingTop={1}>
            <Typography tag="h2" ellipsis title={asset.name ?? undefined} style={{ display: 'block' }}>
              <CardTitle tag="span">{asset.name}</CardTitle>
            </Typography>
          </Box>
          <CardSubtitle>
            <span style={{ textTransform: 'uppercase' }}>{assetExtension(asset)}</span>
            {dimensions}
          </CardSubtitle>
        </CardContent>
        <Flex paddingTop={1} style={{ flexShrink: 0 }}>
          <CardBadge>{variant}</CardBadge>
        </Flex>
      </CardBody>
    </CardContainer>
  );
}

import type { Database, Json } from '../lib/database.types';

export type ProductRow = Database['public']['Tables']['products']['Row'];

export type ProductMediaItem = {
  MediaType?: string | null;
  URL?: string | null;
  [key: string]: unknown;
};

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const normalizeMedia = (media: ProductRow['product_media']): ProductMediaItem[] => {
  if (!media || !Array.isArray(media)) return [];
  return media
    .filter(
      (item): item is { [key: string]: Json | undefined } =>
        !!item && typeof item === 'object' && !Array.isArray(item)
    )
    .map(item => item as ProductMediaItem);
};

export const normalizeImages = (images: ProductRow['images']): string[] => {
  if (!images || !Array.isArray(images)) return [];
  return images.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
};

export const getHeroImage = (product: ProductRow, mediaList?: ProductMediaItem[]): string | null => {
  const media = mediaList ?? normalizeMedia(product.product_media);

  for (const item of media) {
    const type = normalizeString(item.MediaType)?.toLowerCase();
    const url = normalizeString(item.URL);
    if (url && (!type || type.includes('image'))) {
      return url;
    }
  }

  for (const field of [product.item_image_url, product.product_family_image_url]) {
    const normalized = normalizeString(field);
    if (normalized) return normalized;
  }

  const imageArray = normalizeImages(product.images);
  if (imageArray.length > 0) return imageArray[0];

  return null;
};

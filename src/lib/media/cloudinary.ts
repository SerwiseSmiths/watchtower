import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET,
});

export interface CloudinaryUploadResult {
  url: string;
  publicId: string;
  format: string | null;
  width: number | null;
  height: number | null;
  bytes: number;
  resourceType: string;
}

function resourceTypeFor(mime: string): 'image' | 'video' | 'raw' {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  return 'raw';
}

/** Same account/folder convention `console`'s Strapi upload plugin uses (see console/config/plugins.ts). */
export async function uploadToCloudinary(buffer: Buffer, mime: string): Promise<CloudinaryUploadResult> {
  const resourceType = resourceTypeFor(mime);
  const base64 = `data:${mime};base64,${buffer.toString('base64')}`;
  const result = await cloudinary.uploader.upload(base64, { resource_type: resourceType, folder: 'strapi-uploads' });
  return {
    url: result.secure_url,
    publicId: result.public_id,
    format: result.format ?? null,
    width: result.width ?? null,
    height: result.height ?? null,
    bytes: result.bytes,
    resourceType,
  };
}

export async function deleteFromCloudinary(publicId: string, resourceType: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}

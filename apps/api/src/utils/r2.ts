import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
  R2_PUBLIC_URL,
} = process.env;

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID!,
        secretAccessKey: R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return s3Client;
}

export function isR2Configured(): boolean {
  return !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME && R2_PUBLIC_URL);
}

export async function processImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
}

export async function processAvatar(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize(256, 256, { fit: 'cover' })
    .webp({ quality: 80 })
    .toBuffer();
}

export async function processCover(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize(1200, undefined, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
}

export async function uploadEntityImage(buffer: Buffer, keyPrefix: string): Promise<string> {
  const client = getS3Client();
  const key = `${keyPrefix}.webp`;

  await client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: 'image/webp',
    })
  );

  return `${R2_PUBLIC_URL}/${key}?v=${Date.now()}`;
}

export async function uploadImageToR2(buffer: Buffer, itemId: string): Promise<string> {
  const client = getS3Client();
  const key = `items/${itemId}/${Date.now()}.webp`;

  await client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: 'image/webp',
    })
  );

  return `${R2_PUBLIC_URL}/${key}`;
}

export async function uploadFileToR2(
  buffer: Buffer,
  itemId: string,
  originalFilename: string,
  contentType: string
): Promise<string> {
  const client = getS3Client();
  // Sanitize filename: keep only alphanumeric, dots, hyphens, underscores
  const sanitized = originalFilename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const key = `items/${itemId}/${Date.now()}-${sanitized}`;

  await client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ContentDisposition: `inline; filename="${sanitized}"`,
    })
  );

  return `${R2_PUBLIC_URL}/${key}`;
}

export async function deleteFileFromR2(url: string): Promise<void> {
  if (!R2_PUBLIC_URL || !url.startsWith(R2_PUBLIC_URL)) return;

  const key = url.slice(R2_PUBLIC_URL.length + 1);
  const client = getS3Client();

  await client.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    })
  );
}

export async function deleteImageFromR2(url: string): Promise<void> {
  if (!R2_PUBLIC_URL || !url.startsWith(R2_PUBLIC_URL)) return;

  const key = url.slice(R2_PUBLIC_URL.length + 1); // remove prefix + "/"
  const client = getS3Client();

  await client.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    })
  );
}

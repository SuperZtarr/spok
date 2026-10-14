/*
 * Stockage des fichiers (images, documents, avatars, covers) : Cloudflare R2 (S3) en prod, redimensionnement (sharp).
 * isR2Configured() garde toutes les routes d'upload.
 * copyR2Object : duplique un objet pour les copies de séance — une copie ne partage jamais le fichier de la source.
 *
 * Mode LOCAL (dev uniquement, 2026-10-14) : si R2 n'est pas configuré ET NODE_ENV !== 'production', les fichiers
 * sont écrits dans apps/api/.local-uploads/<clé> (ignoré par git) et servis par GET /local-uploads/* (routes/
 * local-uploads.ts), URL publique « /api/local-uploads/<clé> » (proxy Vite /api → API). Mêmes clés que sur R2.
 * Jamais actif en production : sans R2, la prod refuse les uploads comme avant.
 * Les variables d'environnement sont lues à chaque appel (testable, pas figé au chargement du module).
 */
import { S3Client, PutObjectCommand, DeleteObjectCommand, CopyObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { mkdir, writeFile, unlink, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const env = () => process.env;

/** Dossier du stockage local : apps/api/.local-uploads (src/utils ou dist/utils → ../../). */
export const LOCAL_UPLOADS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '.local-uploads');
/** Préfixe d'URL des fichiers locaux, vu du navigateur (proxy Vite /api). */
export const LOCAL_UPLOADS_URL = '/api/local-uploads';

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${env().R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env().R2_ACCESS_KEY_ID!,
        secretAccessKey: env().R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return s3Client;
}

/** Vrai R2 configuré (les 5 variables). */
function hasR2(): boolean {
  const e = env();
  return !!(e.R2_ACCOUNT_ID && e.R2_ACCESS_KEY_ID && e.R2_SECRET_ACCESS_KEY && e.R2_BUCKET_NAME && e.R2_PUBLIC_URL);
}

/** Mode local : pas de R2 et hors production. */
export function isLocalStorageMode(): boolean {
  return !hasR2() && env().NODE_ENV !== 'production';
}

/** Stockage disponible (R2, ou disque local en dev) — garde des routes d'upload. */
export function isR2Configured(): boolean {
  return hasR2() || isLocalStorageMode();
}

/** Base des URLs publiques du stockage actif. */
function publicBase(): string {
  return isLocalStorageMode() ? LOCAL_UPLOADS_URL : env().R2_PUBLIC_URL!;
}

/** Chemin disque d'une clé locale — refuse toute clé qui sortirait du dossier (.., chemin absolu). */
export function localPathForKey(key: string): string | null {
  const full = path.resolve(LOCAL_UPLOADS_DIR, key);
  return full.startsWith(LOCAL_UPLOADS_DIR + path.sep) ? full : null;
}

async function putObject(key: string, body: Buffer, contentType: string, contentDisposition?: string): Promise<void> {
  if (isLocalStorageMode()) {
    const full = localPathForKey(key);
    if (!full) throw new Error('Clé de stockage invalide');
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, body);
    return;
  }
  await getS3Client().send(new PutObjectCommand({
    Bucket: env().R2_BUCKET_NAME, Key: key, Body: body, ContentType: contentType,
    ...(contentDisposition ? { ContentDisposition: contentDisposition } : {}),
  }));
}

async function deleteObject(key: string): Promise<void> {
  if (isLocalStorageMode()) {
    const full = localPathForKey(key);
    if (full) await unlink(full).catch(() => undefined);
    return;
  }
  await getS3Client().send(new DeleteObjectCommand({ Bucket: env().R2_BUCKET_NAME, Key: key }));
}

/** Clé d'une URL du stockage actif (sans le préfixe ni le ?v=), ou null si l'URL n'en vient pas. */
function keyFromUrl(url: string): string | null {
  const base = publicBase();
  if (!base || !url.startsWith(`${base}/`)) return null;
  return url.slice(base.length + 1).split('?')[0];
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
  const key = `${keyPrefix}.webp`;
  await putObject(key, buffer, 'image/webp');
  return `${publicBase()}/${key}?v=${Date.now()}`;
}

export async function uploadImageToR2(buffer: Buffer, itemId: string): Promise<string> {
  const key = `items/${itemId}/${Date.now()}.webp`;
  await putObject(key, buffer, 'image/webp');
  return `${publicBase()}/${key}`;
}

export async function uploadFileToR2(
  buffer: Buffer,
  itemId: string,
  originalFilename: string,
  contentType: string
): Promise<string> {
  // Sanitize filename: keep only alphanumeric, dots, hyphens, underscores
  const sanitized = originalFilename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const key = `items/${itemId}/${Date.now()}-${sanitized}`;
  await putObject(key, buffer, contentType, `inline; filename="${sanitized}"`);
  return `${publicBase()}/${key}`;
}

export async function deleteFileFromR2(url: string): Promise<void> {
  const key = keyFromUrl(url);
  if (key) await deleteObject(key);
}

export async function deleteImageFromR2(url: string): Promise<void> {
  const key = keyFromUrl(url);
  if (key) await deleteObject(key);
}

/** L'URL désigne-t-elle un fichier du stockage actif (R2, ou local en dev) ? */
export function isR2Url(url: string | null | undefined): url is string {
  return !!url && keyFromUrl(url) !== null;
}

/** Duplique un objet sous items/<newItemId>/… et retourne sa nouvelle URL publique. */
export async function copyR2Object(url: string, newItemId: string): Promise<string> {
  const key = keyFromUrl(url);
  if (!key) throw new Error('URL hors du stockage');
  const fileName = key.split('/').pop()!;
  const newKey = `items/${newItemId}/${Date.now()}-${fileName}`;
  if (isLocalStorageMode()) {
    const src = localPathForKey(key);
    const dest = localPathForKey(newKey);
    if (!src || !dest) throw new Error('Clé de stockage invalide');
    await mkdir(path.dirname(dest), { recursive: true });
    await copyFile(src, dest);
  } else {
    await getS3Client().send(new CopyObjectCommand({
      Bucket: env().R2_BUCKET_NAME,
      CopySource: `${env().R2_BUCKET_NAME}/${key}`,
      Key: newKey,
    }));
  }
  return `${publicBase()}/${newKey}`;
}

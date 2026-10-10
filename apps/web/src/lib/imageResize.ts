/*
 * Réduction d'image dans le navigateur avant envoi : ramène JPEG/PNG/WebP à 1920 px max (plus grand côté),
 * réencodé en WebP (repli JPEG si le navigateur n'encode pas le WebP).
 * Pourquoi : le serveur (apps/api/src/utils/r2.ts processImage) réduit déjà à 1920 px WebP, mais refuse
 * tout envoi > 5 Mo — une photo de téléphone était donc rejetée. Résultat final identique, envoi plus léger.
 * Règles : jamais les GIF (la réduction ne garderait que la 1re image de l'animation) ; une image déjà
 * petite et légère est renvoyée telle quelle ; en cas d'échec de décodage, on renvoie le fichier d'origine
 * (la validation de taille tranchera ensuite).
 */
import { IMAGE_MAX_SIZE } from './uploadRules';

export const IMAGE_RESIZE_MAX_DIMENSION = 1920;
const RESIZABLE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function shouldResize(mimeType: string): boolean {
  return RESIZABLE_TYPES.includes(mimeType);
}

export function computeTargetSize(width: number, height: number, max = IMAGE_RESIZE_MAX_DIMENSION) {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const ratio = max / longest;
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function resizeImageFile(file: File): Promise<File> {
  if (!shouldResize(file.type)) return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  try {
    const target = computeTargetSize(bitmap.width, bitmap.height);
    const alreadySmall = target.width === bitmap.width && file.size <= IMAGE_MAX_SIZE;
    if (alreadySmall) return file;

    const canvas = document.createElement('canvas');
    canvas.width = target.width;
    canvas.height = target.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, target.width, target.height);

    let blob = await canvasToBlob(canvas, 'image/webp', 0.9);
    if (!blob || blob.type !== 'image/webp') blob = await canvasToBlob(canvas, 'image/jpeg', 0.9);
    if (!blob) return file;

    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
    const base = file.name.replace(/\.[^.]+$/, '');
    return new File([blob], `${base}.${ext}`, { type: blob.type, lastModified: file.lastModified });
  } finally {
    bitmap.close();
  }
}

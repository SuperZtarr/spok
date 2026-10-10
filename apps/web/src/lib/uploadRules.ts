/*
 * Règles d'envoi de fichiers côté web — source unique pour ImageUploadZone, FileUploadZone et l'import en masse.
 * - 'image' : JPEG/PNG/WebP/GIF, 5 Mo max (après réduction éventuelle, cf. imageResize).
 * - 'document' : tout format sauf exécutables/scripts, 25 Mo max.
 * Miroir des contrôles de l'API (apps/api/src/routes/item-uploads.ts) : modifier les deux ensemble.
 * validateUploadFile renvoie le message d'erreur à afficher, ou null si le fichier est acceptable.
 */

export type UploadKind = 'image' | 'document';

export const IMAGE_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const IMAGE_MAX_SIZE = 5 * 1024 * 1024; // 5 Mo

export const DOCUMENT_BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.com', '.scr', '.msi', '.dll',
  '.sh', '.bash', '.zsh', '.ps1', '.psm1', '.psd1',
  '.vbs', '.vbe', '.js', '.jse', '.wsf', '.wsh',
  '.jar', '.py', '.rb', '.pl', '.php',
]);
export const DOCUMENT_MAX_SIZE = 25 * 1024 * 1024; // 25 Mo

export function validateUploadFile(file: File, kind: UploadKind): string | null {
  if (kind === 'image') {
    if (!IMAGE_ACCEPTED_TYPES.includes(file.type)) return 'Format non supporté. Utilisez JPEG, PNG, WebP ou GIF.';
    if (file.size > IMAGE_MAX_SIZE) return 'Fichier trop volumineux (max 5 Mo).';
    return null;
  }
  const ext = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '');
  if (DOCUMENT_BLOCKED_EXTENSIONS.has(ext)) return 'Ce type de fichier n\'est pas autorisé.';
  if (file.size > DOCUMENT_MAX_SIZE) return 'Fichier trop volumineux (max 25 Mo).';
  return null;
}

/** Titre d'item déduit d'un nom de fichier : sans la dernière extension, jamais vide. */
export function titleFromFileName(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

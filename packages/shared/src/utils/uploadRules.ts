/*
 * Règles d'envoi de fichiers — source unique web + API (formats, tailles, fichiers interdits).
 * - 'image' : JPEG/PNG/WebP/GIF, 5 Mo max (images d'item, avatars et couvertures).
 * - 'document' : tout format sauf exécutables/scripts (extension OU type MIME), 25 Mo max.
 * validateUpload ne dépend pas de File (navigateur) : l'API l'appelle avec le mimetype/nom du
 * multipart, d'abord sans size (avant lecture du fichier) puis avec la taille du buffer.
 * Renvoie le message d'erreur à afficher, ou null si le fichier est acceptable.
 * Ne jamais réécrire ces listes ailleurs : importer depuis @spok/shared.
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
export const DOCUMENT_BLOCKED_MIME_TYPES = new Set([
  'application/x-msdownload',
  'application/x-executable',
  'application/x-sh',
  'application/x-bat',
  'application/x-msi',
  'application/x-dosexec',
]);
export const DOCUMENT_MAX_SIZE = 25 * 1024 * 1024; // 25 Mo

export const UPLOAD_ERRORS = {
  imageFormat: 'Format non supporté. Utilisez JPEG, PNG, WebP ou GIF.',
  imageSize: 'Fichier trop volumineux (max 5 Mo).',
  documentType: 'Ce type de fichier n\'est pas autorisé.',
  documentSize: 'Fichier trop volumineux (max 25 Mo).',
} as const;

export interface UploadCandidate {
  mimeType: string;
  fileName: string;
  /** Taille en octets ; omise = contrôle de taille sauté (fichier pas encore lu). */
  size?: number;
}

export function validateUpload(kind: UploadKind, file: UploadCandidate): string | null {
  if (kind === 'image') {
    if (!IMAGE_ACCEPTED_TYPES.includes(file.mimeType)) return UPLOAD_ERRORS.imageFormat;
    if (file.size !== undefined && file.size > IMAGE_MAX_SIZE) return UPLOAD_ERRORS.imageSize;
    return null;
  }
  const ext = '.' + (file.fileName.split('.').pop()?.toLowerCase() ?? '');
  if (DOCUMENT_BLOCKED_EXTENSIONS.has(ext) || DOCUMENT_BLOCKED_MIME_TYPES.has(file.mimeType)) {
    return UPLOAD_ERRORS.documentType;
  }
  if (file.size !== undefined && file.size > DOCUMENT_MAX_SIZE) return UPLOAD_ERRORS.documentSize;
  return null;
}

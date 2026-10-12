/*
 * Règles d'envoi de fichiers côté web — adaptateur File de la source unique @spok/shared (uploadRules),
 * partagée avec l'API : ne jamais redéfinir les formats/tailles ici.
 * Utilisé par ImageUploadZone, FileUploadZone et l'import en masse.
 * validateUploadFile renvoie le message d'erreur à afficher, ou null si le fichier est acceptable.
 */
import { validateUpload, type UploadKind } from '@spok/shared';

export {
  type UploadKind,
  IMAGE_ACCEPTED_TYPES,
  IMAGE_MAX_SIZE,
  DOCUMENT_BLOCKED_EXTENSIONS,
  DOCUMENT_MAX_SIZE,
} from '@spok/shared';

export function validateUploadFile(file: File, kind: UploadKind): string | null {
  return validateUpload(kind, { mimeType: file.type, fileName: file.name, size: file.size });
}

/** Titre d'item déduit d'un nom de fichier : sans la dernière extension, jamais vide. */
export function titleFromFileName(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

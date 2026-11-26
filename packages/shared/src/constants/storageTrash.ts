/* Registre de la corbeille du stockage (décision Thomas 2026-11-26).
   Raison d'être : un fichier d'élément (image, fichier, aperçu, image de description) que plus rien n'utilise part à la
   corbeille au lieu de rester orphelin et public dans le bucket : son adresse cesse aussitôt de répondre, il est gardé
   STORAGE_TRASH_GRACE_DAYS jours (la restauration d'un élément depuis l'historique le remet en place), puis effacé par
   la surveillance de l'API. Seule source du délai, des motifs et de leurs libellés : l'API (utils/storageTrash.ts), la
   page admin Volumétrie (rubrique Stockage) et l'aide en dérivent. Seuil d'alerte du volume stocké : VOLUMETRY_STORAGE_MAX_MB
   (volumetry.ts). */
import { volumetryLevel, VOLUMETRY_STORAGE_MAX_MB, type VolumetryLevel } from './volumetry.js';

/** Délai de grâce avant effacement définitif d'un fichier mis à la corbeille */
export const STORAGE_TRASH_GRACE_DAYS = 60;

/** Un fichier envoyé depuis moins longtemps n'est jamais pris pour un orphelin (envoi en cours, contenu pas encore créé) */
export const STORAGE_ORPHAN_MIN_AGE_HOURS = 1;

export const STORAGE_TRASH_REASONS = [
  { id: 'ITEM_DELETED', label: 'Élément supprimé' },
  { id: 'SPACE_DELETED', label: 'Espace supprimé' },
  { id: 'MERGE', label: 'Fusion ou absorption' },
  { id: 'CONTENT_REMOVED', label: 'Contenu retiré' },
  { id: 'ORPHAN_SWEEP', label: 'Orphelin ramassé' },
] as const;

export type StorageTrashReason = (typeof STORAGE_TRASH_REASONS)[number]['id'];
export const STORAGE_TRASH_REASON_IDS = STORAGE_TRASH_REASONS.map((r) => r.id) as [StorageTrashReason, ...StorageTrashReason[]];

export function storageTrashReasonLabel(reason: string): string {
  return STORAGE_TRASH_REASONS.find((r) => r.id === reason)?.label ?? reason;
}

/** Volume d'une partie du stockage */
export interface StorageVolume { count: number; sizeMB: number }

/** GET /admin/volumetry/storage : fichiers d'éléments actifs et corbeille, face au seuil */
export interface StorageReport {
  measuredAt: string;
  active: StorageVolume;
  trash: StorageVolume;
  maxMB: number;
  level: VolumetryLevel;
  graceDays: number;
}

/** Une entrée de la corbeille (GET /admin/volumetry/storage/trash) */
export interface StorageTrashEntry {
  id: string;
  key: string;
  name: string;
  size: number | null;
  reason: StorageTrashReason | string;
  itemId: string | null;
  itemTitle: string | null;
  spaceId: string | null;
  spaceName: string | null;
  trashedAt: string;
  purgeAfter: string;
}

/** Un fichier d'élément que plus rien n'utilise, hors corbeille (GET /admin/volumetry/storage/orphans) */
export interface StorageOrphan {
  key: string;
  name: string;
  size: number;
  lastModified: string | null;
  itemId: string | null;
  itemTitle: string | null;
}

/** Niveau du volume stocké (actifs + corbeille) face au seuil */
export function storageLevel(totalMB: number): VolumetryLevel {
  return volumetryLevel(0, totalMB, null, VOLUMETRY_STORAGE_MAX_MB);
}

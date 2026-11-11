/* Contenus d'un élément (refonte « contenus multiples », lot 1, 2026-11-08) : un élément porte plusieurs contenus
 * (images, fichiers, liens, schémas) au lieu du seul champ Item.url décidé par le type.
 * Source unique de l'ordre d'affichage entre sortes (ITEM_CONTENT_KINDS) et du plafond par élément — API et web.
 * position = ordre à l'intérieur d'une même sorte ; l'ordre entre sortes est fixe et ne se règle pas.
 * xml (schéma draw.io) n'est renvoyé que par le détail d'un élément, jamais par la liste (poids).
 * previewUrl / excerpt : aperçu d'un fichier (page 1, début du texte), calculé par l'API à l'envoi (2026-11-11). */

export type ItemContentKind = 'IMAGE' | 'FILE' | 'LINK' | 'DIAGRAM';

/** Ordre fixe d'affichage des sortes : Images, Fichiers, Liens, Schémas */
export const ITEM_CONTENT_KINDS: readonly ItemContentKind[] = ['IMAGE', 'FILE', 'LINK', 'DIAGRAM'];

/** Nombre maximal de contenus par élément (toutes sortes confondues) */
export const ITEM_CONTENTS_MAX = 30;

export interface ItemContent {
  id: string;
  itemId: string;
  kind: ItemContentKind;
  /** IMAGE/FILE : adresse du fichier (R2 ou externe pour une image) ; LINK : adresse ; DIAGRAM : aperçu facultatif */
  url?: string | null;
  name?: string | null;
  mimeType?: string | null;
  /** Taille en octets (fichiers envoyés) */
  size?: number | null;
  /** DIAGRAM : xml draw.io — absent des listes d'éléments */
  xml?: string | null;
  /** FILE : image de la 1re page (PDF, miniature intégrée d'un fichier Office) — calculée à l'envoi, absente sinon */
  previewUrl?: string | null;
  /** FILE : début du texte (PDF, docx, texte brut) — calculé à l'envoi, absent sinon */
  excerpt?: string | null;
  position: number;
  createdById?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Trie des contenus dans l'ordre d'affichage : sorte (ordre fixe), puis position, puis date d'ajout */
export function sortItemContents<T extends Pick<ItemContent, 'kind' | 'position' | 'createdAt'>>(contents: T[]): T[] {
  const rank = (k: ItemContentKind) => ITEM_CONTENT_KINDS.indexOf(k);
  return [...contents].sort((a, b) =>
    rank(a.kind) - rank(b.kind) || a.position - b.position || String(a.createdAt).localeCompare(String(b.createdAt)));
}

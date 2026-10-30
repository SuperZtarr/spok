/*
 * Mise en page « flux de blocs » d'un article (spec Article 2026-10-23) — fonctions pures, testées.
 * blockClasses : largeur full (100 %) / wide (85 %) / medium (60 %), centrée ; align left/right seulement pour
 * IMAGE et DIAGRAM : flottant (45 % max) que le texte suivant habille. Sous 640 px (sm) : toujours pleine largeur,
 * sans flottant (lecture mobile). Le conteneur de l'article doit fermer les flottants (classe flow-root).
 * moveBlock : nouvel ordre des blocs après glisser-déposer (mode Composer).
 * groupRows : colonnes — blocs « à côté du précédent » regroupés en rangées de 3 au plus (empilées sous 640 px).
 * depthIndentClasses / depthTitleClasses : hiérarchie parent/enfant des éléments dans l'article (depth fourni par l'API).
 */
import type { ArticleBlockAlign, ArticleBlockWidth, ItemType } from '@spok/shared';

const WIDTH_CLASSES: Record<ArticleBlockWidth, string> = {
  full: '',
  wide: 'sm:w-[85%] sm:mx-auto',
  medium: 'sm:w-[60%] sm:mx-auto',
};

const FLOATABLE: ItemType[] = ['IMAGE', 'DIAGRAM'];

export function blockClasses(block: { width: ArticleBlockWidth; align: ArticleBlockAlign }, type: ItemType): string {
  const floats = FLOATABLE.includes(type) && block.align !== 'center';
  if (floats) {
    return block.align === 'left'
      ? 'w-full sm:w-[45%] sm:float-left sm:mr-5 sm:mb-3'
      : 'w-full sm:w-[45%] sm:float-right sm:ml-5 sm:mb-3';
  }
  return `w-full ${WIDTH_CLASSES[block.width]}`.trim();
}

/** Ordre des blocs après glisser-déposer : déplace l'élément d'indice `from` en `to` ; indices invalides → liste inchangée. */
export function moveBlock(ids: string[], from: number, to: number): string[] {
  if (from < 0 || to < 0 || from >= ids.length || to >= ids.length) return ids;
  const next = [...ids];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

const clampDepth = (depth: number) => Math.max(0, Math.min(3, Math.round(depth || 0)));
const INDENT = ['', 'pl-3 sm:pl-6 border-l border-border', 'pl-5 sm:pl-12 border-l border-border', 'pl-6 sm:pl-16 border-l border-border'];
const TITLE = ['text-xl', 'text-lg', 'text-base', 'text-sm'];

/** Décalage d'un bloc selon son niveau dans la hiérarchie de l'article (depth 0-3, réduit sous 640 px, filet à gauche). */
export function depthIndentClasses(depth: number): string {
  return INDENT[clampDepth(depth)];
}

/** Taille de l'intertitre d'un bloc selon son niveau : plus le niveau est profond, plus le titre est petit. */
export function depthTitleClasses(depth: number): string {
  return TITLE[clampDepth(depth)];
}

const MAX_COLUMNS = 3;

/** Rangées de l'article : un bloc « beside » rejoint la rangée du précédent (3 colonnes max, sinon nouvelle rangée). */
export function groupRows<T extends { beside: boolean }>(blocks: T[]): T[][] {
  const rows: T[][] = [];
  for (const block of blocks) {
    const last = rows[rows.length - 1];
    if (block.beside && last && last.length < MAX_COLUMNS) last.push(block);
    else rows.push([block]);
  }
  return rows;
}

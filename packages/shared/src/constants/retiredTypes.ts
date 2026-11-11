/*
 * Types d'élément retirés au lot 4 « contenus multiples » (2026-11-11) et leur remplaçant — règle de migration validée
 * par Thomas : Image, Lien, Diagramme, Document, Note → Élément (UNDEFINED), le média devient un contenu ;
 * Configuration → Élément + tag « config » ; Anomalie → Tâche + tag « bug » (la Note est fusionnée dans l'Élément,
 * complément du 2026-11-11 : un Document devient un Élément, qu'il porte un fichier ou non).
 * Utilisé par le script de migration des données (apps/api/scripts/migrate-item-types.ts) et par la création d'une
 * arborescence depuis un modèle enregistré avant le lot (utils/itemTree.ts) : une ancienne valeur ne fait jamais échouer.
 * Ne pas s'en servir pour proposer ces types : ils ne sont plus dans le registre (typeRegistry.ts).
 */
import type { ItemType } from './typeRegistry.js';

export const RETIRED_ITEM_TYPES = ['LINK', 'CONFIG', 'DOCUMENT', 'IMAGE', 'BUG', 'DIAGRAM', 'NOTE'] as const;
export type RetiredItemType = (typeof RETIRED_ITEM_TYPES)[number];

export function isRetiredItemType(value: unknown): value is RetiredItemType {
  return typeof value === 'string' && (RETIRED_ITEM_TYPES as readonly string[]).includes(value);
}

/** Type remplaçant et tag de classement éventuel */
export function replacementForRetiredType(type: RetiredItemType): { type: ItemType; tag?: 'bug' | 'config' } {
  switch (type) {
    case 'BUG': return { type: 'TASK', tag: 'bug' };
    case 'CONFIG': return { type: 'UNDEFINED', tag: 'config' };
    default: return { type: 'UNDEFINED' };
  }
}

/* Constantes partagées : types d'espaces, types de relations, alias.
   Types d'élément : ITEM_TYPES et tout le reste viennent du registre typeRegistry.ts (source unique, 2026-11-08).
   Statuts : référentiels (defaultReferentiels.ts) ; leur sens par catégorie (statusCategory.ts) — plus de liste de statuts ici. */
export { ITEM_TYPES } from './typeRegistry.js';

export const SPACE_TYPES = ['PERSONAL', 'GROUP'] as const;

export const ROLES = ['OWNER', 'MEMBER'] as const;

export const GLOBAL_ROLES = ['USER', 'ADMIN'] as const;

// La hiérarchie passe par Item.parentId — pas de type de relation « parent » (retiré le 2026-10-16).
export const RELATION_TYPES = ['blocks', 'relates', 'implements', 'drives'] as const;

export const PRIORITY_LEVELS = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  URGENT: 4,
} as const;

export const DEFAULT_PAGE_SIZE = 20;

export const MAX_PAGE_SIZE = 100;

export * from './defaultReferentiels.js';
export * from './statusCategory.js';
export * from './spaceTemplates.js';
export * from './retiredTypes.js';
export * from './viewRegistry.js';
export {
  ITEM_TYPE_REGISTRY, DEFAULT_ITEM_TYPE, getItemTypeDef, isItemType, itemTypesWhere, isComposedType,
} from './typeRegistry.js';
export type { ItemTypeDefinition, TypeHue } from './typeRegistry.js';
export * from './menuDefaults.js';
export type { MenuOverride } from '../types/menuItem.js';

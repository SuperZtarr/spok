export const ITEM_TYPES = [
  'NOTE',
  'PROJECT',
  'TASK',
  'MEETING',
  'PERIOD',
  'LINK',
  'CONFIG',
  'DOCUMENT',
  'IMAGE',
  'BUG',
  'DIAGRAM',
] as const;

export const SPACE_TYPES = ['PERSONAL', 'GROUP'] as const;

export const ROLES = ['OWNER', 'MEMBER'] as const;

export const GLOBAL_ROLES = ['USER', 'ADMIN'] as const;

export const RELATION_TYPES = ['blocks', 'relates', 'depends', 'parent', 'implements'] as const;

export const TASK_STATUSES = ['todo', 'in_progress', 'done', 'cancelled'] as const;

// Alias pour tous les types d'éléments (pas seulement les tâches)
export const ITEM_STATUSES = TASK_STATUSES;

export const PRIORITY_LEVELS = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  URGENT: 4,
} as const;

export const DEFAULT_PAGE_SIZE = 20;

export const MAX_PAGE_SIZE = 100;

export * from './defaultReferentiels.js';
export * from './spaceTemplates.js';
export * from './viewRegistry.js';
export * from './viewDefaults.js';
export * from './menuDefaults.js';
export type { MenuOverride } from '../types/menuItem.js';

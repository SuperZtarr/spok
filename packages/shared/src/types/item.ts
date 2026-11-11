/* Types item : Item, ItemType, relations, inputs de création/déplacement, accusé de lecture à l'assignation,
 * champs de copie de séance live (lockedAt/sourceItemId/sourceSpaceId).
 * QUESTION (2026-11-08) : options, issue et votes dans types/question.ts.
 * contents (2026-11-08, contenus multiples) : contenus de l'élément, triés ; xml absent dans les listes (types/itemContent.ts).
 * Plus de champ url (lot 4, 2026-11-11) : images, fichiers, liens et schémas sont TOUS des contenus. La colonne
 * items.url reste en base, inutilisée (sauvegarde), jusqu'à son retrait.
 * ItemType : tiré du registre des types (constants/typeRegistry.ts), jamais réécrit ici. */
import type { ContributionWithAuthor } from './contribution.js';
import type { ItemType } from '../constants/typeRegistry.js';
import type { ReactionSummary } from './reaction.js';
import type { HorizonBucket } from '../utils/horizon.js';
import type { ItemContent } from './itemContent.js';

export type { ItemType };

export interface Item {
  id: string;
  type: ItemType;
  title: string;
  description?: string | null;
  content?: Record<string, unknown> | null;
  /** Contenus de l'élément (images, fichiers, liens, schémas), dans l'ordre d'affichage */
  contents?: ItemContent[];
  status?: string | null;
  priority?: number | null;
  position: number;
  dueDate?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  manualHorizon?: HorizonBucket | null;
  horizonSetAt?: string | null;
  createdAt: string;
  updatedAt: string;
  spaceId: string;
  createdById: string;
  assignedToId?: string | null;
  /** Assigné en saisie libre, sans compte SPOK — exclusif avec assignedToId, sans droit ni notification */
  assignedToName?: string | null;
  /** Date / auteur de l'assignation courante (null = non assigné ou assignation antérieure au 2026-09-29) */
  assignedAt?: string | null;
  assignedById?: string | null;
  /** Accusé de lecture calculé par l'API : null = pas d'indicateur ; seenAt null = pas encore vu */
  assignmentReceipt?: AssignmentReceipt;
  parentId?: string | null;
  tags?: Tag[];
  viewedAt?: string | null;
  /** Copie de séance verrouillée (contenu non modifiable) — cf. apps/api/src/utils/itemLock.ts */
  lockedAt?: string | null;
  sourceItemId?: string | null;
  sourceSpaceId?: string | null;
}

/** Accusé de lecture à l'assignation (cf. apps/api/src/utils/assignment.ts). */
export type AssignmentReceipt = { seenAt: string | null } | null;

export interface MoveItemInput {
  parentId?: string | null;
  position: number;
}

export interface ItemWithRelations extends Item {
  children?: Item[];
  parent?: Item | null;
  tags?: Tag[];
  relationsFrom?: ItemRelation[];
  relationsTo?: ItemRelation[];
  contributions?: ContributionWithAuthor[];
  // Personnes : id et nom seulement, jamais l'e-mail (règle members-email-scope)
  createdBy?: {
    id: string;
    name: string;
  };
  assignedTo?: {
    id: string;
    name: string;
  } | null;
  reactionSummary?: ReactionSummary[];
  _count?: {
    contributions?: number;
  };
}

export interface CreateItemInput {
  type: ItemType;
  title: string;
  description?: string;
  content?: Record<string, unknown>;
  status?: string;
  priority?: number;
  dueDate?: string;
  startDate?: string;
  endDate?: string;
  parentId?: string;
  assignedToId?: string | null;
  assignedToName?: string | null;
  tagIds?: string[];
}

export interface UpdateItemInput {
  type?: ItemType;
  title?: string;
  description?: string | null;
  content?: Record<string, unknown>;
  status?: string | null;
  priority?: number;
  dueDate?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  manualHorizon?: HorizonBucket | null;
  parentId?: string | null;
  assignedToId?: string | null;
  assignedToName?: string | null;
  tagIds?: string[];
  updatedAt?: string;
  propagateToChildren?: boolean;
}

export interface ItemRelation {
  id: string;
  fromItemId: string;
  toItemId: string;
  type: string;
  label?: string | null;
}

export interface CreateRelationInput {
  toItemId: string;
  type: string;
  label?: string;
}

export interface Tag {
  id: string;
  name: string;
  color?: string | null;
  spaceId: string;
}

export interface CreateTagInput {
  name: string;
  color?: string;
}

export interface UpdateTagInput {
  name?: string;
  color?: string;
}

import type { ContributionWithAuthor } from './contribution.js';

export type ItemType = 'NOTE' | 'PROJECT' | 'TASK' | 'MEETING' | 'PERIOD' | 'LINK' | 'CONFIG' | 'DOCUMENT' | 'IMAGE' | 'BUG';

export interface Item {
  id: string;
  type: ItemType;
  title: string;
  description?: string | null;
  content?: Record<string, unknown> | null;
  url?: string | null;
  status?: string | null;
  priority?: number | null;
  position: number;
  dueDate?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  createdAt: string;
  updatedAt: string;
  spaceId: string;
  createdById: string;
  parentId?: string | null;
}

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
  createdBy?: {
    id: string;
    name: string;
    email: string;
  };
  _count?: {
    contributions?: number;
  };
}

export interface CreateItemInput {
  type: ItemType;
  title: string;
  description?: string;
  content?: Record<string, unknown>;
  url?: string;
  status?: string;
  priority?: number;
  dueDate?: string;
  startDate?: string;
  endDate?: string;
  parentId?: string;
  tagIds?: string[];
}

export interface UpdateItemInput {
  type?: ItemType;
  title?: string;
  description?: string | null;
  content?: Record<string, unknown>;
  url?: string | null;
  status?: string;
  priority?: number;
  dueDate?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  parentId?: string | null;
  tagIds?: string[];
  updatedAt?: string;
}

export interface ItemRelation {
  id: string;
  fromItemId: string;
  toItemId: string;
  type: string;
}

export interface CreateRelationInput {
  toItemId: string;
  type: string;
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

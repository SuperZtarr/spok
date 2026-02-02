export type ItemType = 'NOTE' | 'PROJECT' | 'TASK' | 'APPOINTMENT' | 'LINK' | 'CONFIG' | 'DOCUMENT' | 'IMAGE';

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
  parentId?: string | null;
  tagIds?: string[];
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

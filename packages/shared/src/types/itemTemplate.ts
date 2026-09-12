/* Types du modèle ItemTemplate : structure récursive titre+type capturée depuis un item existant. */
import type { ItemType } from './item.js';

export interface ItemTemplateNode {
  title: string;
  type: ItemType;
  children: ItemTemplateNode[];
}

export interface ItemTemplate {
  id: string;
  name: string;
  description: string | null;
  structure: ItemTemplateNode;
  createdById: string;
  createdByName: string;
  createdAt: string;
}

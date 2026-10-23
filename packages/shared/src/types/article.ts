/*
 * Types d'un article (type d'item ARTICLE, 2026-10-23) : blocs = références vers des éléments existants, résolues
 * par l'API (GET /spaces/:id/items/:id/article). Le lecteur reçoit le contenu d'un bloc sans accès à l'élément source :
 * item.spaceId n'est renseigné que si canOpen ; available=false → item null (rien du contenu n'est envoyé).
 */
import type { ItemType } from './item.js';

export type ArticleBlockWidth = 'full' | 'wide' | 'medium';
export type ArticleBlockAlign = 'center' | 'left' | 'right';

export type ArticleBlockView = {
  id: string;
  position: number;
  width: ArticleBlockWidth;
  align: ArticleBlockAlign;
  available: boolean;
  item: null | {
    id: string;
    type: ItemType;
    title: string;
    description: string | null;
    url: string | null;
    canOpen: boolean;
    canEdit: boolean;
    spaceId: string | null;
  };
};

export type ArticleView = {
  articleId: string;
  blocks: ArticleBlockView[];
  canEditArticle: boolean;
};

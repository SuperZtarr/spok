/*
 * Types d'un article (type d'item ARTICLE, 2026-10-23) : blocs = références vers des éléments existants, résolues
 * par l'API (GET /spaces/:id/items/:id/article). Le lecteur reçoit le contenu d'un bloc sans accès à l'élément source :
 * item.spaceId n'est renseigné que si canOpen ; available=false → item null (rien du contenu n'est envoyé).
 * Statut, priorité et dates servent la ligne d'infos des blocs (rendu par type, 2026-10-24) : statusLabel est résolu
 * par l'API dans les référentiels de l'espace d'origine (le lecteur peut ne pas y avoir accès) ; dates en ISO.
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
    status: string | null;
    statusLabel: string | null;
    priority: number | null;
    startDate: string | null;
    endDate: string | null;
    dueDate: string | null;
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

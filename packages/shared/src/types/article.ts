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

/** Élément proposé par le sélecteur « Ajouter un élément » (GET …/article/candidates) ; snippet = extrait du texte
 *  visible autour du terme, seulement quand la correspondance n'est pas dans le titre. */
export type ArticleCandidate = {
  id: string;
  type: ItemType;
  title: string;
  spaceId: string;
  spaceName: string;
  communityName: string | null;
  snippet: string | null;
};

/** Ajout groupé (POST …/article/batch[/preview]) : une grappe (élément + enfants et/ou chaîne de relations sortantes
 *  blocks / implements / drives) ou le processus d'un espace (entier ou un couloir). Photo au moment de l'ajout. */
export type ArticleBatchSource =
  | { kind: 'cluster'; itemId: string; children: boolean; chain: boolean }
  | { kind: 'process'; spaceId: string; laneId?: string };

export type ArticleBatchPreview = {
  count: number;
  skipped: { present: number; unreadable: number; articles: number };
  tooMany: boolean;
  lessVisible: boolean;
};

/** Processus proposable (GET …/article/processes) : espace lisible ayant au moins un élément placé. */
export type ArticleProcessSummary = {
  spaceId: string;
  spaceName: string;
  communityName: string | null;
  nodeCount: number;
  lanes: { id: string; title: string }[];
};

export type ArticleView = {
  articleId: string;
  blocks: ArticleBlockView[];
  canEditArticle: boolean;
};

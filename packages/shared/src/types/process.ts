/*
 * Types du canevas d'un élément Process (type d'item PROCESS, 2026-11-21) : places et couloirs d'éléments de tous
 * espaces, résolus par l'API (GET /spaces/:spaceId/items/:id/process, routes/item-process.ts).
 * Règles de lecture (comme un bloc d'Article) : un élément n'est montré que si la personne qui l'a posé (addedById) peut
 * encore le lire ; sinon available=false et item=null (rien du contenu n'est envoyé, seul itemId sert de clé).
 * Le lecteur voit le contenu sans accès à l'élément source : spaceId seulement si canOpen.
 * Question posée sur le canevas : question.options (réponses possibles) — refItemId seulement si l'élément visé est
 * lui-même montré sur le canevas (branche dessinée du losange vers lui), chosenOptionId = réponse retenue.
 */
import type { ItemType } from './item.js';

export type ProcessQuestionOption = { id: string; label: string; refItemId: string | null };

export type ProcessQuestionView = {
  options: ProcessQuestionOption[];
  /** Réponse retenue (question tranchée), sinon null */
  chosenOptionId: string | null;
  decided: boolean;
};

export type ProcessItemView = {
  id: string;
  type: ItemType;
  title: string;
  status: string | null;
  statusLabel: string | null;
  priority: number | null;
  dueDate: string | null;
  /** Parent, s'il est lui aussi montré sur le canevas (sinon null) */
  parentId: string | null;
  canOpen: boolean;
  canEdit: boolean;
  /** Espace de l'élément, seulement si canOpen */
  spaceId: string | null;
  question: ProcessQuestionView | null;
};

export type ProcessNodeView = {
  itemId: string;
  x: number;
  y: number;
  laneId: string | null;
  available: boolean;
  item: ProcessItemView | null;
};

export type ProcessLaneView = {
  id: string;
  itemId: string;
  position: number;
  x: number | null;
  y: number | null;
  available: boolean;
  item: ProcessItemView | null;
};

/** Relation entre deux éléments montrés sur le canevas (places ou couloirs) */
export type ProcessRelationView = {
  id: string;
  fromItemId: string;
  toItemId: string;
  type: string;
  label: string | null;
};

export type ProcessCanvasView = {
  processId: string;
  spaceId: string;
  canEditProcess: boolean;
  nodes: ProcessNodeView[];
  lanes: ProcessLaneView[];
  relations: ProcessRelationView[];
};

/* Document de l'export brut réimportable (registre : constants/rawExport.ts) et compte rendu de son import.
   Identifiants : ceux de la base d'origine, servant seulement de références INTERNES au fichier (parentId, tagIds,
   relations…) — l'import recrée tout avec de nouveaux identifiants. Dates en ISO 8601, null = absent.
   Personnes (users) : rapprochées à l'import par leur e-mail ; email n'est écrit que si l'auteur de l'export voit les
   e-mails des membres (propriétaire de l'espace ou de la communauté, mode admin — règle members-email-scope).
   Compte rendu : clés de created / dropped = celles des libellés du registre (RAW_IMPORT_*_LABELS). */
import type { RAW_IMPORT_CREATED_LABELS, RAW_IMPORT_DROPPED_LABELS } from '../constants/rawExport.js';

export interface RawExportSpace {
  id: string;
  /** null = espace racine de l'export */
  parentId: string | null;
  name: string;
  description: string | null;
  visibility: string | null;
  defaultView: string | null;
  position: number;
}

export interface RawExportUser {
  id: string;
  name: string;
  email: string | null;
}

export interface RawExportTag {
  id: string;
  name: string;
  color: string | null;
}

export interface RawExportContent {
  kind: string;
  url: string | null;
  name: string | null;
  mimeType: string | null;
  size: number | null;
  xml: string | null;
  previewUrl: string | null;
  excerpt: string | null;
  value: string | null;
  position: number;
}

export interface RawExportQuestion {
  multiple: boolean;
  chosenOptionId: string | null;
  answerText: string | null;
  note: string | null;
  decidedById: string | null;
  decidedAt: string | null;
  options: { id: string; label: string; position: number; refItemId: string | null }[];
}

export interface RawExportItem {
  id: string;
  spaceId: string;
  parentId: string | null;
  type: string;
  title: string;
  description: string | null;
  legacyContent: unknown;
  url: string | null;
  status: string | null;
  priority: number | null;
  position: number;
  dueDate: string | null;
  startDate: string | null;
  endDate: string | null;
  manualHorizon: string | null;
  horizonSetAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdById: string;
  assignedToId: string | null;
  assignedToName: string | null;
  tagIds: string[];
  externalRefs: string[];
  contents: RawExportContent[];
  question: RawExportQuestion | null;
  article: { blocks: { itemId: string; position: number; width: string; align: string; beside: boolean }[] } | null;
  process: {
    lanes: { id: string; itemId: string; position: number; x: number | null; y: number | null }[];
    nodes: { itemId: string; x: number; y: number; laneId: string | null }[];
  } | null;
}

export interface RawExportRelation {
  fromItemId: string;
  toItemId: string;
  type: string;
  label: string | null;
}

export interface RawExportContribution {
  id: string;
  itemId: string;
  parentId: string | null;
  authorId: string;
  content: string;
  reactionType: string | null;
  createdAt: string;
}

export interface RawExportDocument {
  format: string;
  version: number;
  exportedAt: string;
  source: { spaceId: string; spaceName: string };
  spaces: RawExportSpace[];
  users: RawExportUser[];
  tags: RawExportTag[];
  items: RawExportItem[];
  relations: RawExportRelation[];
  contributions: RawExportContribution[];
}

/** Destination d'un import : à la racine d'une communauté, ou sous un espace existant */
export interface RawImportTarget {
  communityId?: string;
  parentSpaceId?: string;
}

/** Compte rendu d'un import (aperçu : dryRun = true, rien n'est écrit) */
export interface RawImportReport {
  dryRun: boolean;
  /** Espace racine créé (absent en aperçu) */
  rootSpaceId: string | null;
  rootSpaceName: string;
  exportedAt: string;
  created: Record<keyof typeof RAW_IMPORT_CREATED_LABELS, number>;
  /** Références vers des éléments absents du fichier, abandonnées */
  dropped: Record<keyof typeof RAW_IMPORT_DROPPED_LABELS, number>;
  /** Personnes du fichier sans compte correspondant (e-mail inconnu ou absent) : remplacées par l'auteur de l'import */
  unmatchedUsers: string[];
  /** Fichiers recopiés dans le stockage */
  copiedFiles: number;
}

/* Registre des champs exportables (export de données CSV, Excel, PDF « données ») — SOURCE UNIQUE (règle spok-dev § 1 bis,
   élément SPOK cmwlt95x0000hgxbeapfmpoxq, 2026-11-18).
   Une entrée par champ : `id` (stocké dans les préférences d'espace, préférence `export.fields`) et `label` (en-tête de colonne).
   L'ordre du tableau = ordre par défaut des colonnes ; tous les champs sont cochés par défaut.
   Dérivés : `ExportFieldId`, `EXPORT_FIELD_IDS` (zod de l'API space-preferences), table des valeurs du web
   (apps/web/src/lib/exportUtils.ts, Record<ExportFieldId, …> strict), fenêtre ExportFieldsModal.
   Ne jamais recopier la liste ailleurs : ajouter un champ = une entrée ici + sa valeur dans exportUtils.
   Couverture du modèle (bug cmwt3o7tn01ly7icc055vvaiw, 2026-11-25) : `sources` = champs du modèle Prisma `Item` lus par
   l'entrée ; tout autre champ du modèle figure dans EXPORT_EXCLUDED_ITEM_FIELDS avec sa raison. Le test API
   export-fields-coverage.test.ts lit schema.prisma et échoue dès qu'un champ n'est ni exporté ni exclu volontairement. */

export const EXPORT_FIELD_REGISTRY = [
  { id: 'title', label: 'Titre', sources: ['title'] },
  { id: 'type', label: 'Type', sources: ['type'] },
  { id: 'status', label: 'Statut', sources: ['status'] },
  { id: 'priority', label: 'Priorité', sources: ['priority'] },
  { id: 'parent', label: 'Parent', sources: ['parentId', 'parent'] },
  { id: 'assignee', label: 'Assigné à', sources: ['assignedToId', 'assignedTo', 'assignedToName'] },
  { id: 'tags', label: 'Tags', sources: ['tags'] },
  { id: 'externalRefs', label: 'Références externes', sources: ['externalRefs'] },
  { id: 'dueDate', label: 'Date échéance', sources: ['dueDate'] },
  { id: 'startDate', label: 'Date début', sources: ['startDate'] },
  { id: 'endDate', label: 'Date fin', sources: ['endDate'] },
  { id: 'createdBy', label: 'Créé par', sources: ['createdById', 'createdBy'] },
  { id: 'createdAt', label: 'Créé le', sources: ['createdAt'] },
  { id: 'updatedAt', label: 'Modifié le', sources: ['updatedAt'] },
  { id: 'description', label: 'Description', sources: ['description'] },
  { id: 'contents', label: 'Contenus', sources: ['contents'] },
  { id: 'id', label: 'Identifiant', sources: ['id'] },
] as const satisfies readonly { id: string; label: string; sources: readonly string[] }[];

/** Champs du modèle `Item` volontairement absents de l'export, avec leur raison (test export-fields-coverage). */
export const EXPORT_EXCLUDED_ITEM_FIELDS: Readonly<Record<string, string>> = {
  secrets: 'Données sécurisées : jamais exportées (lues seulement par routes/item-secrets.ts)',
  content: 'Ancien contenu JSON, remplacé par les contenus (contents)',
  url: 'Ancienne adresse de l\'élément, remplacée par les contenus Lien',
  position: 'Ordre technique d\'affichage',
  manualHorizon: 'Réglage d\'affichage de la vue Horizon',
  horizonSetAt: 'Réglage d\'affichage de la vue Horizon',
  spaceId: 'Espace exporté = nom du fichier',
  space: 'Espace exporté = nom du fichier',
  updatedById: 'Auteur de la dernière modification : historique, pas une donnée de l\'élément',
  updatedBy: 'Auteur de la dernière modification : historique, pas une donnée de l\'élément',
  assignedAt: 'Accusé de lecture de l\'assignation (technique)',
  assignedById: 'Accusé de lecture de l\'assignation (technique)',
  lockedAt: 'Verrou des copies de séance (technique)',
  sourceItemId: 'Trace d\'origine d\'une copie de séance (technique)',
  sourceSpaceId: 'Trace d\'origine d\'une copie de séance (technique)',
  children: 'Déduits de la colonne Parent',
  relationsFrom: 'Exportées à part (feuille / page Relations)',
  relationsTo: 'Exportées à part (feuille / page Relations)',
  contributions: 'Fil de discussion : export JSON seulement',
  reactions: 'Réactions personnelles',
  bookmarkedBy: 'Favoris personnels',
  views: 'Lectures personnelles',
  dayPlanEntries: 'Planning du jour personnel',
  liveSessionEntries: 'Déroulé des séances (propre aux séances)',
  liveSessionReport: 'Compte rendu de séance (propre aux séances)',
  processNodes: 'Mise en forme des processus',
  processLanes: 'Mise en forme des processus',
  processPlacements: 'Mise en forme des processus',
  processLaneOf: 'Mise en forme des processus',
  articleBlocks: 'Mise en page des articles',
  referencedIn: 'Mise en page des articles',
  question: 'Options et votes des questions (propres aux questions)',
  questionOptions: 'Options et votes des questions (propres aux questions)',
  questionOptionRefs: 'Options et votes des questions (propres aux questions)',
};

export type ExportFieldId = (typeof EXPORT_FIELD_REGISTRY)[number]['id'];

export const EXPORT_FIELD_IDS = EXPORT_FIELD_REGISTRY.map(f => f.id) as unknown as readonly [ExportFieldId, ...ExportFieldId[]];

/** Libellé de colonne d'un champ. */
export function getExportFieldLabel(id: ExportFieldId): string {
  return EXPORT_FIELD_REGISTRY.find(f => f.id === id)?.label ?? id;
}

/**
 * Remet une sélection mémorisée en état : retire les identifiants inconnus (champ retiré du registre) et les doublons ;
 * sélection vide ou absente → tous les champs dans l'ordre du registre.
 */
export function normalizeExportFields(saved: readonly string[] | null | undefined): ExportFieldId[] {
  const known = new Set<string>(EXPORT_FIELD_IDS);
  const out: ExportFieldId[] = [];
  for (const id of saved ?? []) {
    if (known.has(id) && !out.includes(id as ExportFieldId)) out.push(id as ExportFieldId);
  }
  return out.length ? out : [...EXPORT_FIELD_IDS];
}

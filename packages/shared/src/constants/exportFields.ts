/* Registre des champs exportables (export de données CSV, Excel, PDF « données ») — SOURCE UNIQUE (règle spok-dev § 1 bis,
   élément SPOK cmwlt95x0000hgxbeapfmpoxq, 2026-11-18).
   Une entrée par champ : `id` (stocké dans les préférences d'espace, préférence `export.fields`) et `label` (en-tête de colonne).
   L'ordre du tableau = ordre par défaut des colonnes ; tous les champs sont cochés par défaut.
   Dérivés : `ExportFieldId`, `EXPORT_FIELD_IDS` (zod de l'API space-preferences), table des valeurs du web
   (apps/web/src/lib/exportUtils.ts, Record<ExportFieldId, …> strict), fenêtre ExportFieldsModal.
   Ne jamais recopier la liste ailleurs : ajouter un champ = une entrée ici + sa valeur dans exportUtils. */

export const EXPORT_FIELD_REGISTRY = [
  { id: 'title', label: 'Titre' },
  { id: 'type', label: 'Type' },
  { id: 'status', label: 'Statut' },
  { id: 'priority', label: 'Priorité' },
  { id: 'parent', label: 'Parent' },
  { id: 'assignee', label: 'Assigné à' },
  { id: 'tags', label: 'Tags' },
  { id: 'dueDate', label: 'Date échéance' },
  { id: 'startDate', label: 'Date début' },
  { id: 'endDate', label: 'Date fin' },
  { id: 'createdAt', label: 'Créé le' },
  { id: 'updatedAt', label: 'Modifié le' },
  { id: 'description', label: 'Description' },
] as const satisfies readonly { id: string; label: string }[];

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

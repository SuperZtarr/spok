/*
 * Hook : champs choisis pour l'export de données (CSV, Excel, PDF données) dans l'espace courant, par utilisateur.
 * Lus et écrits dans les préférences d'espace (`export.fields`, via useSpacePreferences → /spaces/:id/preferences),
 * remis en état par normalizeExportFields (registre shared EXPORT_FIELD_REGISTRY : ids inconnus retirés, vide → tous).
 * Non-membre ou visiteur : l'API refuse, le choix par défaut (tous les champs) s'applique, sans message d'erreur.
 * Usage : uniquement par ExportFieldsModal (useExportFieldsDialog) — ne pas lire la préférence ailleurs.
 */
import { useCallback } from 'react';
import { normalizeExportFields, type ExportFieldId } from '@spok/shared';
import { useSpacePreferences } from './useSpacePreferences';

export function useExportFields(spaceId: string | undefined) {
  const { preferences, savePreferences } = useSpacePreferences(spaceId);
  const fields = normalizeExportFields(preferences.export?.fields);
  const saveFields = useCallback((next: ExportFieldId[]) => {
    savePreferences({ export: { fields: next } });
  }, [savePreferences]);
  return { fields, saveFields };
}

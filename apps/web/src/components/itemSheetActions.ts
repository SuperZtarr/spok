/*
 * Groupes du menu « Actions » du pied de la fiche d'un élément (ItemEditModal, lot « pied » de la réorganisation,
 * décision Thomas 2026-11-13) : les 13 icônes du pied deviennent des entrées libellées, rangées par intention, avec
 * leur rappel fonctionnel (hint, texte de la fiche d'aide item-modal). Rendu par ItemActionMenu (pas de menu fait main).
 * Mêmes conditions d'affichage qu'avant : partage pour tous, épingle si connecté, réorganisation seulement si canEdit,
 * Absorber / Éclater / Fusionner / Convertir seulement si la vue fournit l'action et qu'elle a un sens (enfants, titres),
 * Supprimer seulement si canEdit et onDelete, seule dans son groupe, en rouge.
 * Copier l'identifiant (2026-11-13, lot 3) : gardé ici ; depuis le 2026-11-18 l'identifiant est aussi affiché dans le pied,
 * avec « Copier le lien » (ItemEditModal, règle item-share-link).
 * Fonction pure : l'appelant fournit les droits, les gestionnaires et les textes ; un gestionnaire absent retire l'entrée.
 * Libellés et icônes : registre constants/itemActions.ts, le même que le menu contextuel (vocabulaire unique, 2026-11-26).
 * « Marquer comme non lu » : pour tout utilisateur connecté (marque personnelle), comme dans le menu contextuel.
 */
import { itemAction, type ItemActionId } from '../constants/itemActions';
import type { ItemAction, ItemActionGroup } from './ui/ItemActionMenu';

export interface SheetActionHandlers {
  print: () => void;
  exportPdf: () => void;
  copySheet: () => void;
  copyThumbnail: () => void;
  /** Copier l'identifiant technique (aussi affiché dans le pied de la fiche, à côté de « Copier le lien ») */
  copyId?: () => void;
  toggleBookmark?: () => void;
  markUnread?: () => void;
  duplicate?: () => void;
  move?: () => void;
  convertToSpace?: () => void;
  absorbChildren?: () => void;
  splitDescription?: () => void;
  merge?: () => void;
  saveAsTemplate?: () => void;
  insertTemplate?: () => void;
  delete?: () => void;
}

export interface SheetActionOptions {
  /** Peut modifier l'élément : réorganisation, structure, suppression */
  canEdit: boolean;
  isBookmarked: boolean;
  /** Vignette en cours de calcul : entrée désactivée */
  thumbnailBusy?: boolean;
  /** Textes des rappels, par id d'action (fiche d'aide item-modal, hints.action*) */
  hints?: Record<string, string | undefined>;
}

export function buildSheetActionGroups(h: SheetActionHandlers, o: SheetActionOptions): ItemActionGroup[] {
  const hint = (id: string) => o.hints?.[id];
  // Libellé et icône : registre ITEM_ACTIONS (id du registre = id de l'entrée, sauf épingle / désépingle)
  const entry = (id: ItemActionId, onClick: (() => void) | undefined, extra: Partial<ItemAction> = {}, registryId: ItemActionId = id): ItemAction[] =>
    onClick ? [itemAction(registryId, onClick, { id, hint: hint(id), ...extra })] : [];

  const share: ItemAction[] = [
    ...entry('print', h.print),
    ...entry('exportPdf', h.exportPdf),
    ...entry('copySheet', h.copySheet),
    ...entry('copyThumbnail', h.copyThumbnail, { disabled: o.thumbnailBusy }),
    ...entry('copyId', h.copyId),
  ];
  const organise: ItemAction[] = [
    ...entry('bookmark', h.toggleBookmark, {}, o.isBookmarked ? 'unbookmark' : 'bookmark'),
    ...entry('markUnread', h.markUnread),
    ...(o.canEdit ? [
      ...entry('duplicate', h.duplicate),
      ...entry('move', h.move),
      ...entry('convertToSpace', h.convertToSpace),
    ] : []),
  ];
  const structure: ItemAction[] = o.canEdit ? [
    ...entry('absorbChildren', h.absorbChildren),
    ...entry('splitDescription', h.splitDescription),
    ...entry('merge', h.merge),
    ...entry('saveAsTemplate', h.saveAsTemplate),
    ...entry('insertTemplate', h.insertTemplate),
  ] : [];
  const danger: ItemAction[] = o.canEdit ? entry('delete', h.delete, { variant: 'danger' }) : [];

  return [
    { label: 'Partager', actions: share },
    { label: 'Organiser', actions: organise },
    { label: 'Structure', actions: structure },
    { actions: danger },
  ].filter((g) => g.actions.length > 0);
}

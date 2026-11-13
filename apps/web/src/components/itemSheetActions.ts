/*
 * Groupes du menu « Actions » du pied de la fiche d'un élément (ItemEditModal, lot « pied » de la réorganisation,
 * décision Thomas 2026-11-13) : les 13 icônes du pied deviennent des entrées libellées, rangées par intention, avec
 * leur rappel fonctionnel (hint, texte de la fiche d'aide item-modal). Rendu par ItemActionMenu (pas de menu fait main).
 * Mêmes conditions d'affichage qu'avant : partage pour tous, épingle si connecté, réorganisation seulement si canEdit,
 * Absorber / Éclater / Fusionner / Convertir seulement si la vue fournit l'action et qu'elle a un sens (enfants, titres),
 * Supprimer seulement si canEdit et onDelete, seule dans son groupe, en rouge.
 * Copier l'identifiant (2026-11-13, lot 3) : l'identifiant technique n'est plus affiché dans la fiche.
 * Fonction pure : l'appelant fournit les droits, les gestionnaires et les textes ; un gestionnaire absent retire l'entrée.
 */
import {
  Printer, FileDown, ClipboardCopy, Image as ImageIcon, Hash, Bookmark, EyeOff, Copy, FolderInput, FolderPlus,
  ArrowDownToLine, Scissors, Merge, LayoutTemplate, ListTree, Trash2,
} from 'lucide-react';
import type { ItemAction, ItemActionGroup } from './ui/ItemActionMenu';

export interface SheetActionHandlers {
  print: () => void;
  exportPdf: () => void;
  copySheet: () => void;
  copyThumbnail: () => void;
  /** Copier l'identifiant technique (plus affiché dans la fiche depuis le lot 3 de la réorganisation) */
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
  const entry = (id: string, label: string, icon: ItemAction['icon'], onClick: (() => void) | undefined, extra: Partial<ItemAction> = {}): ItemAction[] =>
    onClick ? [{ id, label, icon, onClick, hint: hint(id), ...extra }] : [];

  const share: ItemAction[] = [
    ...entry('print', 'Imprimer', Printer, h.print),
    ...entry('exportPdf', 'Exporter en PDF', FileDown, h.exportPdf),
    ...entry('copySheet', 'Copier la fiche', ClipboardCopy, h.copySheet),
    ...entry('copyThumbnail', 'Copier la vignette', ImageIcon, h.copyThumbnail, { disabled: o.thumbnailBusy }),
    ...entry('copyId', 'Copier l\'identifiant', Hash, h.copyId),
  ];
  const organise: ItemAction[] = [
    ...entry('bookmark', o.isBookmarked ? 'Retirer des épingles' : 'Épingler', Bookmark, h.toggleBookmark),
    ...(o.canEdit ? [
      ...entry('markUnread', 'Marquer comme non lu', EyeOff, h.markUnread),
      ...entry('duplicate', 'Dupliquer vers un espace', Copy, h.duplicate),
      ...entry('move', 'Déplacer vers un espace', FolderInput, h.move),
      ...entry('convertToSpace', 'Convertir en espace', FolderPlus, h.convertToSpace),
    ] : []),
  ];
  const structure: ItemAction[] = o.canEdit ? [
    ...entry('absorbChildren', 'Absorber les enfants', ArrowDownToLine, h.absorbChildren),
    ...entry('splitDescription', 'Éclater en sous-éléments', Scissors, h.splitDescription),
    ...entry('merge', 'Fusionner avec…', Merge, h.merge),
    ...entry('saveAsTemplate', 'Enregistrer comme modèle', LayoutTemplate, h.saveAsTemplate),
    ...entry('insertTemplate', 'Ajouter une structure', ListTree, h.insertTemplate),
  ] : [];
  const danger: ItemAction[] = o.canEdit ? entry('delete', 'Supprimer', Trash2, h.delete, { variant: 'danger' }) : [];

  return [
    { label: 'Partager', actions: share },
    { label: 'Organiser', actions: organise },
    { label: 'Structure', actions: structure },
    { actions: danger },
  ].filter((g) => g.actions.length > 0);
}

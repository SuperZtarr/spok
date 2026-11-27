/*
 * Registre unique des actions sur un élément (décision Thomas 2026-11-26 : un seul vocabulaire partout) — libellé et
 * icône de chaque action, lus par le menu contextuel (lib/itemMenuGroups.ts), le menu « Actions » de la fiche
 * (components/itemSheetActions.ts) et le sélecteur de modes (components/ui/ItemModeSwitch.tsx : fiche, page Article,
 * canevas Process). Constat qui l'a motivé : les deux menus recopiaient leurs libellés et avaient divergé (« sous-items » /
 * « sous-éléments », « Afficher » / « Lire l'article » / « Afficher le process », « Ouvrir » / « Modifier » / « Fiche »).
 * Vocabulaire : Lire (la restitution), Modifier (les champs), Composer (l'atelier d'un Article ou d'un Process) ;
 * « élément », jamais « item ». Ajouter ou renommer une action = ici seulement. Vit côté web : les icônes (lucide) sont
 * des composants React. Test de cohérence : itemActions.test.ts.
 */
import {
  ArrowDownToLine, BookOpen, Bookmark, ClipboardCopy, Copy, ExternalLink, EyeOff, FileDown, FolderInput, FolderPlus, Hash,
  Image as ImageIcon, LayoutTemplate, ListTree, Merge, PenLine, Pencil, Plus, Printer, Scissors, Trash2, UserPlus,
} from 'lucide-react';
import type { ItemAction } from '../components/ui/ItemActionMenu';

type Def = { label: string; icon: ItemAction['icon'] };

export const ITEM_ACTIONS = {
  // Modes : les trois affichages d'un élément
  read: { label: 'Lire', icon: BookOpen },
  edit: { label: 'Modifier', icon: Pencil },
  compose: { label: 'Composer', icon: PenLine },
  openNewTab: { label: 'Ouvrir dans un nouvel onglet', icon: ExternalLink },
  // Suivi et partage
  markUnread: { label: 'Marquer comme non lu', icon: EyeOff },
  bookmark: { label: 'Épingler', icon: Bookmark },
  unbookmark: { label: 'Retirer des épingles', icon: Bookmark },
  print: { label: 'Imprimer', icon: Printer },
  exportPdf: { label: 'Exporter en PDF', icon: FileDown },
  copySheet: { label: 'Copier la fiche', icon: ClipboardCopy },
  copyThumbnail: { label: 'Copier la vignette', icon: ImageIcon },
  copyId: { label: 'Copier l\'identifiant', icon: Hash },
  // Organisation
  selfAssign: { label: 'M\'assigner', icon: UserPlus },
  move: { label: 'Déplacer vers un espace', icon: FolderInput },
  duplicate: { label: 'Dupliquer vers un espace', icon: Copy },
  convertToSpace: { label: 'Convertir en espace', icon: FolderPlus },
  addChild: { label: 'Ajouter un enfant', icon: Plus },
  // Structure
  absorbChildren: { label: 'Absorber les enfants', icon: ArrowDownToLine },
  splitDescription: { label: 'Éclater en sous-éléments', icon: Scissors },
  merge: { label: 'Fusionner avec…', icon: Merge },
  saveAsTemplate: { label: 'Enregistrer comme modèle', icon: LayoutTemplate },
  insertTemplate: { label: 'Ajouter une structure', icon: ListTree },
  delete: { label: 'Supprimer', icon: Trash2 },
} as const satisfies Record<string, Def>;

export type ItemActionId = keyof typeof ITEM_ACTIONS;

/** Les trois modes d'un élément, dans l'ordre du sélecteur */
export const ITEM_MODES = ['read', 'edit', 'compose'] as const;
export type ItemMode = (typeof ITEM_MODES)[number];

/** Entrée de menu d'après le registre ; `id` = l'id du registre, sauf si extra.id le remplace (compatibilité). */
export function itemAction(id: ItemActionId, onClick: () => void, extra: Partial<ItemAction> = {}): ItemAction {
  return { id, label: ITEM_ACTIONS[id].label, icon: ITEM_ACTIONS[id].icon, onClick, ...extra };
}

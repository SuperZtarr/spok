/*
 * composeTargets — registre des types d'élément qui ont un espace de travail propre, ouvert par le bouton
 * « Composer » du sélecteur de modes de la fiche (Afficher / Modifier / Composer). Un seul libellé, un seul
 * emplacement, les mêmes règles pour tous ces types (signalement cmwqikw4h00427icc43c4crb3, décision Thomas
 * 2026-11-25) :
 * - ARTICLE : page de l'article en composition (articleComposeUrl, 2026-11-26 — avant : mode Composer de la fiche),
 *   si l'on peut modifier l'élément ; un lecteur voit « Lire l'article » au même endroit ;
 * - PROCESS : page du canevas (processPageUrl), si l'on peut modifier l'élément ; un lecteur voit « Afficher le
 *   process » au même endroit (canevas en lecture seule).
 * Le genre 'mode' (espace de travail dans la fiche) n'a plus d'usage ; il reste prévu par le type.
 * composeButton calcule l'état du bouton (visible, libellé, grisé, rappel d'aide) ; les textes des rappels sont dans
 * components/help/item-modal.help.ts (hints, clés ComposeHint). Ajouter un type = une entrée ici + ses rappels.
 * Ne pas réintroduire de lien ou bouton propre à un type ailleurs dans la fiche.
 */
import { articleComposeUrl, processPageUrl } from './itemOpenMode';

export type ComposeHint = 'composeMode' | 'composeModeUnsaved' | 'openArticleUnsaved' | 'openArticleRead' | 'openProcess' | 'openProcessUnsaved' | 'openProcessRead';

export type ComposeTarget =
  | { kind: 'mode'; hint: ComposeHint; unsavedHint: ComposeHint }
  | { kind: 'page'; url: (spaceId: string, itemId: string) => string; hint: ComposeHint; unsavedHint: ComposeHint; readerLabel: string; readerHint: ComposeHint };

export const COMPOSE_TARGETS: Record<string, ComposeTarget> = {
  ARTICLE: { kind: 'page', url: articleComposeUrl, hint: 'composeMode', unsavedHint: 'openArticleUnsaved', readerLabel: "Lire l'article", readerHint: 'openArticleRead' },
  PROCESS: { kind: 'page', url: processPageUrl, hint: 'openProcess', unsavedHint: 'openProcessUnsaved', readerLabel: 'Afficher le process', readerHint: 'openProcessRead' },
};

export interface ComposeButton {
  target: ComposeTarget;
  label: string;
  disabled: boolean;
  hint: ComposeHint;
  /** Lecteur d'un type « page » : ouvre l'espace de travail en lecture */
  reader: boolean;
}

/**
 * État du bouton « Composer » de la fiche, ou null s'il n'y en a pas.
 * formType : type choisi dans la fiche ; savedType : type enregistré ; modeAllowed : droit de composer en mode fiche
 * (article.canEditArticle, renvoyé par l'API) ; hasChanges : saisies non enregistrées.
 */
export function composeButton(p: { formType?: string | null; savedType?: string | null; canEdit: boolean; modeAllowed: boolean; hasChanges: boolean }): ComposeButton | null {
  const target = p.formType ? COMPOSE_TARGETS[p.formType] : undefined;
  if (!target) return null;
  // Pas encore enregistré dans ce type : visible et grisé pour qui peut modifier, avec la phrase qui l'explique
  if (p.savedType !== p.formType) {
    return p.canEdit ? { target, label: 'Composer', disabled: true, hint: target.unsavedHint, reader: false } : null;
  }
  const allowed = target.kind === 'mode' ? p.modeAllowed : p.canEdit;
  if (allowed) return { target, label: 'Composer', disabled: p.hasChanges, hint: p.hasChanges ? 'composeModeUnsaved' : target.hint, reader: false };
  if (target.kind === 'page') return { target, label: target.readerLabel, disabled: false, hint: target.readerHint, reader: true };
  return null;
}

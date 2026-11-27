/*
 * composeTargets — registre des types d'élément qui ont une page de travail propre (Article : sa page ; Process : son
 * canevas). Vocabulaire unique (décision Thomas 2026-11-26, constants/itemActions.ts) : Lire | Modifier | Composer,
 * le même sélecteur sur la fiche, la page Article et le canevas (ItemModeSwitch).
 * - readUrl : la restitution (« Lire ») — page de lecture de l'article, canevas du process en consultation ;
 * - composeUrl : l'atelier (« Composer ») — même page en composition (?mode=composition), si l'on peut modifier.
 * composeButton calcule l'état de « Composer » dans la fiche (grisé avant enregistrement dans ce type ou avec des
 * saisies en attente, rappel d'aide) ; les textes des rappels sont dans components/help/item-modal.help.ts (ComposeHint).
 * Ajouter un type = une entrée ici + ses rappels. Ne pas réintroduire de lien ou bouton propre à un type ailleurs.
 */
import { articleComposeUrl, articlePageUrl, processComposeUrl, processPageUrl } from './itemOpenMode';

export type ComposeHint = 'composeMode' | 'composeModeUnsaved' | 'openArticleUnsaved' | 'openProcess' | 'openProcessUnsaved';

type UrlOf = (spaceId: string, itemId: string) => string;
export type ComposeTarget = { readUrl: UrlOf; composeUrl: UrlOf; hint: ComposeHint; unsavedHint: ComposeHint };

export const COMPOSE_TARGETS: Record<string, ComposeTarget> = {
  ARTICLE: { readUrl: articlePageUrl, composeUrl: articleComposeUrl, hint: 'composeMode', unsavedHint: 'openArticleUnsaved' },
  PROCESS: { readUrl: processPageUrl, composeUrl: processComposeUrl, hint: 'openProcess', unsavedHint: 'openProcessUnsaved' },
};

/** Page de travail d'un type (ou undefined pour un élément ordinaire) */
export const workspaceOf = (type?: string | null): ComposeTarget | undefined => (type ? COMPOSE_TARGETS[type] : undefined);

export interface ComposeButton {
  target: ComposeTarget;
  disabled: boolean;
  hint: ComposeHint;
}

/**
 * État de « Composer » dans la fiche, ou null s'il n'y en a pas (type sans page de travail, ou pas le droit de modifier).
 * formType : type choisi dans la fiche ; savedType : type enregistré ; hasChanges : saisies non enregistrées.
 */
export function composeButton(p: { formType?: string | null; savedType?: string | null; canEdit: boolean; hasChanges: boolean }): ComposeButton | null {
  const target = workspaceOf(p.formType);
  if (!target || !p.canEdit) return null;
  // Pas encore enregistré dans ce type : visible et grisé, avec la phrase qui l'explique
  if (p.savedType !== p.formType) return { target, disabled: true, hint: target.unsavedHint };
  return { target, disabled: p.hasChanges, hint: p.hasChanges ? 'composeModeUnsaved' : target.hint };
}

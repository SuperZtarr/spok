/* Texte d'un rappel fonctionnel d'une page ou modale (champ `hints` de sa fiche, registre PAGE_HELP) : infobulle d'une
   action à effet (« ce qui va se passer ») ou phrase d'explication d'un bloc de décision (demande en attente…).
   Usage : <HelpHint text={pageHint('admin-users', 'disable')}> ou <p>{pageHint('admin-communities', 'pending')}</p>.
   Les clés citées sont contrôlées par help/coverage.test.ts (texte présent dans la fiche) — ne jamais écrire le texte
   en dur dans la page. */
import { PAGE_HELP, type PageHelpKey } from './pageHelp';
import type { HelpEntry } from './types';

export function pageHint(page: PageHelpKey, key: string): string | undefined {
  return (PAGE_HELP[page] as HelpEntry).hints?.[key];
}

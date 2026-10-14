/* Aide utilisateur de la vue « Arbre radial » (radialTree) : à quoi elle sert, comment s'en servir, tour guidé (modèle 2026-10-14).
   Lue par le point d'interrogation (ViewHelpButton → HelpButton) et le tour (useViewOnboarding). */
import type { HelpEntry } from '../../../help/types';
import { SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

export const help: HelpEntry = {
  title: 'Arbre radial',
  summary: 'L\'arborescence disposée en cercle : la racine au centre, les branches rayonnent vers l\'extérieur.',
  short: 'Arbre en cercle',
  empty: 'Aucune arborescence à dessiner. Créez des éléments, puis des enfants sous eux, pour voir les branches rayonner.',
  tips: [
    'La racine est au centre, les feuilles sur les bords',
    'Survolez un nœud pour voir ses détails',
    'Cliquez sur un nœud pour ouvrir sa fiche',
  ],
  tour: [
    {
      popover: {
        title: 'Vue Arbre radial',
        description: 'Une arborescence compacte, lisible même pour les grandes structures.',
      },
    },
    {
      element: '[data-tour="radial-node"]',
      popover: {
        title: 'Un nœud',
        description: 'Survolez-le pour ses détails, cliquez pour ouvrir sa fiche.',
        side: 'right',
      },
    },
    ...SPACE_TOOLBAR_STEPS,
  ],
};

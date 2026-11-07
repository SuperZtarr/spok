/* Aide utilisateur de la vue « Arbre radial » (radialTree), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris par
   le « ? » (ViewHelpButton), le tour (useViewOnboarding) et le mode Aide. */
import type { HelpEntry } from '../../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../../help/elements';
import { SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

const elements: HelpElements = {
  diagramme: {
    title: 'Arbre radial',
    short: 'La hiérarchie en étoile.',
    text: 'Une arborescence compacte, lisible même pour les grandes structures : la racine au centre, les feuilles sur les bords. Molette pour zoomer.',
    side: 'top',
  },
  noeud: {
    title: 'Un nœud',
    short: 'Survolez pour ses détails, cliquez pour sa fiche.',
    text: 'Un élément : survolez-le pour ses détails, cliquez pour ouvrir sa fiche.',
    target: '[data-tour="radial-node"]',
    side: 'right',
  },
};

export const help: HelpEntry = {
  title: 'Arbre radial',
  summary: 'L\'arborescence disposée en cercle : la racine au centre, les branches rayonnent vers l\'extérieur.',
  short: 'Arbre en cercle',
  empty: 'Aucune arborescence à dessiner. Créez des éléments, puis des enfants sous eux, pour voir les branches rayonner.',
  ...helpFromElements(elements),
  tour: [
    ...elementTourSteps('radialTree', elements),
    ...SPACE_TOOLBAR_STEPS,
  ],
};

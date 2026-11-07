/* Aide utilisateur de la vue « Sunburst » (sunburst), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris par
   le « ? » (ViewHelpButton), le tour (useViewOnboarding) et le mode Aide. */
import type { HelpEntry } from '../../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../../help/elements';
import { SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

const elements: HelpElements = {
  diagramme: {
    title: 'Sunburst',
    short: 'La hiérarchie en anneaux.',
    text: 'La structure de l\'espace d\'un coup d\'œil : du centre vers l\'extérieur, chaque anneau descend d\'un niveau. La taille d\'un segment reflète son nombre de descendants.',
    side: 'top',
  },
  segment: {
    title: 'Un segment',
    short: 'Survolez pour son chemin, cliquez pour l\'ouvrir.',
    text: 'Survolez-le pour voir son chemin (espace › parent › élément). Cliquez : un élément ouvre sa fiche, un espace ou une communauté vous y emmène.',
    target: '[data-tour="sunburst-segment"]',
    side: 'right',
  },
  communautes: {
    title: 'Communautés',
    short: 'Choisissez les communautés représentées.',
    text: 'Choisissez les communautés représentées dans les anneaux.',
    side: 'bottom',
  },
};

export const help: HelpEntry = {
  title: 'Sunburst',
  summary: 'La hiérarchie en anneaux : le centre est l\'espace, chaque anneau un niveau, la taille d\'un segment son poids.',
  short: 'Cercles concentriques',
  empty: 'Aucune hiérarchie à dessiner. Créez des éléments, puis des enfants sous eux, pour former les anneaux.',
  ...helpFromElements(elements),
  tour: [
    ...elementTourSteps('sunburst', elements),
    ...SPACE_TOOLBAR_STEPS,
  ],
};

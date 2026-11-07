/* Aide utilisateur de la vue « Bugs » (bugs), écrite en éléments d'aide (help/elements.ts). Cette vue affiche ListView :
   ses en-têtes reprennent l'élément de la Liste, sa ligne garde son propre texte. En mode Aide, les zones list:* s'appliquent
   à l'intérieur de la vue. Lue par le « ? » (ViewHelpButton), le tour (useViewOnboarding) et le mode Aide. */
import type { HelpEntry } from '../../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../../help/elements';
import { ITEM_MENU_STEP, SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';
import { elements as listElements } from './list.help';

const elements: HelpElements = {
  contenu: {
    title: 'Bugs',
    short: 'Les anomalies à corriger.',
    text: 'La liste des anomalies à corriger dans cet espace : uniquement les éléments de type Bug. Mêmes gestes que la vue Liste.',
    side: 'top',
  },
  entetes: { ...listElements.entetes, noZone: true },
  ligne: {
    title: 'Un bug',
    short: 'Cliquez pour ouvrir sa fiche.',
    text: 'Cliquez pour ouvrir sa fiche et décrire l\'anomalie ; changez son statut au fil de la correction.',
    target: '[data-tour="list-row"]',
    noZone: true,
    side: 'bottom',
  },
};

export const help: HelpEntry = {
  title: 'Bugs',
  summary: 'Les anomalies (éléments de type Bug) de l\'espace, en liste.',
  short: 'Liste des bugs',
  empty: 'Aucun bug signalé. Créez un élément de type Bug pour le suivre ici.',
  ...helpFromElements(elements),
  tour: [
    ...elementTourSteps('bugs', elements),
    ...ITEM_MENU_STEP,
    ...SPACE_TOOLBAR_STEPS,
  ],
};

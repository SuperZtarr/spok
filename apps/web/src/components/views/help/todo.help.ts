/* Aide utilisateur de la vue « À faire » (todo), écrite en éléments d'aide (help/elements.ts). Cette vue affiche ListView :
   ses en-têtes reprennent l'élément de la Liste, sa ligne garde son propre texte. En mode Aide, les zones list:* s'appliquent
   à l'intérieur de la vue. Lue par le « ? » (ViewHelpButton), le tour (useViewOnboarding) et le mode Aide. */
import type { HelpEntry } from '../../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../../help/elements';
import { ITEM_MENU_STEP, SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';
import { elements as listElements } from './list.help';

const elements: HelpElements = {
  contenu: {
    title: 'À faire',
    short: 'Ce qui reste à faire dans l\'espace.',
    text: 'Ce qui reste à faire dans cet espace : les éléments de tous types (tâches, notes, réunions, documents…), ni terminés ni annulés. Le filtre Types de la barre d\'espace restreint à un type. Mêmes gestes que la vue Liste.',
    side: 'top',
  },
  entetes: { ...listElements.entetes, noZone: true },
  ligne: {
    title: 'Un élément',
    short: 'Cliquez pour ouvrir sa fiche.',
    text: 'Cliquez pour ouvrir sa fiche. Changez son statut pour le faire avancer : terminé ou annulé, il sort de la vue.',
    target: '[data-tour="list-row"]',
    noZone: true,
    side: 'bottom',
  },
};

export const help: HelpEntry = {
  title: 'À faire',
  summary: 'Tous les éléments ouverts de l\'espace, quel que soit leur type (hors terminés et annulés), en liste.',
  short: 'Éléments en cours',
  empty: 'Rien à faire. Les éléments terminés ou annulés n\'apparaissent pas ici ; créez-en un avec « Nouveau ».',
  ...helpFromElements(elements),
  tour: [
    ...elementTourSteps('todo', elements),
    ...ITEM_MENU_STEP,
    ...SPACE_TOOLBAR_STEPS,
  ],
};

/* Aide utilisateur de la vue « Types » (types), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris
   par le « ? » (ViewHelpButton), le tour (useViewOnboarding) et le mode Aide. */
import type { HelpEntry } from '../../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../../help/elements';
import { ITEM_MENU_STEP, SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

const elements: HelpElements = {
  colonne: {
    title: 'Colonne de type',
    short: 'Un type d\'élément : déposez-y une carte pour le lui donner.',
    text: 'Une colonne correspond à un type d\'élément, avec le nombre d\'éléments. Déposez une carte dans une autre colonne pour changer son type.',
    target: '[data-tour="types-column"]',
    side: 'right',
  },
  carte: {
    title: 'Carte d\'élément',
    short: 'Un élément : cliquez pour ouvrir sa fiche.',
    text: 'Un élément ; cliquez pour ouvrir sa fiche, glissez-le vers une autre colonne pour changer son type.',
    side: 'right',
  },
};

export const help: HelpEntry = {
  title: 'Types',
  summary: 'Les éléments en colonnes par type : notes, tâches, projets, réunions…',
  short: 'Colonnes par type d\'élément',
  empty: 'Aucun élément à classer par type. Créez des notes, tâches, projets… avec « Nouveau ».',
  ...helpFromElements(elements),
  tour: [
    {
      popover: {
        title: 'Vue Types',
        description: 'Vos éléments rangés par nature : notes, tâches, projets, réunions…',
      },
    },
    ...elementTourSteps('types', elements),
    ...ITEM_MENU_STEP,
    ...SPACE_TOOLBAR_STEPS,
  ],
};

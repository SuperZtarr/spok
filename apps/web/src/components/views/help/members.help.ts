/* Aide utilisateur de la vue « Membres » (members), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris
   par le « ? » (ViewHelpButton), le tour (useViewOnboarding) et le mode Aide. */
import type { HelpEntry } from '../../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../../help/elements';
import { ITEM_MENU_STEP, SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

const elements: HelpElements = {
  colonne: {
    title: 'Colonnes par membre',
    short: 'Une personne : déposez-y une carte pour la lui assigner.',
    text: 'Déposez une carte dans la colonne d\'un membre pour la lui assigner. « Non assigné » regroupe les éléments libres. Sans être connecté, seules les personnes qui ont des éléments assignés ont une colonne.',
    target: '[data-tour="members-column"]',
    side: 'right',
  },
  carte: {
    title: 'Carte d\'élément',
    short: 'Un élément : cliquez pour ouvrir sa fiche.',
    text: 'Un élément ; cliquez pour ouvrir sa fiche, glissez-le vers une autre colonne pour le réassigner.',
    side: 'right',
  },
};

export const help: HelpEntry = {
  title: 'Membres',
  summary: 'Les éléments en colonnes par personne assignée, plus « Non assigné ».',
  short: 'Kanban par membre',
  empty: 'Aucun élément à répartir. Assignez des éléments à des membres pour remplir leurs colonnes.',
  ...helpFromElements(elements),
  tour: [
    {
      popover: {
        title: 'Vue Membres',
        description: 'Qui fait quoi : une colonne par membre de l\'espace.',
      },
    },
    ...elementTourSteps('members', elements),
    ...ITEM_MENU_STEP,
    ...SPACE_TOOLBAR_STEPS,
  ],
};

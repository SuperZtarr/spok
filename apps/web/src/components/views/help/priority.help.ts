/* Aide utilisateur de la vue « Priorités » (priority), écrite en éléments d'aide (help/elements.ts) : un texte par fonction,
   repris par le « ? » (ViewHelpButton), le tour (useViewOnboarding) et le mode Aide. */
import type { HelpEntry } from '../../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../../help/elements';
import { ITEM_MENU_STEP, SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

const elements: HelpElements = {
  colonne: {
    title: 'Colonnes de priorité',
    short: 'Un niveau de priorité : déposez-y une carte pour le lui donner.',
    text: 'De P1 (Urgente) à P4 (Basse), puis Sans priorité. Glissez une carte d\'une colonne à l\'autre pour changer sa priorité.',
    target: '[data-tour="priority-column"]',
    side: 'right',
  },
  carte: {
    title: 'Carte d\'élément',
    short: 'Un élément : cliquez pour ouvrir sa fiche.',
    text: 'Un élément ; cliquez pour ouvrir sa fiche, glissez-le vers une autre colonne pour changer sa priorité.',
    side: 'right',
  },
};

export const help: HelpEntry = {
  title: 'Priorités',
  summary: 'Les éléments en colonnes par priorité, de P1 (Urgente) à P4 (Basse), plus « Sans priorité ».',
  short: 'Kanban par priorité',
  empty: 'Aucun élément à classer. Donnez une priorité (P1 à P4) aux éléments pour remplir les colonnes.',
  ...helpFromElements(elements),
  tour: [
    {
      popover: {
        title: 'Vue Priorités',
        description: 'Pour reprioriser d\'un geste : chaque colonne est un niveau de priorité.',
      },
    },
    ...elementTourSteps('priority', elements),
    ...ITEM_MENU_STEP,
    ...SPACE_TOOLBAR_STEPS,
  ],
};

/* Aide utilisateur de la vue « Membres » (members), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris
   par le « ? » (ViewHelpButton), le tour (useViewOnboarding) et le mode Aide. Zone « sanscompte » : colonnes des noms
   saisis librement (présentes seulement s'il y en a ; l'étape du tour est alors sautée). */
import type { HelpEntry } from '../../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../../help/elements';
import { ITEM_MENU_STEP, SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

const elements: HelpElements = {
  colonne: {
    title: 'Colonnes par membre',
    short: 'Une personne : déposez-y une carte pour la lui assigner.',
    text: 'Déposez une carte dans la colonne d\'un membre pour la lui assigner. « Non assigné » regroupe les éléments sans personne ; y déposer une carte retire le membre comme le nom saisi. Sans être connecté, seules les personnes qui ont des éléments assignés ont une colonne.',
    target: '[data-tour="members-column"]',
    side: 'right',
  },
  sanscompte: {
    title: 'Personnes sans compte',
    short: 'Un nom saisi dans « Assigné à », sans compte SPOK.',
    text: 'Un nom saisi librement dans « Assigné à » a sa propre colonne « sans compte », même si un membre porte le même nom. Les saisies qui ne diffèrent que par les majuscules ou les espaces sont regroupées. Déposer une carte ici lui assigne ce nom : pas de notification ni d\'entrée dans « Mes tâches ».',
    side: 'right',
    changes: [{ id: 'members-free-assignee-columns', kind: 'evolution', text: 'Les éléments assignés à une personne sans compte ont leur colonne à son nom, au lieu de « Non assigné ».', date: '2026-11-12' }],
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
  summary: 'Les éléments en colonnes par personne assignée (membre ou nom saisi sans compte), plus « Non assigné ».',
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

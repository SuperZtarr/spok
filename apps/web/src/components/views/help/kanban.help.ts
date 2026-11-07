/* Aide utilisateur de la vue « Kanban » (kanban), écrite en éléments d'aide (2026-11-07).
   Chaque fonction est écrite une fois dans `elements` ; conseils, zones du mode Aide, infobulles et étapes du tour en
   sont dérivés (help/elements.ts). Lue par le « ? » (ViewHelpButton → HelpButton), le tour (useViewOnboarding), le mode
   Aide (helpZones), l'infobulle de colonne (KanbanView) et les nouveautés (help/announcements.ts). */
import type { HelpEntry } from '../../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../../help/elements';
import { ITEM_MENU_STEP, SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

const elements: HelpElements = {
  colonne: {
    title: 'Colonne de statut',
    short: 'Un statut de l\'espace : déposez-y une carte pour le lui donner.',
    text: 'Une colonne correspond à un statut de l\'espace, avec le nombre d\'éléments à côté de son nom. Déposez une carte dans une colonne pour lui donner ce statut.',
    side: 'right',
  },
  carte: {
    title: 'Carte d\'élément',
    short: 'Un élément : cliquez pour ouvrir sa fiche, glissez pour changer son statut.',
    text: 'Une carte représente un élément, avec son type, sa priorité, son échéance et ses tags. Cliquez pour ouvrir sa fiche ; glissez-la vers une autre colonne pour changer son statut.',
    side: 'right',
  },
};

export const help: HelpEntry = {
  title: 'Kanban',
  summary: 'Les éléments en colonnes par statut, pour suivre l\'avancement du travail.',
  short: 'Colonnes par statut',
  empty: 'Aucun élément à classer par statut. Créez-en un avec « Nouveau » : il se range dans la colonne de son statut.',
  ...helpFromElements(elements),
  tour: [
    {
      popover: {
        title: 'Vue Kanban',
        description: 'Vos éléments en colonnes par statut : on voit d\'un coup d\'œil ce qui est à faire, en cours, terminé.',
      },
    },
    ...elementTourSteps('kanban', elements),
    ...ITEM_MENU_STEP,
    ...SPACE_TOOLBAR_STEPS,
  ],
};

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
    text: 'Une colonne correspond à un statut de l\'espace, avec le nombre d\'éléments à côté de son nom. Déposez une carte dans une colonne pour lui donner ce statut. Comme dans la fiche : un statut Terminé ou Annulé remplit la date de fin si elle est vide, tout statut remplit la date de début vide, et « Non défini » efface les deux dates (l\'élément quitte le Gantt).',
    side: 'right',
    changes: [{ id: 'status-dates-everywhere', kind: 'evolution', text: 'Changer de statut depuis le Kanban ou le menu ⋮ suit les mêmes règles que la fiche : « Non défini » efface maintenant les dates de début et de fin, l\'élément ne reste plus dans le Gantt.', date: '2026-11-11' }],
  },
  carte: {
    title: 'Carte d\'élément',
    short: 'Un élément : cliquez pour ouvrir sa fiche, glissez pour changer son statut.',
    text: 'Une carte représente un élément, avec le même aspect que dans les autres vues : sa première image (ou son premier schéma) en bandeau, son titre, l\'essentiel de son type (statut et échéance d\'une tâche, dates d\'un projet…), le début de sa description, ses tags et des pastilles qui comptent ses autres contenus (images, fichiers, liens, schémas). Une carte qui clignote en rouge est critique, en bleu modifiée depuis votre dernière lecture. Cliquez pour ouvrir sa fiche ; glissez-la vers une autre colonne pour changer son statut.',
    side: 'right',
    changes: [{ id: 'item-vignette', kind: 'evolution', text: 'Un élément a maintenant le même aspect dans toutes les vues (Kanban, Liste, Planning, carte mentale, Loupe, Activité, Favoris) : miniature tirée de sa première image ou de son premier schéma, et pastilles qui comptent ses autres contenus.', date: '2026-11-11' }],
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

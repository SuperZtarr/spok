/* Aide utilisateur de la vue « Kanban » (kanban), écrite en éléments d'aide (2026-11-07).
   Chaque fonction est écrite une fois dans `elements` ; conseils, zones du mode Aide, infobulles et étapes du tour en
   sont dérivés (help/elements.ts). Lue par le « ? » (ViewHelpButton → HelpButton), le tour (useViewOnboarding), le mode
   Aide (helpZones), l'infobulle de colonne (KanbanView) et les nouveautés (help/announcements.ts).
   famille (2026-11-19) : sélecteur « Éléments | Questions » (familles de statuts) ; hints.familyGeneral = libellé du
   bouton des statuts ordinaires (les autres boutons prennent le libellé du type). */
import type { HelpEntry } from '../../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../../help/elements';
import { ITEM_MENU_STEP, SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

const elements: HelpElements = {
  famille: {
    title: 'Famille de statuts',
    short: 'Choisit les éléments affichés : ceux aux statuts ordinaires, ou les réunions, articles ou questions avec leurs propres statuts.',
    text: 'Réunions, articles et questions ont leurs propres statuts (une réunion va de « À organiser » à « CR envoyé », une question d\'« Ouverte » à « Tranchée »…). Quand l\'espace en contient, le Kanban montre une famille à la fois : « Éléments » (tâches, projets… et leurs statuts ordinaires), « Réunions », « Articles » ou « Questions », chacune avec ses colonnes. Le choix est retenu pour cet espace dans ce navigateur. Les éléments des autres familles ne sont ni masqués ailleurs ni modifiés. Une colonne « Autre statut » regroupe, s\'il y en a, les cartes dont le statut n\'est pas l\'une des colonnes (statut d\'avant le changement, statut masqué) : ouvrez la carte pour lui en donner un.',
    side: 'bottom',
    changes: [{ id: 'kanban-status-family', kind: 'evolution', text: 'Kanban : un sélecteur « Éléments | Réunions | Articles | Questions » sépare chaque famille de statuts, au lieu de tout mélanger dans les mêmes colonnes.', date: '2026-11-19' }],
  },
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
    text: 'Une carte représente un élément, avec le même aspect que dans les autres vues : sa première image (ou son premier schéma) en bandeau, son titre, sa priorité si elle est renseignée (pastille colorée), ce qui est renseigné quel que soit son type (statut, dates, échéance, assigné, format du fichier ou site du lien), le début de sa description, ses tags et des pastilles qui comptent ses autres contenus (images, fichiers, liens, schémas). Une carte qui clignote en rouge est critique, en bleu modifiée depuis votre dernière lecture. Cliquez pour ouvrir sa fiche ; glissez-la vers une autre colonne pour changer son statut.',
    side: 'right',
    changes: [{ id: 'item-vignette-all-info', kind: 'evolution', text: 'Les cartes montrent maintenant tout ce qui est renseigné, quel que soit le type de l\'élément : statut, dates, échéance et assigné.', date: '2026-11-20' }, { id: 'item-vignette-priority', kind: 'evolution', text: 'La priorité d\'un élément s\'affiche maintenant en pastille colorée sur sa vignette, dans toutes les vues (Kanban, Liste, Planning, carte mentale, Loupe, Activité, Favoris, Tags, Types).', date: '2026-11-18' }, { id: 'item-vignette', kind: 'evolution', text: 'Un élément a maintenant le même aspect dans toutes les vues (Kanban, Liste, Planning, carte mentale, Loupe, Activité, Favoris) : miniature tirée de sa première image ou de son premier schéma, et pastilles qui comptent ses autres contenus.', date: '2026-11-11' }],
  },
};

const derived = helpFromElements(elements);

export const help: HelpEntry = {
  title: 'Kanban',
  summary: 'Les éléments en colonnes par statut, pour suivre l\'avancement du travail.',
  short: 'Colonnes par statut',
  empty: 'Aucun élément à classer par statut. Créez-en un avec « Nouveau » : il se range dans la colonne de son statut.',
  ...derived,
  hints: {
    ...derived.hints,
    familyGeneral: 'Éléments',
    otherColumn: 'Autre statut',
  },
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

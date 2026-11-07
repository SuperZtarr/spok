/* Aide utilisateur de la vue « Gantt » (timeline), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris par le
   « ? » (ViewHelpButton), le tour (useViewOnboarding), le mode Aide et les infobulles de l'en-tête (hints, via HelpHint dans
   TimelineView : les clés lues là-bas ne doivent pas changer). */
import type { HelpEntry } from '../../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../../help/elements';
import { ITEM_MENU_STEP, SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

const elements: HelpElements = {
  dates: {
    title: 'Échelle de temps',
    short: 'Les années, mois, semaines ou jours.',
    text: 'Les années, mois, semaines ou jours selon le zoom choisi.',
    side: 'bottom',
  },
  lignes: {
    title: 'Lignes',
    short: 'Un élément par ligne.',
    text: 'Un élément par ligne : son nom à gauche, avec la personne assignée, sa barre à droite. Les flèches sont les dépendances, le losange l\'échéance. Un élément ne se range que sous un parent du même espace ; pour changer d\'espace, utilisez « Déplacer vers un espace » du menu ⋮.',
    side: 'top',
  },
  barre: {
    title: 'Une barre',
    short: 'Glissez pour décaler, tirez un bord pour changer les dates.',
    text: 'Glissez-la pour la décaler (SPOK propose de décaler aussi ce qui en dépend), tirez un bord pour changer le début ou la fin. Tirez depuis son point central vers une autre barre pour créer une dépendance. Clic droit sur la ligne : poser l\'échéance ; clic droit sur le losange : la retirer.',
    target: '[data-tour="timeline-bar"]',
    noZone: true,
    side: 'bottom',
  },
  today: {
    title: 'Naviguer dans le temps',
    short: 'Recentrer la frise sur la date du jour',
    text: 'Précédent / Suivant font défiler la période ; ce bouton recentre sur aujourd\'hui.',
    target: '[data-tour="timeline-today"]',
    noZone: true,
    side: 'bottom',
  },
  chronoReorder: {
    title: 'Réordonner chronologiquement',
    short: 'Réordonner chronologiquement : range les éléments par date de début (ordre enregistré)',
    text: 'Range les éléments par date de début (l\'ordre est enregistré).',
    target: '[data-tour="timeline-reorder"]',
    noZone: true,
    side: 'bottom',
  },
  compact: {
    title: 'Éléments sans date',
    short: 'Masque ou réaffiche les éléments sans date.',
    text: 'Masque ou réaffiche les éléments qui n\'ont pas encore de dates.',
    target: '[data-tour="timeline-compact"]',
    noZone: true,
    side: 'bottom',
  },
  tout: {
    title: 'Réduire / Étendre',
    short: 'Replie ou réaffiche les sous-éléments.',
    text: 'Replie les sous-éléments sous leur parent (une seule ligne par branche) ou les réaffiche tous.',
    target: '[data-tour="collapse-toggle"]',
    noZone: true,
    side: 'bottom',
  },
  critical: {
    title: 'Chemin critique',
    short: 'Affiche la suite de tâches qui fixe la date de fin.',
    text: 'Met en rouge la suite de tâches qui fixe la date de fin : un retard sur l\'une retarde tout.',
    target: '[data-tour="timeline-critical"]',
    noZone: true,
    side: 'bottom',
  },
  zoom: {
    title: 'Zoom',
    short: 'Du jour à plusieurs années.',
    text: 'Du jour à plusieurs années : zoom avant / arrière, ou choisissez le niveau.',
    target: '[data-tour="timeline-zoom"]',
    noZone: true,
    side: 'bottom',
  },
};

const derived = helpFromElements(elements);

export const help: HelpEntry = {
  title: 'Gantt',
  summary: 'Le diagramme de Gantt : chaque élément daté en barre sur une ligne de temps, avec ses dépendances et son échéance.',
  short: 'Diagramme de Gantt',
  empty: 'Aucun élément daté. Donnez des dates de début et de fin (ou une échéance) à un élément pour le voir en barre.',
  ...derived,
  hints: {
    ...derived.hints,
    previous: 'Période précédente',
    next: 'Période suivante',
    compactOn: 'Réafficher les éléments sans date',
    compactOff: 'Masquer les éléments sans date',
    criticalOn: 'Masquer le chemin critique',
    criticalOff: 'Afficher le chemin critique : la suite de tâches qui fixe la date de fin',
    zoomIn: 'Zoom avant',
    zoomLevel: 'Échelle de la frise : du jour à plusieurs années',
    zoomOut: 'Zoom arrière',
  },
  tour: [
    {
      popover: {
        title: 'Vue Gantt',
        description: 'Chaque élément daté est une barre sur la frise.',
      },
    },
    ...elementTourSteps('timeline', elements),
    ...ITEM_MENU_STEP,
    ...SPACE_TOOLBAR_STEPS,
  ],
};

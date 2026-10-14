/* Aide utilisateur de la vue « Gantt » (timeline) : à quoi elle sert, comment s'en servir, tour guidé (modèle 2026-10-14).
   Lue par le point d'interrogation (ViewHelpButton → HelpButton), le tour (useViewOnboarding) et les infobulles des
   commandes de l'en-tête (hints, via HelpHint dans TimelineView). */
import type { HelpEntry } from '../../../help/types';
import { ITEM_MENU_STEP, SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

export const help: HelpEntry = {
  title: 'Gantt',
  summary: 'Le diagramme de Gantt : chaque élément daté en barre sur une ligne de temps, avec ses dépendances et son échéance.',
  short: 'Diagramme de Gantt',
  empty: 'Aucun élément daté. Donnez des dates de début et de fin (ou une échéance) à un élément pour le voir en barre.',
  tips: [
    'Glissez une barre pour la décaler, tirez ses bords pour changer ses dates',
    'Clic droit sur la ligne d\'un élément pour poser son échéance (losange) ; clic droit sur le losange pour la retirer',
    'Tirez depuis le point central d\'une barre vers une autre pour créer une dépendance',
    'Le chemin critique montre les tâches qui fixent la date de fin',
    'Réduire replie les sous-éléments sous leur parent, Étendre les réaffiche',
  ],
  hints: {
    previous: 'Période précédente',
    today: 'Recentrer la frise sur la date du jour',
    next: 'Période suivante',
    chronoReorder: 'Réordonner chronologiquement : range les éléments par date de début (ordre enregistré)',
    compactOn: 'Réafficher les éléments sans date',
    compactOff: 'Masquer les éléments sans date',
    criticalOn: 'Masquer le chemin critique',
    criticalOff: 'Afficher le chemin critique : la suite de tâches qui fixe la date de fin',
    zoomIn: 'Zoom avant',
    zoomLevel: 'Échelle de la frise : du jour à plusieurs années',
    zoomOut: 'Zoom arrière',
  },
  zones: {
    dates: { title: 'Échelle de temps', text: 'Les années, mois, semaines ou jours selon le zoom choisi.' },
    lignes: { title: 'Lignes', text: 'Un élément par ligne : son nom à gauche, sa barre à droite. Les flèches sont les dépendances, le losange l\'échéance.' },
  },
  tour: [
    {
      popover: {
        title: 'Vue Gantt',
        description: 'Chaque élément daté est une barre sur la frise. Les flèches sont les dépendances, le losange l\'échéance.',
      },
    },
    {
      element: '[data-tour="timeline-bar"]',
      popover: {
        title: 'Une barre',
        description: 'Glissez-la pour la décaler (SPOK propose de décaler aussi ce qui en dépend), tirez un bord pour changer le début ou la fin. Clic droit sur la ligne : poser l\'échéance.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="timeline-today"]',
      popover: {
        title: 'Se déplacer dans le temps',
        description: 'Précédent / Suivant font défiler la période ; ce bouton recentre sur aujourd\'hui.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="timeline-reorder"]',
      popover: {
        title: 'Réordonner chronologiquement',
        description: 'Range les éléments par date de début (l\'ordre est enregistré).',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="timeline-compact"]',
      popover: {
        title: 'Éléments sans date',
        description: 'Masque ou réaffiche les éléments qui n\'ont pas encore de dates.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="collapse-toggle"]',
      popover: {
        title: 'Réduire / Étendre',
        description: 'Replie les sous-éléments sous leur parent (une seule ligne par branche) ou les réaffiche tous.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="timeline-critical"]',
      popover: {
        title: 'Chemin critique',
        description: 'Met en rouge la suite de tâches qui fixe la date de fin : un retard sur l\'une retarde tout.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="timeline-zoom"]',
      popover: {
        title: 'Zoom',
        description: 'Du jour à plusieurs années : zoom avant / arrière, ou choisissez le niveau.',
        side: 'bottom',
      },
    },
    ...ITEM_MENU_STEP,
    ...SPACE_TOOLBAR_STEPS,
  ],
};

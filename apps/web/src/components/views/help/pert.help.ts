/* Aide utilisateur de la vue « PERT » (pert) : à quoi elle sert, comment s'en servir, tour guidé (modèle 2026-10-14).
   Lue par le point d'interrogation (ViewHelpButton → HelpButton) et le tour (useViewOnboarding). */
import type { HelpEntry } from '../../../help/types';
import { SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

export const help: HelpEntry = {
  title: 'PERT',
  summary: 'Le diagramme PERT : les tâches, leurs dépendances et le chemin critique.',
  short: 'Dépendances et chemin critique',
  empty: 'Aucune tâche à ordonner. Créez des tâches, puis reliez-les par « Bloque » pour dessiner leurs dépendances.',
  tips: [
    'Les nœuds sont les tâches, les flèches leurs dépendances',
    'Le chemin critique est mis en évidence',
    'Cliquez sur un nœud pour ouvrir la tâche',
  ],
  tour: [
    {
      popover: {
        title: 'Vue PERT',
        description: 'L\'enchaînement des tâches : ce qui doit être fini avant de commencer la suite, et le chemin critique.',
      },
    },
    {
      element: '[data-tour="pert-node"]',
      popover: {
        title: 'Un nœud = une tâche',
        description: 'Cliquez pour ouvrir sa fiche. Sa bordure indique ses relations (rouge : bloque, orange : est bloquée).',
        side: 'right',
      },
    },
    {
      element: '[title="Trier par rang de dépendance"]',
      popover: {
        title: 'Par rang',
        description: 'Range les tâches par rang de dépendance : chaque colonne ne dépend que des précédentes.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="pert-relation-filter"]',
      popover: {
        title: 'Types de relations',
        description: 'Filtrez les liens affichés : Bloque, Permet, Entraîne, Lié à.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="pert-zoom"]',
      popover: {
        title: 'Zoom',
        description: 'Moins / plus ; cliquez sur le pourcentage pour revenir à 100 %.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="pert-legend"]',
      popover: {
        title: 'Légende',
        description: 'Rappelle la signification des couleurs des nœuds et des flèches.',
        side: 'bottom',
      },
    },
    ...SPACE_TOOLBAR_STEPS,
  ],
};

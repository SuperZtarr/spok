/* Aide utilisateur de la vue « Activité (heatmap) » (heatmap) : à quoi elle sert, comment s'en servir, tour guidé (modèle 2026-10-14).
   Lue par le point d'interrogation (ViewHelpButton → HelpButton) et le tour (useViewOnboarding). */
import type { HelpEntry } from '../../../help/types';
import { SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

export const help: HelpEntry = {
  title: 'Activité (heatmap)',
  summary: 'L\'activité jour par jour, façon GitHub : plus une case est foncée, plus il s\'est passé de choses ce jour-là.',
  short: 'Activité temporelle',
  tips: [
    'Chaque case est un jour, la couleur indique l\'intensité',
    'Choisissez 6 mois ou 1 an, créations ou modifications',
    'Survolez une case pour le détail du jour',
    'Cliquez sur une case qui ne contient qu\'un élément pour ouvrir sa fiche',
  ],
  zones: {
    reglages: { title: 'Réglages', text: 'Période (6 mois ou 1 an) et activité comptée (créations ou modifications).' },
    case: { title: 'Un jour', text: 'Plus la case est foncée, plus il s\'est passé de choses ce jour-là ; survolez pour le détail.' },
  },
  tour: [
    {
      popover: {
        title: 'Vue Activité',
        description: 'Le rythme de l\'espace : les jours de forte activité ressortent en foncé.',
      },
    },
    {
      element: '[data-tour="heatmap-controls"]',
      popover: {
        title: 'Période et mesure',
        description: '6 mois ou 1 an ; compter les créations ou les modifications.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="heatmap-cell"]',
      popover: {
        title: 'Un jour',
        description: 'Survolez pour voir ce qui s\'est passé ce jour-là ; si un seul élément est concerné, un clic ouvre sa fiche.',
        side: 'top',
      },
    },
    ...SPACE_TOOLBAR_STEPS,
  ],
};

/* Aide utilisateur de la vue « Présentation » (overview) : à quoi elle sert, comment s'en servir, tour guidé (modèle 2026-10-14).
   Lue par le point d'interrogation (ViewHelpButton → HelpButton) et le tour (useViewOnboarding). */
import type { HelpEntry } from '../../../help/types';
import { SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

export const help: HelpEntry = {
  title: 'Présentation',
  summary: 'Vue d\'ensemble de l\'espace : couverture, chiffres, vues disponibles, sous-espaces et membres.',
  short: 'Carte d\'identité de l\'espace',
  tips: [
    'Cliquez sur une vue pour y accéder directement',
    'Les sous-espaces sont affichés avec leur couverture',
    'Les chiffres résument le contenu de l\'espace',
  ],
  tour: [
    {
      popover: {
        title: 'Présentation de l\'espace',
        description: 'La carte d\'identité de l\'espace : sa couverture, quelques chiffres, ses vues, ses sous-espaces et ses membres.',
      },
    },
    {
      element: '[data-tour="overview-view-card"]',
      popover: {
        title: 'Vues disponibles',
        description: 'Chaque carte ouvre une vue de l\'espace : liste, kanban, carte mentale…',
        side: 'bottom',
      },
    },
    {
      popover: {
        title: 'Sous-espaces et membres',
        description: 'Plus bas : les sous-espaces (cliquez pour y entrer) et les membres de l\'espace.',
      },
    },
    ...SPACE_TOOLBAR_STEPS,
  ],
};

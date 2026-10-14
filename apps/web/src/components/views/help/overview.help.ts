/* Aide utilisateur de la vue « Présentation » (overview) : à quoi elle sert, comment s'en servir, tour guidé (modèle 2026-10-14).
   Lue par le point d'interrogation (ViewHelpButton → HelpButton) et le tour (useViewOnboarding).
   Cette vue n'a ni barre de vue ni barre d'espace : pas de SPACE_TOOLBAR_STEPS, le tour pointe ses sections. */
import type { HelpEntry } from '../../../help/types';

export const help: HelpEntry = {
  title: 'Présentation',
  summary: 'Vue d\'ensemble de l\'espace : couverture, chiffres, vues disponibles, sous-espaces et membres.',
  short: 'Carte d\'identité de l\'espace',
  tips: [
    'Cliquez sur une vue pour y accéder directement',
    'Les sous-espaces sont affichés avec leur couverture',
    'Les chiffres résument le contenu de l\'espace',
  ],
  zones: {
    stats: { title: 'En chiffres', text: 'Nombre d\'éléments, de membres et de sous-espaces.' },
    vues: { title: 'Vues disponibles', text: 'Chaque carte ouvre une vue de l\'espace, avec son accroche.' },
    sousespaces: { title: 'Sous-espaces', text: 'Les espaces rangés sous celui-ci ; cliquez pour y entrer.' },
    membres: { title: 'Membres', text: 'Les personnes qui ont accès à l\'espace, avec leur rôle.' },
  },
  tour: [
    {
      popover: {
        title: 'Présentation de l\'espace',
        description: 'La carte d\'identité de l\'espace : sa couverture, quelques chiffres, ses vues, ses sous-espaces et ses membres.',
      },
    },
    {
      element: '[data-tour="overview-settings"]',
      popover: {
        title: 'Paramètres',
        description: 'Nom, couverture, visibilité, membres, vue par défaut… Réservé aux propriétaires de l\'espace.',
        side: 'left',
      },
    },
    {
      element: '[data-tour="overview-stats"]',
      popover: {
        title: 'En chiffres',
        description: 'Nombre d\'éléments, de membres et de sous-espaces.',
        side: 'bottom',
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
      element: '[data-tour="overview-subspaces"]',
      popover: {
        title: 'Sous-espaces',
        description: 'Les espaces rangés sous celui-ci : cliquez sur une carte pour y entrer.',
        side: 'top',
      },
    },
    {
      element: '[data-tour="overview-members"]',
      popover: {
        title: 'Membres',
        description: 'Les personnes qui ont accès à l\'espace, avec leur rôle.',
        side: 'top',
      },
    },
  ],
};

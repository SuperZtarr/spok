/* Aide utilisateur de la page « Accueil » (/).
   Lue par le point d'interrogation de la page (PageHelpButton) et son tour — registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';

export const help: HelpEntry = {
  title: 'Accueil',
  summary: 'Votre point de départ : raccourcis, aperçus du tableau de bord, activité récente, communautés et espaces favoris.',
  tips: [
    'Les aperçus montrent les échéances, retards, tâches assignées et non-lus',
    'Cliquez sur une carte de communauté pour y entrer',
    'Ajoutez un espace aux favoris (étoile) pour le retrouver ici',
  ],
  tour: [
    {
      element: '[data-tour="home-welcome"]',
      popover: {
        title: 'Accueil',
        description: 'Tout ce qui vous concerne, d\'un coup d\'œil.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="home-shortcuts"]',
      popover: {
        title: 'Raccourcis',
        description: 'Accès direct aux pages les plus utiles.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="home-previews"]',
      popover: {
        title: 'Aperçus',
        description: 'Échéances proches, retards, tâches qui vous sont assignées, notifications non lues. « Voir tout » ouvre la page complète (pour les non lus : la cloche des notifications).',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="home-activity"]',
      popover: {
        title: 'Activité récente',
        description: 'Les éléments modifiés par d\'autres depuis votre dernier passage.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="home-communities"]',
      popover: {
        title: 'Vos communautés',
        description: 'Vos communautés avec leur activité récente ; cliquez pour y entrer.',
        side: 'top',
      },
    },
    {
      element: '[data-tour="home-favorites"]',
      popover: {
        title: 'Espaces favoris',
        description: 'Les espaces marqués d\'une étoile.',
        side: 'top',
      },
    },
  ],
};

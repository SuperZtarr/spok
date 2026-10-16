/* Aide utilisateur des Paramètres de la communauté (/communities/:id/settings).
   Lue par le point d'interrogation de l'écran (HelpButton) et le tour (usePageTourPulse) — registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';

export const help: HelpEntry = {
  title: 'Paramètres de la communauté',
  summary: 'Gérez votre communauté : informations et contexte, images, référentiels, tags, espaces, membres et emails.',
  tips: [
    'Général : nom, description, visibilité et contexte (Forum, Projet, JDR)',
    'Espaces : glissez une ligne sur le haut ou le bas d\'une autre pour changer l\'ordre, sur son milieu pour la ranger dedans',
    'Membres : 3 colonnes (non-membres, membres, propriétaires)',
    'Emails : historique des envois, renvoi aux nouveaux membres',
  ],
  tour: [
    {
      element: '[data-tour="community-tab-general"]',
      popover: {
        title: 'Général',
        description: 'Nom, description et visibilité (publique/privée) de la communauté. Les tags partagés entre tous les espaces de la communauté.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="community-tab-images"]',
      popover: {
        title: 'Images',
        description: 'Avatar (affiché dans la sidebar et les cartes) et image de couverture. Glissez ou cliquez pour uploader.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="community-tab-spaces"]',
      popover: {
        title: 'Espaces',
        description: 'Liste des espaces de la communauté. Réorganisez la hiérarchie par glisser-déposer. Créez de nouveaux espaces.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="community-tab-members"]',
      popover: {
        title: 'Membres',
        description: '3 colonnes : non-membres → membres → propriétaires. Cliquez les flèches pour déplacer entre colonnes.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="community-tab-emails"]',
      popover: {
        title: 'Emails',
        description: 'Historique des emails envoyés à la communauté. Renvoyez un email aux nouveaux membres ou individuellement.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="community-tab-referentiels"]',
      popover: {
        title: 'Référentiels',
        description: 'Les statuts et les libellés de types de la communauté : libellés, couleurs, ordre. Les espaces en héritent.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="community-tab-tags"]',
      popover: {
        title: 'Tags',
        description: 'Les tags partagés par les espaces de la communauté : nom et couleur.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="community-tab-apercu"]',
      popover: {
        title: 'Aperçu',
        description: 'Comment la communauté apparaît dans les listes (vignette).',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="community-tab-danger"]',
      popover: {
        title: 'Danger',
        description: 'Supprimer la communauté, avec ou sans ses espaces.',
        side: 'bottom',
      },
    },
  ],
  fields: {
    spacesOrder: 'Glissez un espace sur le haut ou le bas d\'une ligne pour le placer avant ou après (ordre vu par tous les membres), sur son milieu pour en faire un sous-espace, ou sur le bandeau du haut pour le remettre au premier niveau.',
    visibilityRequest: 'Rendre la communauté visible par tous nécessite la validation d\'un administrateur : une demande sera envoyée à l\'enregistrement.',
    context: 'Le contexte adapte automatiquement l\'interface (vues proposées, champs) pour tous les visiteurs de la communauté.',
    avatar: '256 × 256 px, affiché en rond. Cliquez sur l\'image pour la changer.',
  },
};

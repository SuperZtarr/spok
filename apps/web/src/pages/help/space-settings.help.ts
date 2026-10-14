/* Aide utilisateur des Paramètres de l'espace (/spaces/:id/settings).
   Lue par le point d'interrogation de l'écran (HelpButton) et le tour (usePageTourPulse) — registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';

export const help: HelpEntry = {
  title: 'Paramètres de l\'espace',
  summary: 'Configurez votre espace : nom, communauté et parent, visibilité, vue par défaut, images, membres.',
  tips: [
    'Général : nom, communauté, espace parent, visibilité, vue par défaut et rôle des nouveaux membres',
    'Images : avatar et couverture — glissez ou collez une image',
    'Membres : 3 colonnes (non-membres, membres, propriétaires)',
    'Danger : supprimer l\'espace, avec ou sans ses sous-espaces',
  ],
  tour: [
    {
      element: '[data-tour="space-tab-general"]',
      popover: {
        title: 'Général',
        description: 'Nom, communauté de rattachement, espace parent, visibilité (dont « héritée »), vue ouverte par défaut et rôle des nouveaux membres de la communauté.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="space-tab-images"]',
      popover: {
        title: 'Images',
        description: 'Avatar (barre latérale, cartes) et image de couverture. Glissez, collez ou choisissez une image, puis cadrez la couverture.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="space-tab-members"]',
      popover: {
        title: 'Membres',
        description: 'Les accès en 3 colonnes : non-membres → membres → propriétaires. Invitez de nouvelles personnes par email.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="space-tab-apercu"]',
      popover: {
        title: 'Aperçu',
        description: 'Comment l\'espace apparaît dans les listes (carte).',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="space-tab-danger"]',
      popover: {
        title: 'Zone de danger',
        description: 'Transférer la propriété ou supprimer l\'espace, avec prévisualisation de ce qui sera supprimé : sous-espaces supprimés ou détachés.',
        side: 'bottom',
      },
    },
  ],
  fields: {
    community: 'Rattache cet espace à une communauté dont vous êtes membre.',
    parent: 'Range cet espace sous un autre espace de la même communauté : il en devient un sous-espace.',
    defaultRole: 'Quand quelqu\'un rejoint la communauté, il est ajouté automatiquement à cet espace avec ce rôle.',
    visibility: 'Ce que peuvent faire les membres de la communauté qui ne sont pas membres de cet espace. « Héritée » suit l\'espace parent ou la communauté.',
    defaultView: 'La vue affichée à l\'ouverture de l\'espace, pour tout le monde.',
    avatar: '256 × 256 px, affiché en rond. Cliquez sur l\'image pour la changer.',
  },
};

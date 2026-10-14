/* Aide utilisateur de la modale « Profil utilisateur » (UserProfileModal).
   Lue par son point d'interrogation (PageHelpButton) et son tour — registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';

export const help: HelpEntry = {
  title: 'Profil',
  summary: 'Votre compte : identité, avatar, thème, notifications, accès Claude, tutoriels et communautés.',
  tips: [
    'Changez votre nom, votre avatar ou votre mot de passe',
    'Choisissez quelles notifications vous recevez',
    '« Accès Claude » : demander l\'accès puis créer un jeton pour connecter Claude à SPOK',
    '« Réinitialiser tous les tutoriels » les fait revenir à la prochaine visite',
  ],
  tour: [
    {
      popover: {
        title: 'Profil',
        description: 'Tout ce qui concerne votre compte.',
      },
    },
    {
      element: '[data-tour="profile-identity"]',
      popover: {
        title: 'Identité',
        description: 'Email, nom, avatar et mot de passe.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="profile-theme"]',
      popover: {
        title: 'Thème',
        description: 'Clair, sombre ou selon le système.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="profile-notifications"]',
      popover: {
        title: 'Notifications',
        description: 'Choisissez ce qui vous est notifié.',
        side: 'top',
      },
    },
    {
      element: '[data-tour="profile-claude"]',
      popover: {
        title: 'Accès Claude',
        description: 'Connectez Claude à SPOK : demandez l\'accès, puis créez un jeton personnel.',
        side: 'top',
      },
    },
    {
      element: '[data-tour="profile-tutorials"]',
      popover: {
        title: 'Tutoriels',
        description: 'Remet à zéro tous les tutoriels déjà vus : ils se reproposeront.',
        side: 'left',
      },
    },
  ],
};

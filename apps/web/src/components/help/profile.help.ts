/* Aide utilisateur de la modale « Profil utilisateur » (UserProfileModal), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris par
   le « ? » (PageHelpButton), le tour et le mode Aide — registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

const elements: HelpElements = {
  identite: {
    title: 'Identité',
    short: 'Email, nom, avatar et mot de passe.',
    text: 'Email, nom, avatar et mot de passe.',
    target: '[data-tour="profile-identity"]',
    side: 'bottom',
  },
  theme: {
    title: 'Thème',
    short: 'Clair, sombre ou selon le système.',
    text: 'Clair, sombre ou selon le système.',
    target: '[data-tour="profile-theme"]',
    noZone: true,
    side: 'bottom',
  },
  notifications: {
    title: 'Notifications',
    short: 'Ce qui vous est notifié.',
    text: 'Choisissez ce qui vous est notifié.',
    target: '[data-tour="profile-notifications"]',
    side: 'top',
  },
  claude: {
    title: 'Accès Claude',
    short: 'Connectez Claude à SPOK.',
    text: 'Connectez Claude à SPOK : demandez l\'accès, puis créez un jeton personnel.',
    target: '[data-tour="profile-claude"]',
    side: 'top',
  },
  tutoriels: {
    title: 'Tutoriels',
    short: 'Remet à zéro les tutoriels déjà vus.',
    text: '« Réinitialiser tous les tutoriels » remet à zéro ceux déjà vus : ils se reproposeront à la prochaine visite.',
    target: '[data-tour="profile-tutorials"]',
    noZone: true,
    side: 'left',
  },
};

export const help: HelpEntry = {
  title: 'Profil',
  summary: 'Votre compte : identité, avatar, thème, notifications, accès Claude, tutoriels et communautés.',
  ...helpFromElements(elements),
  tour: [
    {
      popover: {
        title: 'Profil',
        description: 'Tout ce qui concerne votre compte.',
      },
    },
    ...elementTourSteps('profile', elements),
  ],
};

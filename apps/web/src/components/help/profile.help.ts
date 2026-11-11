/* Aide utilisateur de la modale « Profil utilisateur » (UserProfileModal), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris par
   le « ? » (PageHelpButton), le tour et le mode Aide — registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

// Le profil est en onglets : seul l'onglet Compte est affiché à l'ouverture. Les étapes du tour visent donc les
// boutons d'onglet (data-tour profile-tab-<id>), jamais un contenu d'onglet caché ; seule « Identité » vise son bloc.
const elements: HelpElements = {
  identite: {
    title: 'Compte',
    short: 'Email, mot de passe, rôle et communautés.',
    text: 'Onglet Compte : email, mot de passe, rôle et communautés dont vous êtes membre. Le nom et l\'avatar se changent dans l\'en-tête, toujours visible.',
    target: '[data-tour="profile-identity"]',
    side: 'bottom',
    changes: [{ id: 'profile-tabs', kind: 'evolution', text: 'Le profil s\'agrandit et se range en onglets : Compte, Préférences, Notifications, Accès Claude.', date: '2026-11-11' }],
  },
  theme: {
    title: 'Préférences',
    short: 'Thème et tutoriels.',
    text: 'Onglet Préférences : thème clair ou sombre.',
    target: '[data-tour="profile-tab-preferences"]',
    noZone: true,
    side: 'bottom',
  },
  notifications: {
    title: 'Notifications',
    short: 'Ce qui vous est notifié.',
    text: 'Onglet Notifications : choisissez ce qui vous est notifié, dans l\'application et par email.',
    target: '[data-tour="profile-tab-notifications"]',
    side: 'bottom',
  },
  claude: {
    title: 'Accès Claude',
    short: 'Connectez Claude à SPOK.',
    text: 'Onglet Accès Claude : connectez Claude à SPOK — demandez l\'accès, puis créez un jeton personnel.',
    target: '[data-tour="profile-tab-claude"]',
    side: 'bottom',
  },
  tutoriels: {
    title: 'Tutoriels',
    short: 'Remet à zéro les tutoriels déjà vus.',
    text: 'Onglet Préférences : « Réinitialiser tous les tutoriels » remet à zéro ceux déjà vus ; ils se reproposeront à la prochaine visite.',
    target: '[data-tour="profile-tab-preferences"]',
    noZone: true,
    side: 'bottom',
  },
};

export const help: HelpEntry = {
  title: 'Profil',
  summary: 'Votre compte, rangé en onglets : Compte (identité, mot de passe, communautés), Préférences (thème, tutoriels), Notifications, Accès Claude — et Administration pour un administrateur.',
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

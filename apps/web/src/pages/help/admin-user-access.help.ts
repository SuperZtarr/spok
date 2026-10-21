/* Aide utilisateur de la page d'administration « Accès d'un utilisateur » (/admin/users/:id/access, UserAccessPage).
   Lue par son point d'interrogation (PageHelpButton), son tour et ses rappels fonctionnels (hints, via pageHint :
   infobulles des actions à effet, explication des blocs de décision) — registre help/pageHelp.ts.
   Les rappels décrivent l'effet réel côté API : à revérifier à chaque évolution des routes /admin. */
import type { HelpEntry } from '../../help/types';

export const help: HelpEntry = {
  title: 'Accès d\'un utilisateur',
  summary: 'Pour un compte, l\'arbre de toutes les communautés et de leurs espaces, avec l\'accès qu\'il a — et celui qu\'il pourrait avoir.',
  tips: [
    'La couleur d\'une case donne le rôle effectif : propriétaire, membre, lecture seule, admin — ou aucun accès (il pourrait être ajouté)',
    'Un accès peut être direct (membre) ou hérité de la visibilité de la communauté ou de l\'espace parent',
    'Page en lecture seule : les droits se changent dans les paramètres de la communauté ou de l\'espace',
  ],
  tour: [
    {
      popover: {
        title: 'Accès d\'un utilisateur',
        description: 'Tout ce que ce compte peut voir ou modifier, sur l\'ensemble de SPOK.',
      },
    },
    {
      element: '[data-tour="admin-access-legend"]',
      popover: {
        title: 'Légende',
        description: 'Une couleur par rôle effectif.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="admin-access-tree"]',
      popover: {
        title: 'L\'arbre',
        description: 'Communautés puis leurs espaces ; chaque case montre l\'accès de ce compte.',
        side: 'top',
      },
    },
  ],
};

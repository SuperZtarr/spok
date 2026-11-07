/* Aide utilisateur de la page d'administration « Accès d'un utilisateur » (/admin/users/:id/access, UserAccessPage), écrite en éléments d'aide (help/elements.ts) :
   un texte par fonction, repris par le « ? » (PageHelpButton), le tour et le mode Aide — registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

const elements: HelpElements = {
  legende: {
    title: 'Légende',
    short: 'Une couleur par rôle effectif.',
    text: 'Une couleur par rôle effectif : propriétaire, membre, lecture seule, admin — ou aucun accès (il pourrait être ajouté).',
    target: '[data-tour="admin-access-legend"]',
    side: 'bottom',
  },
  arbre: {
    title: 'L\'arbre',
    short: 'L\'accès de ce compte, case par case.',
    text: 'Communautés puis leurs espaces ; chaque case montre l\'accès de ce compte, direct (membre) ou hérité de la visibilité de la communauté ou de l\'espace parent. Page en lecture seule : les droits se changent dans les paramètres de la communauté ou de l\'espace.',
    target: '[data-tour="admin-access-tree"]',
    side: 'top',
  },
};

export const help: HelpEntry = {
  title: 'Accès d\'un utilisateur',
  summary: 'Pour un compte, l\'arbre de toutes les communautés et de leurs espaces, avec l\'accès qu\'il a — et celui qu\'il pourrait avoir.',
  ...helpFromElements(elements),
  tour: [
    {
      popover: {
        title: 'Accès d\'un utilisateur',
        description: 'Tout ce que ce compte peut voir ou modifier, sur l\'ensemble de SPOK.',
      },
    },
    ...elementTourSteps('admin-user-access', elements),
  ],
};

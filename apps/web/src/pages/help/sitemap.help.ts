/* Aide utilisateur du plan du site (/sitemap).
   Lue par le point d'interrogation de la page (PageHelpButton) et son tour — registre help/pageHelp.ts.
   `empty` : message affiché par SitemapPage quand aucune communauté n'est publique. */
import type { HelpEntry } from '../../help/types';

export const help: HelpEntry = {
  title: 'Plan du site',
  summary: 'Le contenu public de SPOK (communautés et espaces) et la liste des pages et des vues auxquelles vous avez accès.',
  tips: [
    'Cliquez sur une communauté ou un espace pour l\'ouvrir',
    'Seul le contenu public figure ici : vos espaces privés restent dans la barre latérale',
    'Les pages et les vues listées dépendent de votre accès : un visiteur en voit moins qu\'un utilisateur connecté',
  ],
  empty: 'Aucune communauté publique pour le moment.',
  tour: [
    {
      element: '[data-tour="sitemap-public"]',
      popover: {
        title: 'Contenu public',
        description: 'Les communautés ouvertes ou en lecture seule, avec leurs espaces publics. Cette liste est la même pour tous.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="sitemap-pages"]',
      popover: {
        title: 'Pages et vues',
        description: 'Toutes les pages de l\'application et les vues d\'un espace, selon votre accès. Cliquez sur une page pour y aller.',
        side: 'top',
      },
    },
  ],
};

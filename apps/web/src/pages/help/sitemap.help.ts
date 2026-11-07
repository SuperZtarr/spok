/* Aide utilisateur du plan du site (/sitemap), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris par le « ? »
   (PageHelpButton), le tour et le mode Aide — registre help/pageHelp.ts. `empty` : message affiché par SitemapPage quand aucune communauté
   n'est publique. */
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

const elements: HelpElements = {
  public: {
    title: 'Contenu public',
    short: 'Les communautés et espaces publics.',
    text: 'Les communautés ouvertes ou en lecture seule, avec leurs espaces publics : cliquez pour en ouvrir un. Cette liste est la même pour tous ; vos espaces privés restent dans la barre latérale.',
    target: '[data-tour="sitemap-public"]',
    side: 'bottom',
  },
  pages: {
    title: 'Pages et vues',
    short: 'Les pages et vues selon votre accès.',
    text: 'Toutes les pages de l\'application et les vues d\'un espace, selon votre accès : un visiteur en voit moins qu\'un utilisateur connecté. Cliquez sur une page pour y aller.',
    target: '[data-tour="sitemap-pages"]',
    side: 'top',
  },
};

export const help: HelpEntry = {
  title: 'Plan du site',
  summary: 'Le contenu public de SPOK (communautés et espaces) et la liste des pages et des vues auxquelles vous avez accès.',
  ...helpFromElements(elements),
  empty: 'Aucune communauté publique pour le moment.',
  tour: elementTourSteps('sitemap', elements),
};

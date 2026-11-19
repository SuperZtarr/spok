/* Aide utilisateur du plan du site (/sitemap), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris par le « ? »
   (PageHelpButton), le tour et le mode Aide — registre help/pageHelp.ts. `empty` : message affiché par SitemapPage quand aucune communauté
   n'est publique. Ordre des éléments = ordre des colonnes de la page (2026-11-19) : pages et vues à gauche, contenu public à droite. */
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

const elements: HelpElements = {
  pages: {
    title: 'Pages et vues',
    short: 'Les pages et vues selon votre accès.',
    text: 'Première colonne : toutes les pages de l\'application et les vues d\'un espace, selon votre accès — un visiteur en voit moins qu\'un utilisateur connecté. Cliquez sur une page pour y aller.',
    target: '[data-tour="sitemap-pages"]',
    side: 'bottom',
  },
  public: {
    title: 'Contenu public',
    short: 'Les communautés et espaces publics.',
    text: 'Seconde colonne : les communautés ouvertes ou en lecture seule, avec leurs espaces publics — cliquez pour en ouvrir un. Cette liste est la même pour tous ; vos espaces privés restent dans la barre latérale.',
    target: '[data-tour="sitemap-public"]',
    side: 'bottom',
  },
};

export const help: HelpEntry = {
  title: 'Plan du site',
  summary: 'Sur deux colonnes : les pages et les vues auxquelles vous avez accès, puis le contenu public de SPOK (communautés et espaces).',
  ...helpFromElements(elements),
  empty: 'Aucune communauté publique pour le moment.',
  tour: elementTourSteps('sitemap', elements),
};

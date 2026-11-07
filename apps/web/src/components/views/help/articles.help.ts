/* Aide utilisateur de la vue « Articles » (articles), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris
   par le « ? » (ViewHelpButton), le tour (useViewOnboarding), le mode Aide et l'état vide (EmptyHelp). */
import type { HelpEntry } from '../../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../../help/elements';
import { ITEM_MENU_STEP, SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

const elements: HelpElements = {
  liste: {
    title: 'Les articles',
    short: 'Tous les articles de l\'espace.',
    text: 'Tous les articles de l\'espace, puis ceux des espaces enfants liés. Le filtre de la barre s\'applique aussi ici.',
    side: 'top',
  },
  carte: {
    title: 'Un article',
    short: 'Cliquez pour le lire en pleine page.',
    text: 'Son titre et son chapeau viennent de sa fiche. Cliquez pour le lire en pleine page ; « Retour à l\'espace » ramène à cette vue. Le menu ⋮ apparaît au survol : « Afficher » lit l\'article dans sa fiche, « Ouvrir » donne accès à Modifier et Composer, où l\'on ajoute ou réordonne ses blocs.',
    target: '[data-tour="articles-card"]',
    side: 'bottom',
  },
};

export const help: HelpEntry = {
  title: 'Articles',
  summary: 'Les articles de l\'espace, à portée de clic : chacun s\'ouvre sur sa page de lecture. Le même clic fonctionne dans les autres vues de l\'espace.',
  short: 'Les articles à lire',
  empty: 'Aucun article. Créez un élément de type Article, puis composez-le depuis sa fiche.',
  ...helpFromElements(elements),
  tour: [
    {
      popover: {
        title: 'Vue Articles',
        description: 'Les articles de l\'espace, regroupés pour les retrouver et les lire facilement.',
      },
    },
    ...elementTourSteps('articles', elements),
    ...ITEM_MENU_STEP,
    ...SPACE_TOOLBAR_STEPS,
  ],
};

/* Aide utilisateur de la vue « Articles » (articles) : à quoi elle sert, comment s'en servir, tour guidé (modèle 2026-10-14).
   Lue par le point d'interrogation (ViewHelpButton → HelpButton), le tour (useViewOnboarding) et l'état vide (EmptyHelp). */
import type { HelpEntry } from '../../../help/types';
import { ITEM_MENU_STEP, SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

export const help: HelpEntry = {
  title: 'Articles',
  summary: 'Les articles de l\'espace, à portée de clic : chacun s\'ouvre sur sa page de lecture.',
  short: 'Les articles à lire',
  empty: 'Aucun article. Créez un élément de type Article, puis composez-le depuis sa fiche.',
  tips: [
    'Cliquez sur un article pour le lire en pleine page ; « Retour à l\'espace » ramène à cette vue. Le même clic fonctionne dans les autres vues de l\'espace',
    'Le menu ⋮ apparaît au survol : « Afficher » lit l\'article dans sa fiche, « Ouvrir » donne accès à Modifier et Composer',
    'Pour ajouter ou réordonner ses blocs : mode « Composer » de la fiche',
  ],
  zones: {
    liste: { title: 'Les articles', text: 'Tous les articles de l\'espace, puis ceux des espaces enfants liés. Le filtre de la barre s\'applique aussi ici.' },
    carte: { title: 'Un article', text: 'Son titre et son chapeau ; cliquez pour l\'ouvrir sur sa page de lecture.' },
  },
  tour: [
    {
      popover: {
        title: 'Vue Articles',
        description: 'Les articles de l\'espace, regroupés pour les retrouver et les lire facilement.',
      },
    },
    {
      element: '[data-tour="articles-card"]',
      popover: {
        title: 'Un article',
        description: 'Cliquez pour le lire en pleine page. Le titre et le chapeau viennent de sa fiche.',
        side: 'bottom',
      },
    },
    ...ITEM_MENU_STEP,
    ...SPACE_TOOLBAR_STEPS,
  ],
};

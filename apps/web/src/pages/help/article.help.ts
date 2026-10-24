/* Aide utilisateur de la page « Article » (/spaces/:spaceId/articles/:itemId) : lecture et mode Composer.
   Lue par le point d'interrogation (PageHelpButton), son tour et les rappels (pageHint) — registre help/pageHelp.ts.
   Rappels écrits d'après apps/api/src/routes/item-article.ts : à revoir si la route change. */
import type { HelpEntry } from '../../help/types';

export const help: HelpEntry = {
  title: 'Article',
  summary: 'Une page qui assemble, dans l\'ordre choisi, des éléments existants : notes, images, schémas, liens. Ils restent à leur place et peuvent servir dans plusieurs articles.',
  tips: [
    '« Composer » (si vous pouvez modifier l\'article) : ajouter, réordonner, régler ou retirer des blocs',
    'Un bloc affiche un élément existant : le corriger le corrige partout où il apparaît',
    'Le texte d\'une note se modifie directement dans l\'article ; les autres blocs s\'ouvrent dans leur fiche',
    'Chaque bloc montre ce qui compte pour son type : le titre et le texte ; la légende sous une image ; l\'icône du site pour un lien ; la date d\'une réunion ; statut, échéance et priorité d\'une tâche ; les dates d\'un projet. Tags, assignation et contributions n\'y figurent pas',
    'Les lecteurs voient le contenu des blocs, sans accès aux éléments d\'origine',
    '« Imprimer » produit une version papier ou PDF propre',
  ],
  tour: [
    {
      popover: {
        title: 'Article',
        description: 'Des éléments existants mis bout à bout, dans une page de lecture continue.',
      },
    },
    {
      element: '[data-tour="article-header"]',
      popover: {
        title: 'Titre et chapeau',
        description: 'Le titre et la description de l\'article. Ils se modifient dans sa fiche.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="article-block"]',
      popover: {
        title: 'Un bloc',
        description: 'Un élément existant affiché dans l\'article. S\'il est barré « contenu indisponible », la personne qui l\'a ajouté n\'y a plus accès.',
        side: 'top',
      },
    },
    {
      element: '[data-tour="article-compose"]',
      popover: {
        title: 'Composer',
        description: 'Passe en mode édition : ajouter des éléments ou du texte, glisser pour réordonner, régler la largeur et la position.',
        side: 'bottom',
      },
    },
  ],
  hints: {
    unavailable: 'Contenu indisponible : la personne qui a ajouté ce bloc n\'a plus accès à l\'élément d\'origine.',
    empty: 'Cet article est vide. Passez en mode « Composer » pour y ajouter des éléments ou du texte.',
    print: 'Ouvre l\'impression du navigateur (papier ou PDF), sans le cadre de l\'application.',
    compose: 'Passe en mode édition de l\'article.',
    read: 'Revient à la lecture de l\'article.',
    openSource: 'Ouvre la fiche de l\'élément d\'origine.',
    addItem: 'Ajoute un élément existant (que vous pouvez lire) à cet endroit. L\'élément reste à sa place ; il peut figurer dans d\'autres articles.',
    addText: 'Crée une nouvelle note dans l\'espace de l\'article et l\'insère à cet endroit.',
    remove: 'Retire ce bloc de l\'article. L\'élément d\'origine n\'est pas supprimé.',
    width: 'Largeur du bloc : pleine, large ou moyenne (sur mobile, tout est en pleine largeur).',
    align: 'Position de l\'image ou du schéma : centrée, ou à gauche / à droite avec le texte suivant autour.',
    lessVisible: 'Cet élément est moins visible que l\'article (espace privé ou autre communauté) : tous les lecteurs de l\'article verront son contenu. Ils n\'auront pas accès à l\'élément lui-même.',
    duplicate: 'Cet élément figure déjà dans l\'article.',
    pickerEmpty: 'Aucun élément trouvé. Seuls les éléments que vous pouvez lire sont proposés, hors articles et éléments déjà présents.',
    noteReadOnly: 'Vous ne pouvez pas modifier cette note : ouvrez sa fiche pour la lire.',
  },
};

/* Aide utilisateur de la vue « Tags » (tags, TagsView), écrite en éléments d'aide (help/elements.ts) : un texte par
   fonction, repris par le « ? » (ViewHelpButton), le tour (useViewOnboarding) et le mode Aide (zones tags:*).
   hints : rappels fonctionnels lus par HelpHint dans TagsView (glisser, retirer, colonnes) — ce qu'ils disent doit
   rester vrai de useSpaceActions.handleSetTags (liste complète des tags enregistrée aussitôt, sans « Enregistrer »).
   Annonces `tags-view` et `bugs-view-removed` (vue Bugs retirée, menu « Types » → « Contenus ») sans date, datées
   par la session MEP. */
import type { HelpEntry } from '../../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../../help/elements';
import { ITEM_MENU_STEP, SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

const elements: HelpElements = {
  contenu: {
    title: 'Tags',
    short: 'Classer les éléments par tag, sans ouvrir leur fiche.',
    text: 'Une colonne par tag porté par un élément de l\'espace, et « Sans tag » pour ce qui n\'est pas encore classé. Un élément qui porte plusieurs tags apparaît dans chacune de leurs colonnes. Les filtres de la barre (types, statuts, tags, texte) s\'appliquent.',
    side: 'top',
    changes: [
      { id: 'tags-view', kind: 'new', text: 'Nouvelle vue Tags : classez vos éléments en les glissant d\'une colonne de tag à l\'autre, et voyez d\'un coup d\'œil ce qui n\'est pas encore classé.', date: '2026-11-11' },
      { id: 'bugs-view-removed', kind: 'evolution', text: 'La vue Bugs disparaît : retrouvez vos anomalies dans la colonne « bug » de la vue Tags, ou cochez le tag « bug » dans le filtre de la barre. Le menu « Types » des autres vues s\'appelle désormais « Contenus ».', date: '2026-11-11' },
    ],
  },
  'sans-tag': {
    title: 'Sans tag',
    short: 'Les éléments qui ne portent aucun tag.',
    text: 'Les éléments qui ne portent aucun tag : glissez-en un sur une colonne de tag pour le classer. Déposer ici une carte venue d\'une colonne de tag lui retire ce tag.',
    target: '[data-tour="tags-sans-tag"]',
    side: 'right',
  },
  colonne: {
    title: 'Colonne de tag',
    short: 'Les éléments qui portent ce tag.',
    text: 'Les éléments qui portent ce tag (couleur du tag en haut). Déposer une carte ici ajoute ce tag à l\'élément ; il garde ses autres tags et reste dans ses autres colonnes.',
    target: '[data-tour="tags-colonne"]',
    side: 'right',
  },
  carte: {
    title: 'Une carte',
    short: 'Cliquez pour ouvrir sa fiche ; glissez la poignée pour classer.',
    text: 'Cliquez pour ouvrir la fiche. Glissez la poignée ⋮⋮ vers une autre colonne pour ajouter ce tag. Au survol, × retire le tag de la colonne où se trouve la carte. Pour changer un élément de tag : glissez-le sur le nouveau, puis retirez l\'ancien.',
    target: '[data-tour="tags-carte"]',
    side: 'right',
  },
  ajouter: {
    title: '+ Colonne',
    short: 'Affiche un tag qui n\'est encore porté par aucun élément.',
    text: 'Ajoute la colonne d\'un tag proposé dans l\'espace (tags de la communauté et tags globaux) qu\'aucun élément affiché ne porte encore, pour y déposer des cartes. La colonne disparaît en quittant la vue tant qu\'elle reste vide.',
    target: '[data-tour="tags-ajouter"]',
    side: 'bottom',
  },
};

const derived = helpFromElements(elements);

export const help: HelpEntry = {
  title: 'Tags',
  summary: 'Les éléments de l\'espace rangés par tag, à classer par glisser-déposer.',
  short: 'Classer par tag',
  empty: 'Aucun élément à afficher. Créez un élément, ou retirez les filtres de la barre.',
  ...derived,
  hints: {
    ...derived.hints,
    drag: 'Glisser vers une colonne de tag : ajoute ce tag à l\'élément (enregistré aussitôt). Vers « Sans tag » : retire le tag de la colonne d\'origine.',
    remove: 'Retirer ce tag de l\'élément : enregistré aussitôt ; l\'élément garde ses autres tags. Le tag lui-même n\'est pas supprimé.',
    column: 'Les éléments qui portent ce tag. Déposer une carte ici lui ajoute ce tag.',
    noTagColumn: 'Les éléments sans tag. Déposer ici une carte d\'une colonne de tag lui retire ce tag.',
    addColumn: 'Afficher la colonne d\'un tag pas encore utilisé dans cette vue, pour y déposer des cartes.',
  },
  tour: [
    ...elementTourSteps('tags', elements),
    ...ITEM_MENU_STEP,
    ...SPACE_TOOLBAR_STEPS,
  ],
};

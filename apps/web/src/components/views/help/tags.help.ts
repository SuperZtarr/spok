/* Aide utilisateur de la vue « Tags » (tags, TagsView), écrite en éléments d'aide (help/elements.ts) : un texte par
   fonction, repris par le « ? » (ViewHelpButton), le tour (useViewOnboarding) et le mode Aide (zones tags:*).
   hints : rappels fonctionnels lus par HelpHint dans TagsView (palette, glisser, cases, barre de sélection, ×) — ce
   qu'ils disent doit rester vrai de useSpaceActions.handleSetTags / handleBulkTags (enregistré aussitôt, sans
   « Enregistrer » ; plusieurs éléments en une requête POST bulk-tags).
   Annonces `tags-view` et `bugs-view-removed` datées (MEP du 2026-11-11) ; `tags-view-palette` (refonte : colonnes de
   tous les tags, palette, sélection multiple) sans date, datée par la session MEP. */
import type { HelpEntry } from '../../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../../help/elements';
import { ITEM_MENU_STEP, SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

const elements: HelpElements = {
  contenu: {
    title: 'Tags',
    short: 'Classer les éléments par tag, sans ouvrir leur fiche.',
    text: 'Une colonne par tag disponible dans l\'espace (tags de la communauté et tags globaux), et « Sans tag » pour ce qui n\'est pas encore classé. Un élément qui porte plusieurs tags apparaît dans chacune de leurs colonnes. Les filtres de la barre (types, statuts, tags, texte) s\'appliquent.',
    side: 'top',
    changes: [
      { id: 'tags-view', kind: 'new', text: 'Nouvelle vue Tags : classez vos éléments en les glissant d\'une colonne de tag à l\'autre, et voyez d\'un coup d\'œil ce qui n\'est pas encore classé.', date: '2026-11-11' },
      { id: 'bugs-view-removed', kind: 'evolution', text: 'La vue Bugs disparaît : retrouvez vos anomalies dans la colonne « bug » de la vue Tags, ou cochez le tag « bug » dans le filtre de la barre. Le menu « Types » des autres vues s\'appelle désormais « Contenus ».', date: '2026-11-11' },
      { id: 'tags-view-palette', kind: 'evolution', text: 'Vue Tags : tous les tags disponibles ont leur colonne, une palette permet de glisser un tag sur un élément, et vous pouvez cocher plusieurs éléments pour leur ajouter ou retirer un tag d\'un coup.', date: '2026-11-11' },
    ],
  },
  palette: {
    title: 'Palette de tags',
    short: 'Glissez un tag sur un élément pour le lui ajouter.',
    text: 'Tous les tags disponibles : les tags globaux sur la première ligne, ceux de la communauté dessous. Glissez une pastille sur une carte pour ajouter ce tag à l\'élément — à tous les éléments cochés si la carte fait partie de la sélection.',
    target: '[data-tour="tags-palette"]',
    side: 'bottom',
  },
  selection: {
    title: 'Sélection',
    short: 'Taguer plusieurs éléments à la fois.',
    text: 'Cochez des cartes (ou « Tout cocher » en tête d\'une colonne) : la barre de sélection propose « Ajouter un tag » et « Retirer un tag » pour tous les éléments cochés, en une fois. Glisser une pastille ou une carte cochée agit aussi sur toute la sélection.',
    target: '[data-tour="tags-selection"]',
    side: 'bottom',
  },
  'sans-tag': {
    title: 'Sans tag',
    short: 'Les éléments qui ne portent aucun tag.',
    text: 'Les éléments qui ne portent aucun tag : glissez-en un sur une colonne de tag, ou une pastille sur lui, pour le classer. Déposer ici une carte venue d\'une colonne de tag lui retire ce tag.',
    target: '[data-tour="tags-sans-tag"]',
    side: 'right',
  },
  colonne: {
    title: 'Colonne de tag',
    short: 'Les éléments qui portent ce tag.',
    text: 'Les éléments qui portent ce tag (couleur du tag en haut), même vide. Déposer une carte ici ajoute ce tag à l\'élément ; il garde ses autres tags et reste dans ses autres colonnes.',
    target: '[data-tour="tags-colonne"]',
    side: 'right',
  },
  carte: {
    title: 'Une carte',
    short: 'Cliquez pour ouvrir sa fiche ; cochez-la pour la sélectionner.',
    text: 'Cliquez pour ouvrir la fiche. La case la coche ; la poignée ⋮⋮ la glisse vers une colonne pour ajouter ce tag. Au survol, × retire le tag de la colonne où se trouve la carte. Pour changer un élément de tag : glissez-le sur le nouveau, puis retirez l\'ancien.',
    target: '[data-tour="tags-carte"]',
    side: 'right',
  },
  masquer: {
    title: 'Masquer les tags vides',
    short: 'Ne montrer que les colonnes qui ont des éléments.',
    text: 'Retire de l\'affichage les colonnes des tags qu\'aucun élément affiché ne porte, pour les espaces qui ont beaucoup de tags. Rien n\'est supprimé ; le choix n\'est pas mémorisé.',
    target: '[data-tour="tags-masquer"]',
    noZone: true,
    side: 'bottom',
  },
};

const derived = helpFromElements(elements);

export const help: HelpEntry = {
  title: 'Tags',
  summary: 'Les éléments de l\'espace rangés par tag, à classer par glisser-déposer, seul ou à plusieurs.',
  short: 'Classer par tag',
  empty: 'Aucun élément à afficher. Créez un élément, ou retirez les filtres de la barre.',
  ...derived,
  hints: {
    ...derived.hints,
    drag: 'Glisser vers une colonne de tag : ajoute ce tag (à toute la sélection si la carte est cochée), enregistré aussitôt. Vers « Sans tag » : retire le tag de la colonne d\'origine.',
    remove: 'Retirer ce tag de l\'élément : enregistré aussitôt ; l\'élément garde ses autres tags. Le tag lui-même n\'est pas supprimé.',
    select: 'Cocher cet élément : la barre de sélection agit alors sur tous les éléments cochés.',
    selectColumn: 'Cocher (ou décocher) tous les éléments de cette colonne.',
    column: 'Les éléments qui portent ce tag. Déposer une carte ici lui ajoute ce tag.',
    noTagColumn: 'Les éléments sans tag. Déposer ici une carte d\'une colonne de tag lui retire ce tag.',
    hideEmpty: 'Masquer les colonnes des tags qu\'aucun élément affiché ne porte (rien n\'est supprimé).',
    bulkAdd: 'Ajouter ce tag à tous les éléments cochés, en une fois ; ceux qui l\'ont déjà ne changent pas. Enregistré aussitôt.',
    bulkRemove: 'Retirer ce tag de tous les éléments cochés qui le portent, en une fois. Le tag lui-même n\'est pas supprimé.',
    clearSelection: 'Décocher tous les éléments (rien n\'est modifié).',
  },
  tour: [
    ...elementTourSteps('tags', elements),
    ...ITEM_MENU_STEP,
    ...SPACE_TOOLBAR_STEPS,
  ],
};

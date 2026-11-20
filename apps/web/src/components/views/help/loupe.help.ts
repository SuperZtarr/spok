/* Aide utilisateur de la vue Loupe, écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris par le « ? »
   (ViewHelpButton), le tour (useViewOnboarding), le mode Aide et HelpHint. Les clés lues par LoupeView (fit, trailEmpty,
   openLink, release, reset) ne doivent pas changer. */
import type { HelpEntry } from '../../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../../help/elements';
import { ITEM_MENU_STEP, SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

const elements: HelpElements = {
  carte: {
    title: 'La carte',
    short: 'Les éléments de l\'espace, selon leur hiérarchie.',
    text: 'Les éléments de l\'espace, disposés selon leur hiérarchie : les traits pleins relient parents et enfants, les pointillés sont les relations ; un trait est plus épais et plus foncé quand il touche un élément très relié. À l\'ouverture, toute la carte tient à l\'écran, et elle se recadre si la fenêtre change de taille, tant que vous ne l\'avez ni déplacée ni zoomée. Toutes les vignettes s\'ajustent ensemble à la taille de la fenêtre, en gardant leurs écarts de taille ; un élément qui deviendrait trop petit pour être lu devient une pastille qui ne montre que l\'icône de son type (son titre s\'affiche au survol) — toujours les moins importants de l\'espace d\'abord. La molette zoome, le glisser déplace ; un clic sur le fond ou sur Départ revient au départ et efface le chemin. Les éléments d\'autres espaces n\'apparaissent qu\'en suivant un lien, si vous avez le droit de les lire : ils portent le nom de leur espace, leur menu se limite à l\'ouverture et leur fiche s\'ouvre dans un nouvel onglet.',
    target: '[data-tour="loupe-map"]',
    side: 'top',
    changes: [
      { id: 'loupe-weight-visible', kind: 'evolution', text: 'Les éléments importants se repèrent d\'un coup d\'œil : la taille des vignettes suit l\'importance de chaque élément dans son espace et s\'ajuste à votre écran ; les moins importants deviennent des pastilles quand la place manque ; les traits sont plus épais autour des éléments les plus reliés.', date: '2026-11-20' },
      { id: 'loupe-fit-whole-map', kind: 'evolution', text: 'La carte tient maintenant entière à l\'écran, centrée, et se recadre quand la fenêtre change de taille ; les titres des grandes vignettes passent à la ligne.', date: '2026-11-20' },
    ],
  },
  vignette: {
    title: 'Un élément',
    short: 'Survolez pour l\'agrandir, cliquez pour figer, recliquez pour ouvrir la fiche.',
    text: 'Le survol l\'agrandit, avec ses éléments liés à mi-taille. Un clic fige le zoom ; un nouveau clic sur l\'élément figé ouvre sa fiche ; un clic sur un élément lié avance d\'un pas. « Libérer le zoom » ou Échap rendent le survol sans perdre le chemin ; un clic sur le fond revient au départ. Zoom figé, le survol d\'un autre élément l\'agrandit seulement le temps de le lire. Plus une vignette est grande, plus elle en dit, comme dans les autres vues : au repos, une ligne (miniature, titre, l\'essentiel, pastilles des contenus) ; à mi-taille, une carte (tout ce qui est renseigné : statut, dates, échéance, assigné ; début de la description, tags) ; agrandie, en plus le type, la durée, le nombre d\'enfants et de relations, avec un bouton « Ouvrir » pour le premier fichier ou lien et le menu ⋮. Au repos, la taille d\'une vignette dit l\'importance de l\'élément dans son espace (contenus, enfants, relations, priorité, éléments assemblés pour un article) : le plus riche de l\'espace est trois fois plus grand que le moins riche, les autres entre les deux ; assez grande, sa vignette montre déjà son contenu (statut, dates, extrait, pastilles) ; agrandi, il reprend la taille commune.',
    target: '[data-tour="loupe-node"]',
    side: 'right',
    changes: [
      { id: 'loupe-vignette-scale-priority', kind: 'evolution', text: 'La priorité d\'un élément et le nombre d\'éléments d\'un article font aussi grandir sa vignette au repos.', date: '2026-11-20' },
      { id: 'loupe-vignette-scale', kind: 'evolution', text: 'Au repos, les vignettes grandissent avec la richesse de l\'élément : contenus, enfants et relations, jusqu\'à trois fois leur taille.', date: '2026-11-20' },
      { id: 'loupe-vignette-all-info', kind: 'evolution', text: 'Les vignettes ouvertes montrent maintenant tout ce qui est renseigné, quel que soit le type : statut, dates, échéance, assigné, et en grand le type, la durée, les enfants et les relations.', date: '2026-11-20' },
      { id: 'loupe-click-pinned-opens', kind: 'evolution', text: 'Un clic sur l\'élément figé ouvre désormais sa fiche (le double-clic n\'est plus utilisé). Pour le libérer : « Libérer le zoom », Échap, ou un clic sur le fond qui revient au départ.', date: '2026-11-20' },
    ],
  },
  chemin: {
    title: 'Le chemin',
    short: 'Les éléments parcourus depuis le départ.',
    text: 'Les éléments parcourus depuis le départ, avec le nom de leur espace quand ce n\'est pas l\'espace courant. Un clic sur une étape y revient et efface les suivantes.',
    target: '[data-tour="loupe-trail"]',
    side: 'bottom',
  },
  fit: {
    title: 'Ajuster',
    short: 'Recadre la carte pour que tous les éléments affichés tiennent à l\'écran. Aucune donnée n\'est modifiée.',
    text: 'Recadre la carte pour que tous les éléments affichés tiennent à l\'écran, et rétablit le recadrage automatique quand la fenêtre change de taille.',
    target: '[data-tour="loupe-fit"]',
    noZone: true,
    side: 'bottom',
  },
};

const derived = helpFromElements(elements);

export const help: HelpEntry = {
  title: 'Loupe',
  summary: 'Explorez les éléments à travers leurs liens : parent, enfants et relations, de proche en proche, jusque dans d\'autres espaces.',
  short: 'Exploration de lien en lien',
  empty: 'Cet espace ne contient encore aucun élément à explorer. Créez des éléments, puis reliez-les pour suivre leurs liens.',
  ...derived,
  hints: {
    ...derived.hints,
    trailEmpty: 'Survolez un élément pour le zoomer, cliquez pour figer le zoom et suivre ses liens.',
    openLink: 'Ouvre le lien ou le fichier dans un nouvel onglet, sans quitter la carte. Aucune donnée n\'est modifiée.',
    release: 'Libère le zoom figé : le survol fonctionne de nouveau, le chemin est conservé (aussi : touche Échap ; un clic sur l\'élément figé ouvre sa fiche). Aucune donnée n\'est modifiée.',
    reset: 'Revient au départ : efface le chemin et retire de la carte les éléments des autres espaces. Aucune donnée n\'est modifiée.',
  },
  tour: [
    {
      popover: {
        title: 'Vue Loupe',
        description: 'Pour explorer de lien en lien : chaque élément montre son parent, ses enfants et ses relations, même dans un autre espace.',
      },
    },
    ...elementTourSteps('loupe', elements),
    ...ITEM_MENU_STEP,
    ...SPACE_TOOLBAR_STEPS,
  ],
};

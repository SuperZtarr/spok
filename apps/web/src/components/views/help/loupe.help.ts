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
    text: 'Les éléments de l\'espace, disposés selon leur hiérarchie : les traits pleins relient parents et enfants, les pointillés sont les relations. La molette zoome, le glisser déplace ; un clic sur le fond ou sur Départ revient au départ et efface le chemin. Les éléments d\'autres espaces n\'apparaissent qu\'en suivant un lien, si vous avez le droit de les lire : ils portent le nom de leur espace, leur menu se limite à l\'ouverture et leur fiche s\'ouvre dans un nouvel onglet.',
    target: '[data-tour="loupe-map"]',
    side: 'top',
  },
  vignette: {
    title: 'Un élément',
    short: 'Survolez pour l\'agrandir, cliquez pour figer.',
    text: 'Le survol l\'agrandit, avec ses éléments liés à mi-taille. Un clic fige le zoom ; un clic sur un élément lié avance d\'un pas ; un nouveau clic sur l\'élément figé, « Libérer le zoom » ou Échap rendent le survol sans perdre le chemin ; un double-clic ouvre la fiche. Zoom figé, le survol d\'un autre élément l\'agrandit seulement le temps de le lire. Plus une vignette est grande, plus elle en dit, selon le type de l\'élément (échéance d\'une tâche, site d\'un lien, miniature d\'une image…) ; agrandi, un lien ou un document porte un bouton « Ouvrir », et le menu ⋮ se trouve sur l\'élément.',
    target: '[data-tour="loupe-node"]',
    side: 'right',
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
    text: 'Recadre la carte pour que tous les éléments affichés tiennent à l\'écran.',
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
    release: 'Libère le zoom figé : le survol fonctionne de nouveau, le chemin est conservé (aussi : clic sur l\'élément figé, touche Échap). Aucune donnée n\'est modifiée.',
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

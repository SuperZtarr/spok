/* Aide utilisateur de la vue Loupe : à quoi elle sert, ses gestes, tour guidé, zones du mode Aide et infobulles.
   Lue par le point d'interrogation (ViewHelpButton), le tour (useViewOnboarding), HelpHint et EmptyHelp. */
import type { HelpEntry } from '../../../help/types';
import { ITEM_MENU_STEP, SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

export const help: HelpEntry = {
  title: 'Loupe',
  summary: 'Explorez les éléments à travers leurs liens : parent, enfants et relations, de proche en proche, jusque dans d\'autres espaces.',
  short: 'Exploration de lien en lien',
  empty: 'Cet espace ne contient encore aucun élément à explorer. Créez des éléments, puis reliez-les pour suivre leurs liens.',
  tips: [
    'Marquez un court arrêt sur un élément : il s\'agrandit, ses éléments liés aussi, à moitié',
    'Cliquez pour figer le zoom et aller chercher un élément lié sans le perdre',
    'Cliquez sur un élément lié pour avancer d\'un pas, le chemin parcouru s\'affiche au-dessus de la carte',
    'Zoom figé, survolez un autre élément pour le lire : il s\'agrandit le temps du survol, sans rien changer d\'autre',
    'Pour reprendre le survol sans perdre le chemin : cliquez sur l\'élément figé, sur « Libérer le zoom », ou appuyez sur Échap',
    'Cliquez sur le fond de la carte ou sur Départ pour revenir au départ, le chemin est alors effacé',
    'Plus une vignette est grande, plus elle en dit : son contenu dépend du type de l\'élément (échéance d\'une tâche, site d\'un lien, miniature d\'une image…)',
    'Un lien ou un document agrandi porte un bouton « Ouvrir », qui ouvre un nouvel onglet',
    'Double-cliquez pour ouvrir la fiche ; le menu ⋮ se trouve sur l\'élément agrandi',
    'La molette zoome la carte et le glisser la déplace',
    'Un élément d\'un autre espace porte le nom de son espace : son menu se limite à l\'ouverture, et sa fiche s\'ouvre dans un nouvel onglet',
  ],
  hints: {
    trailEmpty: 'Survolez un élément pour le zoomer, cliquez pour figer le zoom et suivre ses liens.',
    openLink: 'Ouvre le lien ou le fichier dans un nouvel onglet, sans quitter la carte. Aucune donnée n\'est modifiée.',
    release: 'Libère le zoom figé : le survol fonctionne de nouveau, le chemin est conservé (aussi : clic sur l\'élément figé, touche Échap). Aucune donnée n\'est modifiée.',
    reset: 'Revient au départ : efface le chemin et retire de la carte les éléments des autres espaces. Aucune donnée n\'est modifiée.',
    fit: 'Recadre la carte pour que tous les éléments affichés tiennent à l\'écran. Aucune donnée n\'est modifiée.',
  },
  zones: {
    carte: { title: 'La carte', text: 'Les éléments de l\'espace, disposés selon leur hiérarchie. Les traits pleins relient parents et enfants, les pointillés sont les relations. Les éléments d\'autres espaces n\'apparaissent qu\'en suivant un lien, si vous avez le droit de les lire.' },
    chemin: { title: 'Le chemin', text: 'Les éléments parcourus depuis le départ. Un clic sur une étape y revient et efface les suivantes.' },
    vignette: { title: 'Un élément', text: 'Un court arrêt l\'agrandit avec ses éléments liés. Un clic fige le zoom, un nouveau clic le libère, un double-clic ouvre sa fiche. Zoom figé, le survol d\'un autre élément l\'agrandit seulement le temps de le lire.' },
  },
  tour: [
    {
      popover: {
        title: 'Vue Loupe',
        description: 'Pour explorer de lien en lien : chaque élément montre son parent, ses enfants et ses relations, même dans un autre espace.',
      },
    },
    {
      element: '[data-tour="loupe-map"]',
      popover: {
        title: 'La carte',
        description: 'Tous les éléments de l\'espace. La molette zoome, le glisser déplace, un clic sur le fond revient au départ.',
        side: 'top',
      },
    },
    {
      element: '[data-tour="loupe-node"]',
      popover: {
        title: 'Un élément',
        description: 'Un court arrêt l\'agrandit, avec ses éléments liés à mi-taille. Un clic fige le zoom ; un clic sur un élément lié avance d\'un pas ; un nouveau clic sur l\'élément figé rend le survol ; un double-clic ouvre la fiche.',
        side: 'right',
      },
    },
    {
      element: '[data-tour="loupe-trail"]',
      popover: {
        title: 'Le chemin',
        description: 'Les éléments parcourus depuis le départ, avec le nom de leur espace quand ce n\'est pas l\'espace courant. Un clic sur une étape y revient.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="loupe-fit"]',
      popover: {
        title: 'Ajuster',
        description: 'Recadre la carte pour que tous les éléments affichés tiennent à l\'écran.',
        side: 'bottom',
      },
    },
    ...ITEM_MENU_STEP,
    ...SPACE_TOOLBAR_STEPS,
  ],
};

/* Aide utilisateur de la vue « Carte mentale » (mindmap), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris par
   le « ? » (ViewHelpButton), le tour (useViewOnboarding), le mode Aide et les infobulles de l'en-tête (hints, via HelpHint dans
   MindMapView : les clés lues là-bas ne doivent pas changer). Zone fragile : cette fiche ne touche ni aux nœuds ni aux liens.
   noeud (2026-11-15) : dépôt sous un élément d'un autre espace = changement d'espace de la branche (UnderItemMoveModal). */
import type { HelpEntry } from '../../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../../help/elements';
import { SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

const elements: HelpElements = {
  canevas: {
    title: 'Carte',
    short: 'L\'espace au centre, ses éléments en branches.',
    text: 'L\'espace au centre, ses éléments en branches, ses sous-espaces autour avec leurs propres éléments. Glissez le fond pour vous déplacer, molette pour zoomer. La disposition reste en place dans ce navigateur : plier une branche, ajouter ou supprimer un élément ne déplace pas le reste.',
    side: 'top',
  },
  noeud: {
    title: 'Un nœud',
    short: 'Cliquez pour ouvrir sa fiche, glissez pour le déplacer.',
    text: 'Un élément, avec le même aspect que dans les autres vues : miniature (première image ou premier schéma, sinon l\'icône du type), titre, l\'essentiel de son type et des pastilles qui comptent ses autres contenus ; le fond suit son statut, la bordure sa priorité. Cliquez pour ouvrir sa fiche ; double-cliquez sur un projet pour ne voir que lui. Glissez-le pour le déplacer ou déposez-le sur un autre nœud pour le ranger dessous. Si ce nœud appartient à un autre espace, l\'élément y part avec ses sous-éléments et ses tags ; ses relations avec des éléments restés dans l\'espace d\'origine sont supprimées, et une confirmation le signale avant. La flèche le replie ou le déplie.',
    changes: [{ id: 'mindmap-drop-other-space', kind: 'evolution', text: 'Carte mentale : déposer un élément sous un élément d\'un autre espace l\'y déplace avec ses sous-éléments.', date: '2026-11-15' }],
    target: '[data-tour="mindmap-node"]',
    side: 'right',
  },
  tout: {
    title: 'Réduire / Étendre',
    short: 'Replie ou déplie toutes les branches.',
    text: 'Replie toutes les branches pour ne garder que le premier niveau, ou les déplie toutes.',
    target: '[data-tour="collapse-toggle"]',
    noZone: true,
    side: 'bottom',
  },
  reset: {
    title: 'Réorganiser',
    short: 'Réorganiser : replace tous les nœuds automatiquement (oublie les positions données à la main)',
    text: 'Replace tous les nœuds automatiquement, en oubliant les positions que vous avez données à la main.',
    target: '[data-tour="mindmap-reset"]',
    noZone: true,
    side: 'bottom',
  },
  fit: {
    title: 'Tout voir',
    short: 'Tout voir : ajuste le zoom pour faire tenir toute la carte',
    text: 'Ajuste le zoom pour faire tenir toute la carte à l\'écran.',
    target: '[data-tour="mindmap-fit"]',
    noZone: true,
    side: 'bottom',
  },
  relations: {
    title: 'Relations',
    short: 'Affiche ou masque les liens entre éléments.',
    text: 'Affiche ou masque les liens entre éléments (Bloque, Permet, Entraîne, Lié à). Tirez d\'un nœud à un autre pour en créer un.',
    target: '[data-tour="mindmap-relations"]',
    noZone: true,
    side: 'bottom',
  },
  legende: {
    title: 'Légende',
    short: 'Couleurs des statuts et types de liens.',
    text: 'Rappelle la signification des couleurs (statuts) et des types de liens.',
    target: '[data-tour="mindmap-legend"]',
    noZone: true,
    side: 'bottom',
  },
  zoom: {
    title: 'Zoom',
    short: 'Zoomer, dézoomer, recentrer.',
    text: 'Zoomer, dézoomer, recentrer — ou la molette de la souris.',
    // React Flow ne transmet pas data-tour à <Controls> : on vise sa classe
    target: '.react-flow__controls',
    noZone: true,
    side: 'top',
  },
};

const derived = helpFromElements(elements);

export const help: HelpEntry = {
  title: 'Carte mentale',
  summary: 'L\'espace en carte : l\'espace au centre, ses éléments en branches, ses sous-espaces en périphérie.',
  short: 'Carte mentale interactive',
  ...derived,
  hints: {
    ...derived.hints,
    relationsOn: 'Masquer les relations entre éléments',
    relationsOff: 'Afficher les relations entre éléments (Bloque, Permet, Entraîne, Lié à)',
    legendOn: 'Masquer la légende',
    legendOff: 'Afficher la légende : couleurs des statuts et types de liens',
  },
  tour: [
    ...elementTourSteps('mindmap', elements),
    ...SPACE_TOOLBAR_STEPS,
  ],
};

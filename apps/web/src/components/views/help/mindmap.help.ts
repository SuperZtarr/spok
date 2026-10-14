/* Aide utilisateur de la vue « Carte mentale » (mindmap) : à quoi elle sert, comment s'en servir, tour guidé (modèle 2026-10-14).
   Lue par le point d'interrogation (ViewHelpButton → HelpButton), le tour (useViewOnboarding) et les infobulles des
   commandes de l'en-tête (hints, via HelpHint dans MindMapView). */
import type { HelpEntry } from '../../../help/types';
import { SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

export const help: HelpEntry = {
  title: 'Carte mentale',
  summary: 'L\'espace en carte : l\'espace au centre, ses éléments en branches, ses sous-espaces en périphérie.',
  short: 'Carte mentale interactive',
  tips: [
    'Zoomez avec la molette, glissez le fond pour déplacer la vue',
    'Cliquez sur un nœud pour ouvrir sa fiche ; double-cliquez sur un projet pour ne voir que lui',
    'Glissez un nœud pour le repositionner, ou déposez-le sur un autre pour le ranger dessous',
    'Tirez un lien entre deux nœuds pour créer une relation',
  ],
  hints: {
    reset: 'Réorganiser : replace tous les nœuds automatiquement (oublie les positions données à la main)',
    fit: 'Tout voir : ajuste le zoom pour faire tenir toute la carte',
    relationsOn: 'Masquer les relations entre éléments',
    relationsOff: 'Afficher les relations entre éléments (Bloque, Permet, Entraîne, Lié à)',
    legendOn: 'Masquer la légende',
    legendOff: 'Afficher la légende : couleurs des statuts et types de liens',
  },
  zones: {
    canevas: { title: 'Carte', text: 'L\'espace au centre, ses éléments en branches, ses sous-espaces autour. Glissez le fond pour vous déplacer, molette pour zoomer.' },
    noeud: { title: 'Un nœud', text: 'Un élément : cliquez pour ouvrir sa fiche ; glissez-le pour le déplacer ou le ranger sous un autre nœud ; sa flèche replie ses enfants.' },
  },
  tour: [
    {
      popover: {
        title: 'Vue Carte mentale',
        description: 'L\'espace au centre, ses éléments en branches, ses sous-espaces autour avec leurs propres éléments.',
      },
    },
    {
      element: '[data-tour="mindmap-node"]',
      popover: {
        title: 'Un nœud = un élément',
        description: 'Cliquez pour ouvrir sa fiche. Glissez-le pour le déplacer ou déposez-le sur un autre nœud pour le ranger dessous. La flèche le replie ou le déplie.',
        side: 'right',
      },
    },
    {
      element: '[data-tour="collapse-toggle"]',
      popover: {
        title: 'Réduire / Étendre',
        description: 'Replie toutes les branches pour ne garder que le premier niveau, ou les déplie toutes.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="mindmap-reset"]',
      popover: {
        title: 'Réorganiser',
        description: 'Replace tous les nœuds automatiquement, en oubliant les positions que vous avez données à la main.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="mindmap-fit"]',
      popover: {
        title: 'Tout voir',
        description: 'Ajuste le zoom pour faire tenir toute la carte à l\'écran.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="mindmap-relations"]',
      popover: {
        title: 'Relations',
        description: 'Affiche ou masque les liens entre éléments (Bloque, Permet, Entraîne, Lié à). Tirez d\'un nœud à un autre pour en créer un.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="mindmap-legend"]',
      popover: {
        title: 'Légende',
        description: 'Rappelle la signification des couleurs (statuts) et des types de liens.',
        side: 'bottom',
      },
    },
    {
      // React Flow ne transmet pas data-tour à <Controls> : on vise sa classe
      element: '.react-flow__controls',
      popover: {
        title: 'Zoom',
        description: 'Zoomer, dézoomer, recentrer — ou la molette de la souris.',
        side: 'top',
      },
    },
    ...SPACE_TOOLBAR_STEPS,
  ],
};

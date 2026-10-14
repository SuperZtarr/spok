/* Aide utilisateur de la vue « PERT » (pert) : à quoi elle sert, comment s'en servir, tour guidé (modèle 2026-10-14).
   Lue par le point d'interrogation (ViewHelpButton → HelpButton), le tour (useViewOnboarding) et les infobulles des
   commandes de l'en-tête (hints, via HelpHint dans PertToolbar ; {label} = nom du type de relation). */
import type { HelpEntry } from '../../../help/types';
import { SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

export const help: HelpEntry = {
  title: 'PERT',
  summary: 'Le diagramme PERT : les tâches, leurs dépendances et le chemin critique.',
  short: 'Dépendances et chemin critique',
  empty: 'Aucune tâche à ordonner. Créez des tâches, puis reliez-les par « Bloque » pour dessiner leurs dépendances.',
  tips: [
    'Les nœuds sont les tâches, les flèches leurs dépendances',
    'Le chemin critique est mis en évidence',
    'Cliquez sur un nœud pour ouvrir la tâche',
    'Réduire replie les sous-tâches dans leur parent, Étendre les réaffiche',
    'Zoom : moins / plus, ou cliquez sur le pourcentage pour revenir à 100 %',
  ],
  hints: {
    rankSort: 'Par rang : range les tâches en colonnes, chacune ne dépendant que des précédentes',
    relFilterOff: 'N\'afficher que les liens « {label} »',
    relFilterOn: 'Retirer le filtre « {label} »',
    zoomOut: 'Dézoomer',
    zoomReset: 'Revenir à 100 %',
    zoomIn: 'Zoomer',
    legend: 'Légende : signification des couleurs des nœuds et des flèches',
  },
  zones: {
    diagramme: { title: 'Diagramme PERT', text: 'Les tâches rangées par dépendance : chaque flèche dit ce qui doit être fini avant de commencer la suite.' },
    noeud: { title: 'Une tâche', text: 'Sa bordure indique ses relations (rouge : bloque, orange : est bloquée) ; cliquez pour ouvrir sa fiche.' },
  },
  tour: [
    {
      popover: {
        title: 'Vue PERT',
        description: 'L\'enchaînement des tâches : ce qui doit être fini avant de commencer la suite, et le chemin critique.',
      },
    },
    {
      element: '[data-tour="pert-node"]',
      popover: {
        title: 'Un nœud = une tâche',
        description: 'Cliquez pour ouvrir sa fiche. Sa bordure indique ses relations (rouge : bloque, orange : est bloquée).',
        side: 'right',
      },
    },
    {
      element: '[data-tour="pert-rank"]',
      popover: {
        title: 'Par rang',
        description: 'Range les tâches par rang de dépendance : chaque colonne ne dépend que des précédentes.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="pert-relation-filter"]',
      popover: {
        title: 'Types de relations',
        description: 'Filtrez les liens affichés : Bloque, Permet, Entraîne, Lié à.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="collapse-toggle"]',
      popover: {
        title: 'Réduire / Étendre',
        description: 'Replie les sous-tâches dans leur tâche parente pour alléger le diagramme, ou les réaffiche.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="pert-zoom"]',
      popover: {
        title: 'Zoom',
        description: 'Moins / plus ; cliquez sur le pourcentage pour revenir à 100 %.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="pert-legend"]',
      popover: {
        title: 'Légende',
        description: 'Rappelle la signification des couleurs des nœuds et des flèches.',
        side: 'bottom',
      },
    },
    ...SPACE_TOOLBAR_STEPS,
  ],
};

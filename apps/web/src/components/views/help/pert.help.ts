/* Aide utilisateur de la vue « PERT » (pert), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris par le « ? »
   (ViewHelpButton), le tour (useViewOnboarding), le mode Aide et les infobulles de l'en-tête (hints, via HelpHint dans PertToolbar ;
   {label} = nom du type de relation ; les clés lues là-bas ne doivent pas changer). */
import type { HelpEntry } from '../../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../../help/elements';
import { SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';

const elements: HelpElements = {
  diagramme: {
    title: 'Diagramme PERT',
    short: 'L\'enchaînement des tâches.',
    text: 'L\'enchaînement des tâches : chaque flèche dit ce qui doit être fini avant de commencer la suite. Le chemin critique est mis en évidence.',
    side: 'top',
  },
  noeud: {
    title: 'Une tâche',
    short: 'Cliquez pour ouvrir sa fiche.',
    text: 'Cliquez pour ouvrir sa fiche. Sa bordure indique ses relations (rouge : bloque, orange : est bloquée).',
    target: '[data-tour="pert-node"]',
    side: 'right',
  },
  rankSort: {
    title: 'Par rang',
    short: 'Par rang : range les tâches en colonnes, chacune ne dépendant que des précédentes',
    text: 'Range les tâches par rang de dépendance : chaque colonne ne dépend que des précédentes.',
    target: '[data-tour="pert-rank"]',
    noZone: true,
    side: 'bottom',
  },
  relations: {
    title: 'Types de relations',
    short: 'Filtrez les liens affichés.',
    text: 'Filtrez les liens affichés : Bloque, Permet, Entraîne, Lié à.',
    target: '[data-tour="pert-relation-filter"]',
    noZone: true,
    side: 'bottom',
  },
  tout: {
    title: 'Réduire / Étendre',
    short: 'Replie ou réaffiche les sous-tâches.',
    text: 'Replie les sous-tâches dans leur tâche parente pour alléger le diagramme, ou les réaffiche.',
    target: '[data-tour="collapse-toggle"]',
    noZone: true,
    side: 'bottom',
  },
  zoom: {
    title: 'Zoom',
    short: 'Zoomez ou revenez à 100 %.',
    text: 'Moins / plus ; cliquez sur le pourcentage pour revenir à 100 %.',
    target: '[data-tour="pert-zoom"]',
    noZone: true,
    side: 'bottom',
  },
  legend: {
    title: 'Légende',
    short: 'Légende : signification des couleurs des nœuds et des flèches',
    text: 'Rappelle la signification des couleurs des nœuds et des flèches.',
    target: '[data-tour="pert-legend"]',
    noZone: true,
    side: 'bottom',
  },
};

const derived = helpFromElements(elements);

export const help: HelpEntry = {
  title: 'PERT',
  summary: 'Le diagramme PERT : les tâches, leurs dépendances et le chemin critique.',
  short: 'Dépendances et chemin critique',
  empty: 'Aucune tâche à ordonner. Créez des tâches, puis reliez-les par « Bloque » pour dessiner leurs dépendances.',
  ...derived,
  hints: {
    ...derived.hints,
    relFilterOff: 'N\'afficher que les liens « {label} »',
    relFilterOn: 'Retirer le filtre « {label} »',
    zoomOut: 'Dézoomer',
    zoomReset: 'Revenir à 100 %',
    zoomIn: 'Zoomer',
  },
  tour: [
    ...elementTourSteps('pert', elements),
    ...SPACE_TOOLBAR_STEPS,
  ],
};

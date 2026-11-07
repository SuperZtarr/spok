/* Aide utilisateur de la page « Accueil » (/), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris par le « ? »
   (PageHelpButton), le tour et le mode Aide — registre help/pageHelp.ts. Rappels news* : section Nouveautés et zone allumée. */
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

const elements: HelpElements = {
  accueil: {
    title: 'Accueil',
    short: 'Tout ce qui vous concerne.',
    text: 'Tout ce qui vous concerne, d\'un coup d\'œil.',
    target: '[data-tour="home-welcome"]',
    side: 'bottom',
  },
  nouveautes: {
    title: 'Nouveautés',
    short: 'Ce qui a changé dans SPOK.',
    text: 'Les changements de SPOK que vous n\'avez pas encore traités. Montrer vous emmène à l\'écran concerné ; une carte disparaît quand vous l\'ignorez ou quand vous avez lu son explication.',
    target: '[data-tour="home-news"]',
    side: 'bottom',
  },
  raccourcis: {
    title: 'Raccourcis',
    short: 'Les pages les plus utiles.',
    text: 'Accès direct aux pages les plus utiles.',
    target: '[data-tour="home-shortcuts"]',
    side: 'bottom',
  },
  apercus: {
    title: 'Aperçus',
    short: 'Échéances, retards, tâches et non-lus.',
    text: 'Échéances proches, retards, tâches qui vous sont assignées, notifications non lues. « Voir tout » ouvre la page complète (pour les non lus : la cloche des notifications).',
    target: '[data-tour="home-previews"]',
    side: 'bottom',
  },
  activite: {
    title: 'Activité récente',
    short: 'Ce que les autres ont modifié.',
    text: 'Les éléments modifiés par d\'autres depuis votre dernier passage.',
    target: '[data-tour="home-activity"]',
    side: 'bottom',
  },
  communautes: {
    title: 'Vos communautés',
    short: 'Cliquez sur une carte pour y entrer.',
    text: 'Vos communautés avec leur activité récente ; cliquez sur une carte pour y entrer.',
    target: '[data-tour="home-communities"]',
    side: 'top',
  },
  favoris: {
    title: 'Espaces favoris',
    short: 'Les espaces marqués d\'une étoile.',
    text: 'Les espaces marqués d\'une étoile : ajoutez-en un aux favoris pour le retrouver ici.',
    target: '[data-tour="home-favorites"]',
    side: 'top',
  },
};

const derived = helpFromElements(elements);

export const help: HelpEntry = {
  title: 'Accueil',
  summary: 'Votre point de départ : raccourcis, aperçus du tableau de bord, activité récente, communautés et espaces favoris.',
  ...derived,
  hints: {
    ...derived.hints,
    newsIntro: 'Ce qui a changé dans SPOK depuis votre dernière lecture. Montrer vous emmène à l\'écran concerné.',
    newsIgnore: 'Ne plus annoncer ce changement sur votre compte. Il reste dans « Toutes les nouveautés ». Rien d\'autre n\'est modifié.',
    newsShow: 'Ouvre l\'écran concerné et y allume la zone (une vue s\'ouvre dans votre dernier espace visité). Le changement reste annoncé tant que vous n\'avez pas répondu.',
  },
  tour: elementTourSteps('home', elements),
};

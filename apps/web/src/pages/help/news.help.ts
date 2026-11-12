/* Aide utilisateur de la page « Toutes les nouveautés » (/news), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris par le « ? »
   (PageHelpButton), le tour et le mode Aide. `empty` : message de NewsPage sans annonce ; `hints.replay` : rappel du bouton Montrer ; `hints.seen` : rappel de « C'est noté ». Registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

const elements: HelpElements = {
  liste: {
    title: 'L\'historique',
    short: 'Toutes les nouveautés et évolutions, datées.',
    text: 'Toutes les nouveautés et évolutions de SPOK, une vignette chacune, les plus récentes d\'abord, y compris celles que vous avez déjà vues. Accessible à tout moment par « Nouveautés » dans le bandeau.',
    target: '[data-tour="news-list"]',
    side: 'top',
    changes: [{
      id: 'news-bandeau-c-est-note',
      kind: 'evolution',
      text: 'Les nouveautés s\'ouvrent depuis le bandeau, et « C\'est noté » (anciennement Ignorer) marque une annonce comme vue, ici aussi.',
      date: '2026-11-11',
    }],
  },
  annonce: {
    title: 'Une annonce',
    short: 'Ce qui a changé, et de quoi le revoir.',
    text: 'Ce qui a changé et l\'explication de la fonction. « C\'est noté » la marque comme vue sur votre compte : elle n\'est plus annoncée et porte la mention « Vue ». Montrer vous emmène à l\'écran concerné et y rallume la zone, quand un écran fixe permet de la montrer.',
    target: '[data-tour="news-entry"]',
    side: 'bottom',
  },
};

const derived = helpFromElements(elements);

export const help: HelpEntry = {
  title: 'Toutes les nouveautés',
  route: '/news',
  summary: 'L\'historique de ce qui a changé dans SPOK, pour revoir une annonce ou marquer comme vue celle que vous avez prise en compte.',
  empty: 'Aucune nouveauté pour le moment.',
  ...derived,
  hints: {
    ...derived.hints,
    seen: 'Ce changement est pris en compte : il n\'est plus annoncé sur votre compte. Rien d\'autre n\'est modifié.',
    replay: 'Ouvre l\'écran concerné et y rallume la zone, comme à la première annonce. Rien d\'autre n\'est modifié.',
  },
  tour: elementTourSteps('news', elements),
};

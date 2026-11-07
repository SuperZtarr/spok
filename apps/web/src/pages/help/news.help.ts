/* Aide utilisateur de la page « Toutes les nouveautés » (/news), écrite en éléments d'aide (help/elements.ts) : un texte par fonction, repris par le « ? »
   (PageHelpButton), le tour et le mode Aide. `empty` : message de NewsPage sans annonce ; `hints.replay` : rappel du bouton Montrer. Registre help/pageHelp.ts. */
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

const elements: HelpElements = {
  liste: {
    title: 'L\'historique',
    short: 'Toutes les nouveautés et évolutions, datées.',
    text: 'Toutes les nouveautés et évolutions de SPOK, les plus récentes d\'abord, y compris celles que vous avez ignorées.',
    target: '[data-tour="news-list"]',
    side: 'top',
  },
  annonce: {
    title: 'Une annonce',
    short: 'Ce qui a changé, et de quoi le revoir.',
    text: 'Ce qui a changé et l\'explication de la fonction. Montrer vous emmène à l\'écran concerné et y rallume la zone, quand un écran fixe permet de la montrer.',
    target: '[data-tour="news-entry"]',
    side: 'bottom',
  },
};

const derived = helpFromElements(elements);

export const help: HelpEntry = {
  title: 'Toutes les nouveautés',
  route: '/news',
  summary: 'L\'historique de ce qui a changé dans SPOK, pour retrouver une annonce déjà ignorée ou lue.',
  empty: 'Aucune nouveauté pour le moment.',
  ...derived,
  hints: {
    ...derived.hints,
    replay: 'Ouvre l\'écran concerné et y rallume la zone, comme à la première annonce. Rien d\'autre n\'est modifié.',
  },
  tour: elementTourSteps('news', elements),
};

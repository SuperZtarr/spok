/* Libellés communs des nouveautés (pilote Kanban, 2026-11-07), partagés par NewFeatureOverlay et NewsCards pour qu'un
   même bouton porte le même nom partout, et apparence du badge, partagée par la zone allumée et l'étape de tutoriel
   (help/elements.ts). Rappels fonctionnels et phrase d'explication : `hints` de la fiche home. */
import type { HelpChange } from './types';

/** Apparence du badge « Nouveauté » / « Évolution » : la même sur la zone allumée et dans le tutoriel. */
export const NEWS_BADGE_CLASS = 'rounded bg-violet-600 px-2 py-0.5 text-xs font-medium text-white animate-pulse motion-reduce:animate-none';
/** Teinte de la zone allumée : violet, réservé aux nouveautés (`primary` est presque noir ou blanc selon le thème). */
export const NEWS_ZONE_CLASS = 'border-violet-500 bg-violet-500/25';
/** Posée pendant le tutoriel sur la zone d'une nouveauté : teinte plus forte que celle des autres étapes (index.css). */
export const NEWS_TOUR_CLASS = 'help-tour-news';

export const NEWS_TEXTS = {
  sectionTitle: 'Nouveautés',
  all: 'Toutes les nouveautés',
  unreleased: 'Pas encore livrée',
  ignore: 'Ignorer',
  show: 'Montrer',
  explain: 'Expliquez-moi',
  done: 'Compris',
  kind: { new: 'Nouveauté', evolution: 'Évolution' } satisfies Record<HelpChange['kind'], string>,
};

/*
 * Sources des annonces : les fiches des vues et des pages, et la barre commune. C'est ici qu'une nouvelle famille
 * d'éléments d'aide devient annonçable. Séparé de announcements.ts pour que les tests puissent fournir leurs propres sources.
 * Chaque source dit où mener « Montrer » : une vue d'espace (view), un espace quelconque (inSpace) ou une page (route).
 * Sans aucun des trois, l'annonce s'affiche sans bouton Montrer : c'est le cas des modales et des pages à paramètres.
 */
import { VIEW_HELP } from '../components/views/help';
import { PAGE_HELP } from './pageHelp';
import { SPACE_TOOLBAR_ELEMENTS } from './spaceToolbar.elements';
import type { HelpElement, HelpEntry } from './types';

export interface AnnouncementSource {
  /** Clé de la fiche : première partie de data-help-zone. */
  fiche: string;
  elements: Record<string, HelpElement>;
  view?: string;
  route?: string;
  inSpace?: boolean;
}

export const ANNOUNCEMENT_SOURCES: AnnouncementSource[] = [
  ...Object.entries(VIEW_HELP as Record<string, HelpEntry>).map(([view, entry]) => ({ fiche: view, elements: entry.elements ?? {}, view })),
  ...Object.entries(PAGE_HELP as Record<string, HelpEntry>).map(([page, entry]) => ({ fiche: page, elements: entry.elements ?? {}, route: entry.route })),
  { fiche: 'toolbar', elements: SPACE_TOOLBAR_ELEMENTS, inSpace: true },
];

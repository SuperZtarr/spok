/*
 * Annonces de nouveautés et d'évolutions : calculées depuis les `changes` des éléments d'aide (announcementSources.ts),
 * sans seconde liste à tenir. Lues par NewFeatureOverlay (zone allumée), NewsCards (accueil) et NewsPage (historique).
 * announcementsFrom(sources, includeUndated) : le calcul pur ; une annonce sans date n'apparaît qu'en développement local.
 * listAnnouncements : toutes les annonces publiées. usePendingAnnouncements : celles que l'utilisateur n'a pas traitées
 * (useHelpAnnouncementsStore) ; aucune tant que son suivi n'est pas chargé. announcementHref : destination de « Montrer », absente si rien ne peut être montré.
 * Textes des boutons : help/newsTexts.ts.
 */
import { useMemo } from 'react';
import { useHelpAnnouncementsStore } from '../stores/helpAnnouncements';
import { ANNOUNCEMENT_SOURCES, type AnnouncementSource } from './announcementSources';
import { isPublished, zoneSelector } from './elements';
import type { HelpChange } from './types';

export interface Announcement {
  id: string;
  kind: HelpChange['kind'];
  date?: string;
  /** Ce qui change. */
  text: string;
  /** Nom de la fonction. */
  title: string;
  /** Explication complète de la fonction (Expliquez-moi). */
  explanation: string;
  /** Sélecteur de la zone à allumer. */
  selector: string;
  /** Vue, page ou espace à ouvrir pour montrer la fonction (Montrer). */
  view?: string;
  route?: string;
  inSpace?: boolean;
}

export function announcementsFrom(sources: AnnouncementSource[], includeUndated: boolean = import.meta.env.DEV): Announcement[] {
  const found: Announcement[] = [];
  for (const { fiche, elements, view, route, inSpace } of sources) {
    for (const [zone, element] of Object.entries(elements)) {
      for (const change of element.changes ?? []) {
        if (!isPublished(change, includeUndated)) continue;
        found.push({
          id: change.id,
          kind: change.kind,
          date: change.date,
          text: change.text,
          title: element.title,
          explanation: element.text,
          selector: element.target ?? zoneSelector(fiche, zone),
          view,
          route,
          inSpace,
        });
      }
    }
  }
  // Les plus récentes d'abord ; une annonce sans date (pas encore livrée) passe devant
  return found.sort((a, b) => (b.date ?? '9999').localeCompare(a.date ?? '9999'));
}

export function listAnnouncements(includeUndated?: boolean): Announcement[] {
  return announcementsFrom(ANNOUNCEMENT_SOURCES, includeUndated);
}

export function usePendingAnnouncements(): Announcement[] {
  const handled = useHelpAnnouncementsStore((state) => state.handled);
  const loaded = useHelpAnnouncementsStore((state) => state.loaded);
  return useMemo(() => (loaded ? listAnnouncements().filter((announcement) => !handled.includes(announcement.id)) : []), [handled, loaded]);
}

/** Destination de « Montrer ». spaceId : espace à ouvrir pour une fonction d'espace (voir targetSpaceId). */
export function announcementHref(announcement: Announcement, spaceId: string | undefined): string | undefined {
  if (announcement.route) return announcement.route;
  if (!spaceId) return undefined;
  if (announcement.view) return `/spaces/${spaceId}?view=${announcement.view}`;
  return announcement.inSpace ? `/spaces/${spaceId}` : undefined;
}

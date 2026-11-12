/*
 * Annonces de nouveautés et d'évolutions : calculées depuis les `changes` des éléments d'aide (announcementSources.ts),
 * sans seconde liste à tenir. Lues par NewFeatureOverlay (zone allumée), NewsCards (accueil), NewsPage (historique),
 * le tutoriel (useOnboarding) et NewsAdminPage (publication).
 * announcementsFrom(sources, includeUndated) : le calcul pur ; une annonce sans date n'apparaît qu'en développement local.
 * applyOverrides (2026-11-12) : réglages de publication de /admin/news (masquée, date qui remplace celle du code ; une date
 * future programme l'annonce, qui n'apparaît qu'à partir de ce jour). Règle news-publication de lib/businessRules.ts.
 * listCodeAnnouncements : annonces du code sans réglage (écran d'administration). listAnnouncements / useAnnouncements :
 * annonces publiées, réglages appliqués. usePendingAnnouncements : celles que l'utilisateur n'a pas traitées
 * (useHelpAnnouncementsStore) ; aucune tant que son suivi n'est pas chargé. withheldAnnouncementIds : masquées ou
 * programmées, à ne pas montrer dans le tutoriel. announcementHref : destination de « Montrer », absente si rien ne peut être montré.
 * Textes des boutons : help/newsTexts.ts.
 */
import { useEffect, useMemo } from 'react';
import type { NewsOverride } from '../lib/api';
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
  /** Clé de la fiche qui porte l'annonce (écran concerné). */
  fiche: string;
  /** Vue, page ou espace à ouvrir pour montrer la fonction (Montrer). */
  view?: string;
  route?: string;
  inSpace?: boolean;
}

// Les plus récentes d'abord ; une annonce sans date (pas encore livrée) passe devant
const byDateDesc = (a: Announcement, b: Announcement) => (b.date ?? '9999').localeCompare(a.date ?? '9999');

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
          fiche,
          view,
          route,
          inSpace,
        });
      }
    }
  }
  return found.sort(byDateDesc);
}

/** Date du jour, AAAA-MM-JJ, à l'heure locale. */
export const todayIso = () => new Date().toLocaleDateString('sv-SE');

/** Réglages de publication appliqués : masquée → retirée ; date réglée → remplace celle du code ; date future → retirée. */
export function applyOverrides(announcements: Announcement[], overrides: NewsOverride[], today: string = todayIso()): Announcement[] {
  const byId = new Map(overrides.map((override) => [override.id, override]));
  return announcements
    .flatMap((announcement) => {
      const override = byId.get(announcement.id);
      if (!override) return [announcement];
      if (override.hidden) return [];
      const date = override.date ?? announcement.date;
      if (date && date > today) return [];
      return [{ ...announcement, date }];
    })
    .sort(byDateDesc);
}

export function listCodeAnnouncements(includeUndated?: boolean): Announcement[] {
  return announcementsFrom(ANNOUNCEMENT_SOURCES, includeUndated);
}

export function listAnnouncements(includeUndated?: boolean): Announcement[] {
  return applyOverrides(listCodeAnnouncements(includeUndated), useHelpAnnouncementsStore.getState().overrides);
}

export function withheldAnnouncementIds(): string[] {
  const published = new Set(listAnnouncements().map((announcement) => announcement.id));
  return listCodeAnnouncements().map((announcement) => announcement.id).filter((id) => !published.has(id));
}

/** Annonces publiées, réglages appliqués ; charge les réglages s'ils ne le sont pas (visiteur sans connexion). */
export function useAnnouncements(): Announcement[] {
  const overrides = useHelpAnnouncementsStore((state) => state.overrides);
  const loadOverrides = useHelpAnnouncementsStore((state) => state.loadOverrides);
  useEffect(() => { void loadOverrides(); }, [loadOverrides]);
  return useMemo(() => applyOverrides(listCodeAnnouncements(), overrides), [overrides]);
}

export function usePendingAnnouncements(): Announcement[] {
  const handled = useHelpAnnouncementsStore((state) => state.handled);
  const loaded = useHelpAnnouncementsStore((state) => state.loaded);
  const overrides = useHelpAnnouncementsStore((state) => state.overrides);
  return useMemo(
    () => (loaded ? applyOverrides(listCodeAnnouncements(), overrides).filter((announcement) => !handled.includes(announcement.id)) : []),
    [handled, loaded, overrides],
  );
}

/** Destination de « Montrer ». spaceId : espace à ouvrir pour une fonction d'espace (voir targetSpaceId). */
export function announcementHref(announcement: Announcement, spaceId: string | undefined): string | undefined {
  if (announcement.route) return announcement.route;
  if (!spaceId) return undefined;
  if (announcement.view) return `/spaces/${spaceId}?view=${announcement.view}`;
  return announcement.inSpace ? `/spaces/${spaceId}` : undefined;
}

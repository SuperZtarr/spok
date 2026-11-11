/*
 * Page « Toutes les nouveautés » (/news) : l'historique des annonces (help/announcements.ts), pour revoir une annonce ou
 * marquer comme vue celle qu'on a prise en compte. Accès : bouton « Nouveautés » du bandeau (MENU_REGISTRY, clé news),
 * lien de la section Nouveautés de l'accueil (NewsCards) et plan du site. Lisible sans connexion.
 * Compte connecté et suivi chargé : une annonce non traitée porte « C'est noté » (markHandled), une annonce traitée la
 * mention « Vue ». Sans connexion, ni bouton ni mention : il n'y a pas de suivi.
 * Montrer ne s'affiche que si un écran peut être ouvert (un espace accessible pour une fonction d'espace) ; il remet
 * l'annonce à traiter (unmarkHandled) : NewFeatureOverlay rallume alors sa zone sur l'écran ouvert.
 * Les textes viennent des éléments d'aide et de la fiche pages/help/news.help.ts, jamais d'ici.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Check, Sparkles } from 'lucide-react';
import { announcementHref, listAnnouncements } from '../help/announcements';
import { HelpHint } from '../help/HelpHint';
import { NEWS_TEXTS } from '../help/newsTexts';
import { targetSpaceId } from '../help/NewsCards';
import { PAGE_HELP } from '../help/pageHelp';
import { pageHint } from '../help/pageHint';
import { PageHelpButton } from '../help/PageHelpButton';
import { spacesApi } from '../lib/api';
import { useAuthStore } from '../stores/auth';
import { useHelpAnnouncementsStore } from '../stores/helpAnnouncements';

export function NewsPage() {
  const user = useAuthStore((state) => state.user);
  const loaded = useHelpAnnouncementsStore((state) => state.loaded);
  const handled = useHelpAnnouncementsStore((state) => state.handled);
  const markHandled = useHelpAnnouncementsStore((state) => state.markHandled);
  const unmarkHandled = useHelpAnnouncementsStore((state) => state.unmarkHandled);
  const announcements = useMemo(() => listAnnouncements(), []);
  const { data: spaces } = useQuery({
    queryKey: ['spaces', 'all'],
    queryFn: () => spacesApi.list(),
    enabled: !!user,
  });
  const spaceId = targetSpaceId((spaces ?? []).map((space) => space.id));
  const tracked = !!user && loaded;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6 flex-1 overflow-auto">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-violet-500" />
        <h1 className="text-2xl font-bold">{NEWS_TEXTS.all}</h1>
        <div className="ml-auto"><PageHelpButton pageKey="news" /></div>
      </div>
      <p className="text-sm text-muted-foreground">{PAGE_HELP.news.summary}</p>

      <div className="space-y-3" data-tour="news-list" data-help-zone="news:liste">
        {announcements.length === 0 && <p className="text-sm text-muted-foreground">{PAGE_HELP.news.empty}</p>}
        {announcements.map((announcement, index) => {
          const href = announcementHref(announcement, spaceId);
          const seen = handled.includes(announcement.id);
          return (
            <article
              key={announcement.id}
              {...(index === 0 ? { 'data-tour': 'news-entry' } : {})}
              data-help-zone="news:annonce"
              className={`rounded-lg border bg-card p-4 ${tracked && !seen ? 'border-violet-500/60' : 'border-border'}`}
            >
              <div className="mb-1 flex items-center gap-2 text-xs">
                <span className="font-medium text-violet-600 dark:text-violet-400">{NEWS_TEXTS.kind[announcement.kind]}</span>
                <span className="text-muted-foreground">{announcement.date ?? NEWS_TEXTS.unreleased}</span>
                {tracked && seen && (
                  <HelpHint text={pageHint('news', 'seen')}>
                    <span className="ml-auto inline-flex items-center gap-1 text-muted-foreground">
                      <Check className="w-3.5 h-3.5" />{NEWS_TEXTS.seen}
                    </span>
                  </HelpHint>
                )}
              </div>
              <h2 className="text-sm font-semibold text-foreground">{announcement.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-foreground">{announcement.text}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{announcement.explanation}</p>
              {((tracked && !seen) || href) && (
                <div className="mt-3 flex items-center gap-2 text-xs">
                  {tracked && !seen && (
                    <HelpHint text={pageHint('home', 'newsIgnore')}>
                      <button
                        type="button"
                        onClick={() => markHandled(announcement.id)}
                        className="h-9 rounded-md border border-input px-3 hover:bg-accent"
                      >
                        {NEWS_TEXTS.ignore}
                      </button>
                    </HelpHint>
                  )}
                  {href && (
                    <HelpHint text={pageHint('news', 'replay')}>
                      <Link
                        to={href}
                        onClick={() => unmarkHandled(announcement.id)}
                        className="inline-flex h-9 items-center rounded-md border border-input px-3 hover:bg-accent"
                      >
                        {NEWS_TEXTS.show}
                      </Link>
                    </HelpHint>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

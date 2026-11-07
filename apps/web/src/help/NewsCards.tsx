/*
 * NewsCards — section « Nouveautés » de la page d'accueil (2026-11-07) : une carte par annonce non traitée, les trois plus
 * récentes, avec Ignorer et Montrer, et le lien vers l'historique (/news). Sans annonce à traiter, seul ce lien reste.
 * Montrer ouvre la page, ou la vue dans le dernier espace visité encore accessible, sinon le premier espace ;
 * NewFeatureOverlay y allume la zone. Rien à ouvrir : pas de bouton Montrer. L'annonce reste à traiter tant que
 * l'utilisateur n'a pas répondu.
 * Prop : spaces (espaces accessibles de l'utilisateur, déjà chargés par HomeView).
 * spok_recent_spaces : liste écrite par Layout, lue ici sans modification.
 * Textes : help/newsTexts.ts, fiche home (hints, zones).
 */
import { Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useHelpAnnouncementsStore } from '../stores/helpAnnouncements';
import { announcementHref, listAnnouncements, usePendingAnnouncements } from './announcements';
import { HelpHint } from './HelpHint';
import { NEWS_TEXTS } from './newsTexts';
import { pageHint } from './pageHint';

const MAX_CARDS = 3;
const RECENTS_KEY = 'spok_recent_spaces';

/** Espace à ouvrir pour montrer une vue : le plus récent encore accessible, sinon le premier. */
export function targetSpaceId(spaceIds: string[]): string | undefined {
  let recents: string[] = [];
  try {
    recents = JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]') as string[];
  } catch {
    // Liste illisible : on se rabat sur le premier espace
  }
  return recents.find((id) => spaceIds.includes(id)) ?? spaceIds[0];
}

export function NewsCards({ spaces }: { spaces: { id: string }[] }) {
  const pending = usePendingAnnouncements();
  const markHandled = useHelpAnnouncementsStore((state) => state.markHandled);
  if (pending.length === 0) {
    if (listAnnouncements().length === 0) return null;
    return <div className="mb-8 text-center"><Link to="/news" className="text-xs text-primary hover:underline">{NEWS_TEXTS.all}</Link></div>;
  }
  const spaceId = targetSpaceId(spaces.map((space) => space.id));

  return (
    <section className="mb-8" data-tour="home-news" data-help-zone="home:nouveautes">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <Sparkles className="h-4 w-4 text-violet-500" />
          {NEWS_TEXTS.sectionTitle}
        </h2>
        <Link to="/news" className="text-xs text-primary hover:underline">{NEWS_TEXTS.all}</Link>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">{pageHint('home', 'newsIntro')}</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {pending.slice(0, MAX_CARDS).map((announcement) => {
          const href = announcementHref(announcement, spaceId);
          return (
          <article key={announcement.id} className="flex flex-col rounded-lg border border-violet-500/50 bg-violet-500/5 p-4">
            <span className="mb-1 text-xs font-medium text-violet-600 dark:text-violet-400">{NEWS_TEXTS.kind[announcement.kind]}</span>
            <h3 className="text-sm font-semibold text-foreground">{announcement.title}</h3>
            <p className="mt-1 flex-1 text-xs leading-relaxed text-muted-foreground">{announcement.text}</p>
            <div className="mt-3 flex items-center gap-2 text-xs">
              <HelpHint text={pageHint('home', 'newsIgnore')}>
                <button type="button" onClick={() => markHandled(announcement.id)} className="h-9 rounded-md border border-input px-3 hover:bg-accent">
                  {NEWS_TEXTS.ignore}
                </button>
              </HelpHint>
              {href && (
                <HelpHint text={pageHint('home', 'newsShow')}>
                  <Link to={href} className="inline-flex h-9 items-center rounded-md bg-primary px-3 font-medium text-primary-foreground">
                    {NEWS_TEXTS.show}
                  </Link>
                </HelpHint>
              )}
            </div>
          </article>
          );
        })}
      </div>
    </section>
  );
}

/* Admin « Publication des nouveautés » (/admin/news) : décider, pour tous, si chaque annonce du code (éléments d'aide, champ
   `changes`) est publiée et à quelle date — surcharges AppConfig 'news_overrides' (PUT /admin/news/overrides, routes/admin/news.ts),
   appliquées partout par help/announcements.ts (applyOverrides) : accueil, zones allumées, tutoriel, /news.
   Les textes restent dans le code : on ne règle ici que « masquée » et la date (vide = date de la mise en production ; future =
   annonce programmée). Brouillon local, rien n'est envoyé avant « Enregistrer » (Ctrl+S) ; après enregistrement, le store
   useHelpAnnouncementsStore reçoit les réglages (setOverrides), l'écran courant est à jour, les autres au prochain chargement.
   Annonces sans date (pas encore en production) : visibles seulement en développement local, marquées « en attente de MEP ».
   Aide utilisateur : fiche pages/help/admin-news.help.ts — « ? » (PageHelpButton), rappels fonctionnels (pageHint). */
import { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Eye, EyeOff, Loader2, RotateCcw, Save, Undo2 } from 'lucide-react';
import { newsApi, type NewsOverride } from '../../lib/api';
import { useCtrlS } from '../../hooks/useCtrlS';
import { Button } from '../../components/ui/Button';
import { VIEW_HELP } from '../../components/views/help';
import { listCodeAnnouncements, todayIso } from '../../help/announcements';
import { NEWS_TEXTS } from '../../help/newsTexts';
import { PAGE_HELP } from '../../help/pageHelp';
import { PageHelpButton } from '../../help/PageHelpButton';
import { HelpHint } from '../../help/HelpHint';
import { pageHint } from '../../help/pageHint';
import { useHelpAnnouncementsStore } from '../../stores/helpAnnouncements';

type Draft = Record<string, { hidden: boolean; date: string }>;

const toDraft = (overrides: NewsOverride[]): Draft =>
  Object.fromEntries(overrides.map((o) => [o.id, { hidden: !!o.hidden, date: o.date ?? '' }]));

const sameDraft = (a: Draft, b: Draft) => {
  const ids = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const id of ids) {
    const x = a[id] ?? { hidden: false, date: '' };
    const y = b[id] ?? { hidden: false, date: '' };
    if (x.hidden !== y.hidden || x.date !== y.date) return false;
  }
  return true;
};

/** Nom lisible de l'écran qui porte l'annonce : titre de sa fiche (page ou vue), barre d'espace, sinon sa clé. */
const screenLabel = (fiche: string) =>
  (PAGE_HELP as Record<string, { title?: string }>)[fiche]?.title
  ?? (VIEW_HELP as Record<string, { title?: string }>)[fiche]?.title
  ?? (fiche === 'toolbar' ? 'Barre d\'espace' : fiche);

export function NewsAdminPage() {
  const announcements = useMemo(() => listCodeAnnouncements(), []);
  const overrides = useHelpAnnouncementsStore((state) => state.overrides);
  const overridesLoaded = useHelpAnnouncementsStore((state) => state.overridesLoaded);
  const loadOverrides = useHelpAnnouncementsStore((state) => state.loadOverrides);
  const setOverrides = useHelpAnnouncementsStore((state) => state.setOverrides);
  const saved = useMemo(() => toDraft(overrides), [overrides]);
  const [draft, setDraft] = useState<Draft>({});
  const today = todayIso();

  useEffect(() => { void loadOverrides(); }, [loadOverrides]);
  // Brouillon initialisé sur les réglages enregistrés ; rien n'est envoyé avant « Enregistrer »
  useEffect(() => { setDraft(saved); }, [saved]);

  const hasChanges = overridesLoaded && !sameDraft(draft, saved);

  const saveMutation = useMutation({
    mutationFn: () => newsApi.saveOverrides(
      Object.entries(draft)
        .filter(([, value]) => value.hidden || value.date)
        .map(([id, value]) => ({ id, ...(value.hidden ? { hidden: true } : {}), ...(value.date ? { date: value.date } : {}) })),
    ),
    onSuccess: (result) => setOverrides(result.overrides),
  });
  useCtrlS(hasChanges && !saveMutation.isPending, () => saveMutation.mutate());

  const entry = (id: string) => draft[id] ?? { hidden: false, date: '' };
  const setEntry = (id: string, patch: Partial<{ hidden: boolean; date: string }>) =>
    setDraft((d) => ({ ...d, [id]: { ...entry(id), ...patch } }));
  const resetEntry = (id: string) => setDraft((d) => { const next = { ...d }; delete next[id]; return next; });

  return (
    <div className="p-6 w-full">
      <div className="sticky top-0 z-10 bg-background pb-4 -mx-6 px-6 -mt-6 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{PAGE_HELP['admin-news'].title}</h1>
              <PageHelpButton pageKey="admin-news" />
            </div>
            <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">{pageHint('admin-news', 'intro')}</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <HelpHint text={pageHint('admin-news', 'resetAll')}>
              <Button variant="bordered" onClick={() => setDraft({})} disabled={!overridesLoaded}>
                <RotateCcw className="w-4 h-4 mr-1" />
                Tout réinitialiser
              </Button>
            </HelpHint>
            <HelpHint text={pageHint('admin-news', 'save')}>
              <Button onClick={() => saveMutation.mutate()} disabled={!hasChanges || saveMutation.isPending} data-tour="admin-news-save">
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                Enregistrer
              </Button>
            </HelpHint>
          </div>
        </div>
        {saveMutation.isError && <p className="mt-2 text-sm text-destructive">L'enregistrement a échoué. Réessayez.</p>}
      </div>

      {!overridesLoaded ? (
        <div className="text-center py-12 text-muted-foreground">Chargement…</div>
      ) : announcements.length === 0 ? (
        <p className="text-sm text-muted-foreground">{PAGE_HELP['admin-news'].empty}</p>
      ) : (
        <div className="bg-card border rounded-lg divide-y divide-border" data-tour="admin-news-list" data-help-zone="admin-news:liste">
          {announcements.map((announcement, index) => {
            const current = entry(announcement.id);
            const modified = current.hidden || !!current.date;
            const effectiveDate = current.date || announcement.date;
            const scheduled = !current.hidden && !!effectiveDate && effectiveDate > today;
            return (
              <div
                key={announcement.id}
                {...(index === 0 ? { 'data-tour': 'admin-news-row', 'data-help-zone': 'admin-news:reglages' } : {})}
                className={`flex flex-wrap items-start gap-3 px-4 py-3 ${current.hidden ? 'opacity-60' : ''}`}
              >
                <HelpHint text={pageHint('admin-news', 'hide')}>
                  <button
                    type="button"
                    onClick={() => setEntry(announcement.id, { hidden: !current.hidden })}
                    aria-label={current.hidden ? `Republier ${announcement.title}` : `Masquer ${announcement.title}`}
                    className="h-8 w-8 flex items-center justify-center rounded hover:bg-accent text-muted-foreground"
                  >
                    {current.hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </HelpHint>
                <div className="flex-1 min-w-[16rem]">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-medium text-violet-600 dark:text-violet-400">{NEWS_TEXTS.kind[announcement.kind]}</span>
                    <span className="text-muted-foreground">{screenLabel(announcement.fiche)}</span>
                    {modified && (
                      <HelpHint text={pageHint('admin-news', 'modified')}>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">modifié</span>
                      </HelpHint>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-foreground">{announcement.title}</p>
                  <p className="text-xs text-muted-foreground">{announcement.text}</p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground whitespace-nowrap">
                    {current.hidden ? 'Masquée' : scheduled ? `Programmée au ${effectiveDate}` : 'Publiée'}
                  </span>
                  {!announcement.date && (
                    <HelpHint text={pageHint('admin-news', 'pending')}>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground whitespace-nowrap">en attente de MEP</span>
                    </HelpHint>
                  )}
                  <HelpHint text={pageHint('admin-news', 'date')}>
                    <input
                      type="date"
                      value={current.date || announcement.date || ''}
                      onChange={(event) => setEntry(announcement.id, {
                        date: event.target.value && event.target.value !== announcement.date ? event.target.value : '',
                      })}
                      aria-label={`Date de publication de ${announcement.title}`}
                      className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                    />
                  </HelpHint>
                  <HelpHint text={pageHint('admin-news', 'resetRow')}>
                    <button
                      type="button"
                      onClick={() => resetEntry(announcement.id)}
                      disabled={!modified}
                      aria-label={`Revenir à l'annonce du code pour ${announcement.title}`}
                      className="h-8 w-8 flex items-center justify-center rounded hover:bg-accent text-muted-foreground disabled:opacity-30"
                    >
                      <Undo2 className="w-4 h-4" />
                    </button>
                  </HelpHint>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

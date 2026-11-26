/*
 * Page Article (/spaces/:spaceId/articles/:itemId) : lire et composer un article — titre, chapeau (description de
 * l'article), puis ses blocs (références vers des éléments existants, cf. useArticle / ArticleFlow).
 * Lire | Composer (décision Thomas 2026-11-26, avant : composition dans la fiche) : sélecteur en haut à gauche, après
 * « Retour à l'espace », seulement si article.canEditArticle ; l'adresse le garde (?mode=composition, itemOpenMode :
 * articleComposeUrl / isArticleComposing — c'est là qu'envoie le bouton « Composer » de la fiche). Composer = le même
 * rendu que la lecture, avec le panneau « À ajouter » et les gestes de ArticleComposer. Sans le droit, l'adresse en
 * composition montre la lecture.
 * On y arrive par la vue Articles, le menu ⋮ « Lire l'article », la fiche ou un lien partagé.
 * Retour à l'espace : location.state.from (la vue d'origine, articleReturnState), sinon le contenu de l'espace.
 * Occupe toute la largeur disponible (décision Thomas 2026-11-06). Lisible à l'écran, sur mobile (blocs en pleine
 * largeur sous 640 px) et à l'impression (printArticle, qui garde sa propre largeur de page).
 * Aide : fiche pages/help/article.help.ts.
 * Accès : celui de l'article (anonyme compris pour un espace public) ; 404 API → message « introuvable ».
 */
import { useRef } from 'react';
import { useParams, Link, useLocation, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Printer, PenLine, BookOpen } from 'lucide-react';
import { itemsApi } from '../lib/api';
import { ITEM_MODE_PARAM, articleComposeUrl, isArticleComposing } from '../lib/itemOpenMode';
import { useArticle } from '../hooks/useArticle';
import { sanitizeHtml } from '../lib/sanitizeHtml';
import { ArticleFlow } from '../components/article/ArticleFlow';
import { ArticleComposer } from '../components/article/ArticleComposer';
import { printArticle } from '../components/article/printArticle';
import { PageHelpButton } from '../help/PageHelpButton';
import { HelpHint } from '../help/HelpHint';
import { pageHint } from '../help/pageHint';
import { Button } from '../components/ui/Button';

const modeButton = (active: boolean) =>
  `flex items-center gap-1 px-2.5 py-1 text-sm font-medium rounded transition-colors ${active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`;

export function ArticlePage() {
  const { spaceId, itemId } = useParams<{ spaceId: string; itemId: string }>();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { data: item } = useQuery({
    queryKey: ['item', spaceId, itemId],
    queryFn: () => itemsApi.get(spaceId!, itemId!),
    enabled: !!spaceId && !!itemId,
  });
  const state = useArticle(spaceId, itemId);
  const { article, isLoading, isError } = state;
  const contentRef = useRef<HTMLDivElement>(null);

  if (isError) {
    return <div className="p-6 text-sm text-muted-foreground">Article introuvable ou inaccessible.</div>;
  }

  const backTo = (location.state as { from?: string } | null)?.from ?? `/spaces/${spaceId}/content`;
  const canCompose = !!article?.canEditArticle;
  const composing = canCompose && isArticleComposing(searchParams.get(ITEM_MODE_PARAM));
  // Changer de mode garde l'état de navigation (vue d'origine pour « Retour à l'espace »)
  const readUrl = location.pathname;
  const composeUrl = articleComposeUrl(spaceId!, itemId!);

  return (
    <div className="p-4 sm:p-6 overflow-auto flex-1 min-h-0">
      <div className="w-full">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Link to={backTo} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" /> Retour à l'espace
            </Link>
            {canCompose && (
              <div className="flex items-center rounded-md bg-muted p-0.5" role="group" aria-label="Mode de la page" data-tour="article-compose">
                <HelpHint text={pageHint('article', 'readMode')}>
                  <Link to={readUrl} state={location.state} replace aria-pressed={!composing} className={modeButton(!composing)}>
                    <BookOpen className="w-3.5 h-3.5" /> Lire
                  </Link>
                </HelpHint>
                <HelpHint text={pageHint('article', 'compose')}>
                  <Link to={composeUrl} state={location.state} replace aria-pressed={composing} className={modeButton(composing)}>
                    <PenLine className="w-3.5 h-3.5" /> Composer
                  </Link>
                </HelpHint>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <HelpHint text={pageHint('article', 'print')}>
              <Button variant="bordered" size="sm" onClick={() => contentRef.current && printArticle(contentRef.current, item?.title ?? 'Article', { description: item?.description })} aria-label="Imprimer">
                <Printer className="w-4 h-4" />
              </Button>
            </HelpHint>
            <PageHelpButton pageKey="article" />
          </div>
        </div>

        {/* Impression : ce bloc tel qu'il se lit ; en composition, une copie cachée sans les poignées */}
        <header className="mb-6" data-tour="article-header" data-help-zone="article:entete">
          <h1 className="text-2xl sm:text-3xl font-bold leading-tight">{item?.title}</h1>
          {item?.description && (
            <div className="prose sm:prose-lg dark:prose-invert max-w-none mt-3 text-muted-foreground" dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.description) }} />
          )}
        </header>

        {composing && article && <ArticleComposer spaceId={spaceId!} articleId={itemId!} article={article} state={state} />}

        {/* Blocs tels qu'ils se lisent — copiés par l'impression ; cachés en composition (copie sans les poignées) */}
        <div ref={contentRef} className={composing ? 'hidden' : 'flow-root'}>
          {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
          {article && article.blocks.length === 0 && <p className="text-sm text-muted-foreground">{pageHint('article', 'empty')}</p>}
          {article && <ArticleFlow blocks={article.blocks} />}
        </div>
      </div>
    </div>
  );
}

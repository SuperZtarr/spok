/*
 * Page Article (/spaces/:spaceId/articles/:itemId) : l'endroit où lire un article — titre, chapeau (description de
 * l'article), puis ses blocs (références vers des éléments existants, cf. useArticle / ArticleFlow : rangées de
 * colonnes et hiérarchie). Lecture seule (décision Thomas 2026-11-06) : on y arrive par la vue Articles, le menu ⋮
 * « Lire l'article » ou un lien partagé ; la composition se fait dans le mode Composer de la fiche, vers lequel pointe
 * le lien « Composer » (si article.canEditArticle).
 * Retour à l'espace : location.state.from (la vue d'origine, articleReturnState), sinon le contenu de l'espace.
 * Occupe toute la largeur disponible (décision Thomas 2026-11-06). Lisible à l'écran, sur mobile (blocs en pleine
 * largeur sous 640 px) et à l'impression (printArticle, qui garde sa propre largeur de page).
 * Aide : fiche pages/help/article.help.ts.
 * Accès : celui de l'article (anonyme compris pour un espace public) ; 404 API → message « introuvable ».
 */
import { useRef } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Printer, PenLine } from 'lucide-react';
import { itemsApi } from '../lib/api';
import { itemUrl } from '../lib/itemOpenMode';
import { useArticle } from '../hooks/useArticle';
import { sanitizeHtml } from '../lib/sanitizeHtml';
import { ArticleFlow } from '../components/article/ArticleFlow';
import { printArticle } from '../components/article/printArticle';
import { PageHelpButton } from '../help/PageHelpButton';
import { HelpHint } from '../help/HelpHint';
import { pageHint } from '../help/pageHint';
import { Button } from '../components/ui/Button';

export function ArticlePage() {
  const { spaceId, itemId } = useParams<{ spaceId: string; itemId: string }>();
  const location = useLocation();
  const { data: item } = useQuery({
    queryKey: ['item', spaceId, itemId],
    queryFn: () => itemsApi.get(spaceId!, itemId!),
    enabled: !!spaceId && !!itemId,
  });
  const { article, isLoading, isError } = useArticle(spaceId, itemId);
  const contentRef = useRef<HTMLDivElement>(null);

  if (isError) {
    return <div className="p-6 text-sm text-muted-foreground">Article introuvable ou inaccessible.</div>;
  }

  const backTo = (location.state as { from?: string } | null)?.from ?? `/spaces/${spaceId}/content`;

  return (
    <div className="p-4 sm:p-6 overflow-auto flex-1 min-h-0">
      <div className="w-full">
        <div className="flex items-center justify-between gap-2 mb-4">
          <Link to={backTo} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Retour à l'espace
          </Link>
          <div className="flex items-center gap-1">
            {article?.canEditArticle && (
              <HelpHint text={pageHint('article', 'compose')}>
                <Link
                  to={itemUrl(spaceId!, itemId!, 'compose')}
                  data-tour="article-compose"
                  className="inline-flex items-center h-8 px-3 rounded-md border border-input text-sm font-medium hover:bg-accent transition-colors"
                >
                  <PenLine className="w-4 h-4 mr-1" /> Composer
                </Link>
              </HelpHint>
            )}
            <HelpHint text={pageHint('article', 'print')}>
              <Button variant="bordered" size="sm" onClick={() => contentRef.current && printArticle(contentRef.current, item?.title ?? 'Article')} aria-label="Imprimer">
                <Printer className="w-4 h-4" />
              </Button>
            </HelpHint>
            <PageHelpButton pageKey="article" />
          </div>
        </div>

        <div ref={contentRef}>
          <header className="mb-6" data-tour="article-header">
            <h1 className="text-2xl sm:text-3xl font-bold leading-tight">{item?.title}</h1>
            {item?.description && (
              <div className="prose sm:prose-lg dark:prose-invert max-w-none mt-3 text-muted-foreground" dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.description) }} />
            )}
          </header>

          <div className="flow-root">
            {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
            {article && article.blocks.length === 0 && <p className="text-sm text-muted-foreground">{pageHint('article', 'empty')}</p>}
            {article && <ArticleFlow blocks={article.blocks} />}
          </div>
        </div>
      </div>
    </div>
  );
}

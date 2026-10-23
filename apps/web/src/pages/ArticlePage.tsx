/*
 * Page Article (/spaces/:spaceId/articles/:itemId) : lecture continue d'un élément de type ARTICLE — titre, chapeau
 * (description de l'article), puis ses blocs (références vers des éléments existants, cf. useArticle / ArticleBlock).
 * Lisible à l'écran, sur mobile (blocs en pleine largeur sous 640 px) et à l'impression (printArticle).
 * Mode « Composer » (ArticleEditor) seulement si article.canEditArticle. Aide : fiche pages/help/article.help.ts.
 * Accès : celui de l'article (anonyme compris pour un espace public) ; 404 API → message « introuvable ».
 */
import { useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Printer, PenLine, Eye } from 'lucide-react';
import { itemsApi } from '../lib/api';
import { useArticle } from '../hooks/useArticle';
import { sanitizeHtml } from '../lib/sanitizeHtml';
import { ArticleBlock } from '../components/article/ArticleBlock';
import { ArticleEditor } from '../components/article/ArticleEditor';
import { printArticle } from '../components/article/printArticle';
import { PageHelpButton } from '../help/PageHelpButton';
import { HelpHint } from '../help/HelpHint';
import { pageHint } from '../help/pageHint';
import { Button } from '../components/ui/Button';

export function ArticlePage() {
  const { spaceId, itemId } = useParams<{ spaceId: string; itemId: string }>();
  const { data: item } = useQuery({
    queryKey: ['item', spaceId, itemId],
    queryFn: () => itemsApi.get(spaceId!, itemId!),
    enabled: !!spaceId && !!itemId,
  });
  const articleState = useArticle(spaceId, itemId);
  const { article, isLoading, isError } = articleState;
  const [composing, setComposing] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  if (isError) {
    return <div className="p-6 text-sm text-muted-foreground">Article introuvable ou inaccessible.</div>;
  }

  const editing = composing && !!article?.canEditArticle;

  return (
    <div className="p-4 sm:p-6 overflow-auto flex-1 min-h-0">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-2 mb-4">
          <Link to={`/spaces/${spaceId}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Retour à l'espace
          </Link>
          <div className="flex items-center gap-1">
            {article?.canEditArticle && (
              <HelpHint text={pageHint('article', editing ? 'read' : 'compose')}>
                <Button variant="bordered" size="sm" onClick={() => setComposing((v) => !v)} data-tour="article-compose">
                  {editing ? <Eye className="w-4 h-4 mr-1" /> : <PenLine className="w-4 h-4 mr-1" />}
                  {editing ? 'Lire' : 'Composer'}
                </Button>
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

          {editing && article ? (
            <ArticleEditor spaceId={spaceId!} articleId={itemId!} article={article} state={articleState} />
          ) : (
            <div className="flow-root">
              {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
              {article && article.blocks.length === 0 && <p className="text-sm text-muted-foreground">{pageHint('article', 'empty')}</p>}
              {article?.blocks.map((b) => <ArticleBlock key={b.id} block={b} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

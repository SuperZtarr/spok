/*
 * Page Article (/spaces/:spaceId/articles/:itemId) : lire et composer un article — titre, chapeau (description de
 * l'article), puis ses blocs (références vers des éléments existants, cf. useArticle / ArticleFlow).
 * Lire | Modifier | Composer (vocabulaire unique 2026-11-26, ItemModeSwitch — le même sélecteur que la fiche et le
 * canevas d'un process) : en haut à gauche, après « Retour à l'espace » ; Modifier (ouvre la fiche de l'article) et
 * Composer seulement si article.canEditArticle. L'adresse garde le mode (?mode=composition, itemOpenMode :
 * articleComposeUrl / isComposing — c'est là qu'envoie « Composer » de la fiche). Composer = le même
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
import { useParams, useLocation, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import { ItemPageHeader } from '../components/ui/ItemPageHeader';
import { itemsApi } from '../lib/api';
import { ITEM_MODE_PARAM, articleComposeUrl, isComposing, itemUrl } from '../lib/itemOpenMode';
import { ItemModeSwitch } from '../components/ui/ItemModeSwitch';
import { useArticle } from '../hooks/useArticle';
import { sanitizeHtml } from '../lib/sanitizeHtml';
import { ArticleFlow } from '../components/article/ArticleFlow';
import { ArticleComposer } from '../components/article/ArticleComposer';
import { printArticle } from '../components/article/printArticle';
import { PageHelpButton } from '../help/PageHelpButton';
import { HelpHint } from '../help/HelpHint';
import { pageHint } from '../help/pageHint';
import { Button } from '../components/ui/Button';

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
  const composing = canCompose && isComposing(searchParams.get(ITEM_MODE_PARAM));
  // Changer de mode garde l'état de navigation (vue d'origine pour « Retour à l'espace »)
  const readUrl = location.pathname;
  const composeUrl = articleComposeUrl(spaceId!, itemId!);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Bandeau commun des pages de travail (ItemPageHeader) : le même que le canevas d'un process (2026-11-26) */}
      <ItemPageHeader
        className="sticky top-0 z-10 px-2 py-1 border-b border-border bg-background flex-shrink-0"
        back={{ to: backTo }}
        backHint={pageHint('article', 'back')}
        title={item?.title}
        modes={(
          <div className="inline-flex" data-tour="article-compose">
            <ItemModeSwitch size="sm" entries={[
              { mode: 'read', active: !composing, to: readUrl, state: location.state, replace: true, hint: pageHint('article', 'readMode') },
              ...(canCompose ? [
                { mode: 'edit' as const, to: itemUrl(spaceId!, itemId!, 'edit'), hint: pageHint('article', 'editMode') },
                { mode: 'compose' as const, active: composing, to: composeUrl, state: location.state, replace: true, hint: pageHint('article', 'compose') },
              ] : []),
            ]} />
          </div>
        )}
        actions={(
          <HelpHint text={pageHint('article', 'print')}>
            <Button variant="bordered" size="sm" onClick={() => contentRef.current && printArticle(contentRef.current, item?.title ?? 'Article', { description: item?.description })} aria-label="Imprimer">
              <Printer className="w-4 h-4" />
            </Button>
          </HelpHint>
        )}
        help={<PageHelpButton pageKey="article" />}
      />
      <div className="p-4 sm:p-6 overflow-auto flex-1 min-h-0">
      <div className="w-full">

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
    </div>
  );
}

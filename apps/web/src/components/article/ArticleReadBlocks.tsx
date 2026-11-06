/*
 * Blocs d'un article en lecture seule, pour le mode « Afficher » de la fiche (ItemReadView, décision Thomas
 * 2026-10-30) : même rendu et mêmes droits que la page de lecture (useArticle + ArticleFlow).
 * Props : spaceId, articleId ; leave = départ de la fiche pour le bouton vers la page (ArticleOpenButton), fourni par la fiche.
 */
import { useArticle } from '../../hooks/useArticle';
import { pageHint } from '../../help/pageHint';
import { ArticleFlow } from './ArticleFlow';
import { ArticleOpenButton } from './ArticleOpenButton';

export function ArticleReadBlocks({ spaceId, articleId, leave }: { spaceId: string; articleId: string; leave?: (go: () => void) => void }) {
  const { article, isLoading } = useArticle(spaceId, articleId);
  return (
    <section>
      <div className="flow-root">
        {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
        {article && article.blocks.length === 0 && <p className="text-sm text-muted-foreground">{pageHint('article', 'empty')}</p>}
        {article && <ArticleFlow blocks={article.blocks} />}
      </div>
      {leave && (
        <div className="mt-2">
          <ArticleOpenButton spaceId={spaceId} articleId={articleId} leave={leave} />
        </div>
      )}
    </section>
  );
}

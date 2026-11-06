/*
 * Blocs d'un article en lecture seule, pour le mode « Afficher » de la fiche (ItemReadView, décision Thomas
 * 2026-10-30) : même rendu et mêmes droits que la page de lecture (useArticle + ArticleFlow).
 * Props : spaceId, articleId. La composition se fait dans le mode Composer de la fiche, sans bouton ici (2026-11-06).
 */
import { useArticle } from '../../hooks/useArticle';
import { pageHint } from '../../help/pageHint';
import { ArticleFlow } from './ArticleFlow';

export function ArticleReadBlocks({ spaceId, articleId }: { spaceId: string; articleId: string }) {
  const { article, isLoading } = useArticle(spaceId, articleId);
  return (
    <section>
      <div className="flow-root">
        {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
        {article && article.blocks.length === 0 && <p className="text-sm text-muted-foreground">{pageHint('article', 'empty')}</p>}
        {article && <ArticleFlow blocks={article.blocks} />}
      </div>
    </section>
  );
}

/*
 * Blocs d'un article en lecture seule, pour le mode « Afficher » de la fiche (ItemReadView, décision Thomas
 * 2026-10-30) : même rendu et mêmes droits que la page de lecture (useArticle + ArticleFlow).
 * Props : spaceId, articleId ; onOpenArticle = « Ouvrir l'article » (composer, imprimer), fourni par la fiche.
 */
import { useArticle } from '../../hooks/useArticle';
import { pageHint } from '../../help/pageHint';
import { ArticleFlow } from './ArticleFlow';

export function ArticleReadBlocks({ spaceId, articleId, onOpenArticle }: { spaceId: string; articleId: string; onOpenArticle?: () => void }) {
  const { article, isLoading } = useArticle(spaceId, articleId);
  return (
    <section>
      <div className="flow-root">
        {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
        {article && article.blocks.length === 0 && <p className="text-sm text-muted-foreground">{pageHint('article', 'empty')}</p>}
        {article && <ArticleFlow blocks={article.blocks} />}
      </div>
      {onOpenArticle && (
        <button type="button" onClick={onOpenArticle} className="mt-2 text-sm text-primary hover:underline">
          Ouvrir l'article
        </button>
      )}
    </section>
  );
}

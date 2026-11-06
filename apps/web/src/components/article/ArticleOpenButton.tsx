/*
 * Bouton de la fiche d'un article vers sa page (ArticlePage), commun aux modes Afficher et Modifier de la fiche
 * (décision Thomas 2026-11-06). Son nom dit ce qu'il apporte, selon article.canEditArticle : « Composer l'article »
 * (page ouverte directement en Composer, via location.state.compose) ou « Page de lecture » (page en Lire).
 * Props : spaceId ; articleId, absent si la fiche n'est pas encore enregistrée en Article (bouton grisé, sans appel à
 * l'API qui répondrait « introuvable ») ; leave(go), le départ de la fiche : l'appelant la ferme puis appelle go()
 * (garde des modifications non enregistrées comprise). Textes : components/help/item-modal.help.ts.
 * Rien n'est rendu tant que les droits ne sont pas connus : le nom ne doit pas changer sous les yeux.
 */
import { useNavigate } from 'react-router-dom';
import { useArticle } from '../../hooks/useArticle';
import { HelpHint } from '../../help/HelpHint';
import { pageHint } from '../../help/pageHint';

export function ArticleOpenButton({ spaceId, articleId, leave }: { spaceId: string; articleId?: string; leave: (go: () => void) => void }) {
  const navigate = useNavigate();
  const { article, isError } = useArticle(spaceId, articleId);
  const unsaved = !articleId;
  if (!unsaved && !article && !isError) return null;

  const compose = unsaved || !!article?.canEditArticle;
  const hint = unsaved ? 'openArticleUnsaved' : compose ? 'composeArticle' : 'readArticle';

  return (
    <HelpHint text={pageHint('item-modal', hint)}>
      <button
        type="button"
        disabled={unsaved}
        onClick={() => leave(() => navigate(`/spaces/${spaceId}/articles/${articleId}`, { state: { compose } }))}
        className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50 disabled:pointer-events-none"
      >
        {compose ? 'Composer l\'article' : 'Page de lecture'}
      </button>
    </HelpHint>
  );
}

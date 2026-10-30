/*
 * Flux de lecture d'un article : blocs regroupés en rangées (groupRows) — un bloc seul garde sa largeur, sa position et
 * son décalage de hiérarchie ; une rangée (blocs « à côté du précédent », 2 ou 3) partage la largeur à parts égales,
 * prend le décalage de son premier bloc, et s'empile sous 640 px. Utilisé par ArticlePage et ArticleReadBlocks
 * (lecture) ; l'impression copie ce rendu. Le mode Composer garde une liste simple (ArticleEditor).
 */
import type { ArticleBlockView } from '@spok/shared';
import { ArticleBlock } from './ArticleBlock';
import { depthIndentClasses, groupRows } from './articleLayout';

const COLS: Record<number, string> = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3' };

export function ArticleFlow({ blocks }: { blocks: ArticleBlockView[] }) {
  return (
    <div className="flow-root">
      {groupRows(blocks).map((row) =>
        row.length === 1 ? (
          <ArticleBlock key={row[0].id} block={row[0]} />
        ) : (
          <div key={row[0].id} className={`grid grid-cols-1 ${COLS[row.length]} gap-4 my-4 ${depthIndentClasses(row[0].depth)}`}>
            {row.map((b) => <ArticleBlock key={b.id} block={b} inRow />)}
          </div>
        ),
      )}
    </div>
  );
}

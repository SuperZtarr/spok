/*
 * Rendu d'un article, ligne par ligne (groupRows) — le même en lecture et en composition (décision Thomas 2026-11-26 :
 * on compose dans le rendu final). Un bloc seul sur sa ligne prend sa largeur (% de l'article, centré) ; une ligne de
 * 2 ou 3 blocs partage la place selon leurs parts ; décalage de hiérarchie pris sur le premier bloc de la ligne ; tout
 * s'empile en pleine largeur sous 640 px. Utilisé par ArticlePage, ArticleReadBlocks et ArticleComposer ; l'impression
 * copie ce rendu.
 * Props : blocks ; decorate (composition seulement) = habille chaque bloc (poignées, zones de dépôt) — reçoit le
 * bloc, son rendu et sa place { row, col, rowLength } ; content = contenu de remplacement d'un bloc (texte modifiable
 * sur place), sinon undefined. Repères data-article-row / data-article-block : mesurés par le glisser-déposer.
 */
import type { ReactNode } from 'react';
import type { ArticleBlockView } from '@spok/shared';
import { ArticleBlock } from './ArticleBlock';
import { depthIndentClasses, groupRows, growVars, ROW_BLOCK_CLASSES, SINGLE_BLOCK_CLASSES, widthVars } from './articleLayout';

export type BlockPlace = { row: number; col: number; rowLength: number };

export function ArticleFlow({ blocks, decorate, content }: {
  blocks: ArticleBlockView[];
  decorate?: (block: ArticleBlockView, node: ReactNode, place: BlockPlace) => ReactNode;
  content?: (block: ArticleBlockView) => ReactNode | undefined;
}) {
  return (
    <div className="flow-root">
      {groupRows(blocks).map((row, r) => (
        <div key={row[0].id} data-article-row={r}
          className={`my-4 ${depthIndentClasses(row[0].depth)} ${row.length > 1 ? 'flex flex-col sm:flex-row gap-4' : ''}`}>
          {row.map((b, c) => {
            const node = <ArticleBlock block={b} inRow={row.length > 1}>{content?.(b)}</ArticleBlock>;
            return (
              <div key={b.id} data-article-block={b.id}
                className={row.length > 1 ? ROW_BLOCK_CLASSES : SINGLE_BLOCK_CLASSES}
                style={row.length > 1 ? growVars(b.width) : widthVars(b.width)}>
                {decorate ? decorate(b, node, { row: r, col: c, rowLength: row.length }) : node}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/*
 * Disposition des blocs d'un article (composition à la souris, décision Thomas 2026-11-26) — source unique API / web.
 * Un article est une suite de lignes : un bloc `beside` rejoint la ligne du précédent (ARTICLE_ROW_MAX au plus).
 * Largeur (`width`, colonne texte article_blocks.width) :
 * - bloc seul sur sa ligne : pourcentage de la largeur de l'article, accroché à ARTICLE_WIDTH_SNAPS ;
 * - bloc d'une ligne de plusieurs : part de la ligne (poids relatif) ; une ligne qui se forme repart à parts égales.
 * Anciennes valeurs (avant 2026-11-26) : 'full' = 100, 'wide' = 75, 'medium' = 67 (parseArticleBlockWidth).
 * L'ancien réglage `align` (image flottante) n'est plus lu : scripts/migrate-article-layout.ts le convertit en ligne.
 * Fonctions pures : groupArticleRows, layoutAfterRemoval (retrait d'un bloc côté API), flattenRows.
 */

export type ArticleLayoutEntry = { id: string; beside: boolean; width: number };

export const ARTICLE_ROW_MAX = 3;
export const ARTICLE_WIDTH_MIN = 20;
export const ARTICLE_WIDTH_MAX = 100;
/** Largeurs proposées à un bloc seul sur sa ligne (tiers, moitié, deux tiers, trois quarts, pleine) */
export const ARTICLE_WIDTH_SNAPS = [33, 50, 67, 75, 100] as const;

const LEGACY_WIDTHS: Record<string, number> = { full: 100, wide: 75, medium: 67 };

/** Largeur stockée (texte) → nombre entre ARTICLE_WIDTH_MIN et ARTICLE_WIDTH_MAX ; valeur inconnue → pleine largeur. */
export function parseArticleBlockWidth(raw: string | null | undefined): number {
  if (!raw) return ARTICLE_WIDTH_MAX;
  if (raw in LEGACY_WIDTHS) return LEGACY_WIDTHS[raw];
  const n = Number(raw);
  if (!Number.isFinite(n)) return ARTICLE_WIDTH_MAX;
  return Math.min(ARTICLE_WIDTH_MAX, Math.max(ARTICLE_WIDTH_MIN, Math.round(n)));
}

/** Lignes de l'article : un bloc `beside` rejoint la ligne du précédent (ARTICLE_ROW_MAX au plus, sinon nouvelle ligne). */
export function groupArticleRows<T extends { beside: boolean }>(blocks: T[]): T[][] {
  const rows: T[][] = [];
  for (const block of blocks) {
    const last = rows[rows.length - 1];
    if (block.beside && last && last.length < ARTICLE_ROW_MAX) last.push(block);
    else rows.push([block]);
  }
  return rows;
}

/** Lignes → suite de blocs : le premier de chaque ligne n'est pas `beside`, les suivants le sont. */
export function flattenRows(rows: ArticleLayoutEntry[][]): ArticleLayoutEntry[] {
  return rows.flatMap((row) => row.map((b, i) => ({ ...b, beside: i > 0 })));
}

/** Ligne à parts égales (une ligne qui se forme ou se défait, parts qui totalisent 100) ; un bloc resté seul reprend
 *  la pleine largeur. */
export function equalizeRow(row: ArticleLayoutEntry[]): ArticleLayoutEntry[] {
  const share = row.length > 1 ? Math.floor(ARTICLE_WIDTH_MAX / row.length) : ARTICLE_WIDTH_MAX;
  return row.map((b) => ({ ...b, width: share }));
}

/** Disposition après le retrait d'un bloc : sa ligne se resserre (parts égales, ou pleine largeur s'il reste un bloc). */
export function layoutAfterRemoval(blocks: ArticleLayoutEntry[], removedId: string): ArticleLayoutEntry[] {
  const rows = groupArticleRows(blocks)
    .map((row) => {
      if (!row.some((b) => b.id === removedId)) return row;
      return equalizeRow(row.filter((b) => b.id !== removedId));
    })
    .filter((row) => row.length > 0);
  return flattenRows(rows);
}

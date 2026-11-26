/*
 * Mise en page d'un article côté web (composition à la souris, décision Thomas 2026-11-26) — fonctions pures, testées.
 * Les règles de lignes et de largeurs viennent de @spok/shared (utils/articleLayout.ts) ; ici :
 * - rendu : SINGLE_BLOCK_CLASSES + widthVars (bloc seul : % de l'article, centré), ROW_BLOCK_CLASSES + growVars (bloc
 *   d'une ligne : part de la ligne) ; tout s'empile en pleine largeur sous 640 px (sm) ;
 * - glisser-déposer : dropZone (où tombe un bloc selon le point visé dans le bloc survolé), applyDrop (disposition
 *   complète après le dépôt, envoyée telle quelle à PUT …/article/layout) ;
 * - largeur : snapSingleWidth (bloc seul, crans ARTICLE_WIDTH_SNAPS), resizePair (trait entre deux blocs d'une ligne) ;
 * - hiérarchie : depthIndentClasses / depthTitleClasses (depth fourni par l'API).
 * Utilisé par ArticleFlow (lecture et composition), ArticleBlock et ArticleComposer. Ne pas recopier ces règles ailleurs.
 */
import type { CSSProperties } from 'react';
import {
  ARTICLE_ROW_MAX, ARTICLE_WIDTH_MAX, ARTICLE_WIDTH_MIN, ARTICLE_WIDTH_SNAPS,
  equalizeRow, flattenRows, groupArticleRows, type ArticleLayoutEntry,
} from '@spok/shared';

export const groupRows = groupArticleRows;

/** Bloc seul sur sa ligne : pleine largeur sur mobile, sinon la largeur réglée, centré */
export const SINGLE_BLOCK_CLASSES = 'w-full sm:mx-auto sm:w-[var(--article-w)]';
/** Bloc d'une ligne de plusieurs : pleine largeur sur mobile, sinon sa part de la ligne */
export const ROW_BLOCK_CLASSES = 'min-w-0 w-full sm:w-auto sm:[flex:var(--article-grow)_1_0%]';

export const widthVars = (width: number) => ({ '--article-w': `${width}%` }) as CSSProperties;
export const growVars = (width: number) => ({ '--article-grow': String(width) }) as CSSProperties;

const clampDepth = (depth: number) => Math.max(0, Math.min(3, Math.round(depth || 0)));
const INDENT = ['', 'pl-3 sm:pl-6 border-l border-border', 'pl-5 sm:pl-12 border-l border-border', 'pl-6 sm:pl-16 border-l border-border'];
const TITLE = ['text-xl', 'text-lg', 'text-base', 'text-sm'];

/** Décalage d'un bloc selon son niveau dans la hiérarchie de l'article (depth 0-3, réduit sous 640 px, filet à gauche). */
export function depthIndentClasses(depth: number): string {
  return INDENT[clampDepth(depth)];
}

/** Taille de l'intertitre d'un bloc selon son niveau : plus le niveau est profond, plus le titre est petit. */
export function depthTitleClasses(depth: number): string {
  return TITLE[clampDepth(depth)];
}

/** Où tombe ce qu'on dépose */
export type DropTarget =
  | { kind: 'row'; refId: string; pos: 'before' | 'after' }
  | { kind: 'side'; refId: string; side: 'left' | 'right' }
  | { kind: 'end' };

/** Part du bloc survolé, de chaque côté, qui place « à côté » (le reste insère au-dessus / au-dessous) */
export const SIDE_ZONE = 0.25;

/**
 * Zone visée dans un bloc survolé : relX / relY = position du pointeur dans le bloc (0 à 1). Les bords gauche et droit
 * placent à côté si canSide (ligne pas pleine, ou bloc déplacé déjà dans cette ligne) ; sinon moitié haute / basse.
 */
export function dropZone(relX: number, relY: number, canSide: boolean): 'left' | 'right' | 'before' | 'after' {
  if (canSide && relX < SIDE_ZONE) return 'left';
  if (canSide && relX > 1 - SIDE_ZONE) return 'right';
  return relY < 0.5 ? 'before' : 'after';
}

/**
 * Disposition après le dépôt de `sourceId` (déjà présent dans `layout`) sur `target` ; null si rien ne change ou si le
 * dépôt est refusé (ligne déjà pleine). La ligne quittée se resserre ; une ligne qui gagne un bloc repart à parts
 * égales ; un bloc posé sur sa propre ligne prend la pleine largeur.
 */
export function applyDrop(layout: ArticleLayoutEntry[], sourceId: string, target: DropTarget): ArticleLayoutEntry[] | null {
  const source = layout.find((b) => b.id === sourceId);
  if (!source || (target.kind !== 'end' && target.refId === sourceId)) return null;
  const rows = groupArticleRows(layout)
    .map((row) => {
      if (!row.some((b) => b.id === sourceId)) return row;
      const rest = row.filter((b) => b.id !== sourceId);
      return rest.length === row.length - 1 && rest.length > 0 ? equalizeRow(rest) : rest;
    })
    .filter((row) => row.length > 0);
  const moved: ArticleLayoutEntry = { ...source, width: ARTICLE_WIDTH_MAX, beside: false };

  if (target.kind === 'end') {
    rows.push([moved]);
  } else {
    const r = rows.findIndex((row) => row.some((b) => b.id === target.refId));
    if (r < 0) return null;
    if (target.kind === 'row') {
      rows.splice(target.pos === 'before' ? r : r + 1, 0, [moved]);
    } else {
      if (rows[r].length >= ARTICLE_ROW_MAX) return null;
      const c = rows[r].findIndex((b) => b.id === target.refId);
      const row = [...rows[r]];
      row.splice(target.side === 'left' ? c : c + 1, 0, moved);
      rows[r] = equalizeRow(row);
    }
  }
  const next = flattenRows(rows);
  const same = next.length === layout.length && next.every((b, i) =>
    b.id === layout[i].id && b.beside === (i > 0 && layout[i].beside) && b.width === layout[i].width);
  return same ? null : next;
}

/** Largeur d'un bloc seul d'après la position du bord tiré (pourcentage de l'article) : cran le plus proche. */
export function snapSingleWidth(percent: number): number {
  return ARTICLE_WIDTH_SNAPS.reduce((best, w) => (Math.abs(w - percent) < Math.abs(best - percent) ? w : best), ARTICLE_WIDTH_MAX as number);
}

/**
 * Trait tiré entre les blocs `index` et `index + 1` d'une ligne : fraction = position du trait dans la paire (0 à 1).
 * Les parts de la ligne sont ramenées à un total de 100, la paire se partage la sienne par pas de 5, chacun gardant
 * au moins ARTICLE_WIDTH_MIN ; les autres blocs de la ligne ne bougent pas.
 */
export function resizePair(row: ArticleLayoutEntry[], index: number, fraction: number): ArticleLayoutEntry[] {
  if (index < 0 || index + 1 >= row.length) return row;
  const sum = row.reduce((s, b) => s + b.width, 0) || 1;
  const shares = row.map((b) => (b.width / sum) * 100);
  const pair = shares[index] + shares[index + 1];
  if (pair < 2 * ARTICLE_WIDTH_MIN) return row;
  const left = Math.min(pair - ARTICLE_WIDTH_MIN, Math.max(ARTICLE_WIDTH_MIN, Math.round((fraction * pair) / 5) * 5));
  shares[index] = left;
  shares[index + 1] = pair - left;
  return row.map((b, i) => ({ ...b, width: Math.min(ARTICLE_WIDTH_MAX, Math.max(ARTICLE_WIDTH_MIN, Math.round(shares[i]))) }));
}

/*
 * Classement des éléments proposés par le sélecteur « Ajouter un élément » d'un article (route
 * GET …/article/candidates, item-article.ts) — fonction pure, sans base :
 * - correspondance sur le TEXTE VISIBLE (plainText : balises retirées, entités décodées) : un terme présent seulement
 *   dans le HTML (balise, attribut style/class…) n'est pas un résultat ;
 * - rang 0 = titre qui commence par le terme, 1 = titre qui le contient, 2 = texte de la description ou adresse ;
 *   à rang égal : espace de l'article, puis même communauté, puis updatedAt décroissant ;
 * - comparaison insensible à la casse et aux accents ; extrait (≤ 120 caractères + « … ») seulement au rang 2.
 * Règle businessRules « article-picker-relevance ». Les droits et exclusions sont appliqués par la route.
 */
import type { ArticleCandidate, ItemType } from '@spok/shared';

export type CandidateRow = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  url: string | null;
  spaceId: string;
  updatedAt: Date;
  space: { name: string; communityId: string | null; community: { name: string } | null };
};

const ENTITIES: Record<string, string> = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'" };

export function plainText(html: string | null): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(nbsp|amp|lt|gt|quot|apos|#39);/g, (m) => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/\s+/g, ' ')
    .trim();
}

/** Minuscules sans diacritiques ; chaque caractère garde sa position (comparaison et extrait alignés). */
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const SNIPPET = 120;

function snippetAround(text: string, at: number, termLength: number): string {
  if (text.length <= SNIPPET) return text;
  const start = Math.max(0, Math.min(at - Math.floor((SNIPPET - termLength) / 2), text.length - SNIPPET));
  const end = Math.min(text.length, start + SNIPPET);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
}

export function rankArticleCandidates(
  term: string,
  rows: CandidateRow[],
  ctx: { articleSpaceId: string; articleCommunityId: string | null },
  limit = 30,
): ArticleCandidate[] {
  const t = fold(term.trim());
  if (!t) return [];
  const scored: { row: CandidateRow; rank: number; proximity: number; snippet: string | null }[] = [];
  for (const row of rows) {
    const title = fold(row.title);
    let rank = -1;
    let snippet: string | null = null;
    if (title.startsWith(t)) rank = 0;
    else if (title.includes(t)) rank = 1;
    else {
      // Texte visible normalisé par NFC pour que fold() conserve la longueur (positions de l'extrait)
      const text = plainText(row.description).normalize('NFC');
      const at = fold(text).indexOf(t);
      if (at >= 0) { rank = 2; snippet = snippetAround(text, at, t.length); }
      else if (row.url && fold(row.url).includes(t)) { rank = 2; snippet = row.url; }
    }
    if (rank < 0) continue;
    const proximity = row.spaceId === ctx.articleSpaceId ? 0 : ctx.articleCommunityId && row.space.communityId === ctx.articleCommunityId ? 1 : 2;
    scored.push({ row, rank, proximity, snippet });
  }
  scored.sort((a, b) => a.rank - b.rank || a.proximity - b.proximity || b.row.updatedAt.getTime() - a.row.updatedAt.getTime());
  return scored.slice(0, limit).map(({ row, snippet }) => ({
    id: row.id,
    type: row.type as ItemType,
    title: row.title,
    spaceId: row.spaceId,
    spaceName: row.space.name,
    communityName: row.space.community?.name ?? null,
    snippet,
  }));
}

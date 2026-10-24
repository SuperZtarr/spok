/*
 * Découpe un texte en segments pour mettre en gras chaque occurrence d'un terme, sans injecter de HTML (le
 * composant rend les segments match=true dans <strong>). Insensible à la casse et aux accents.
 * Utilisé par ArticleItemPicker (titre et extrait des éléments proposés).
 */
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function highlightSegments(text: string, term: string): { text: string; match: boolean }[] {
  const t = fold(term.trim());
  const source = text.normalize('NFC');
  if (!t) return [{ text: source, match: false }];
  const folded = fold(source);
  const out: { text: string; match: boolean }[] = [];
  let from = 0;
  for (let at = folded.indexOf(t); at >= 0; at = folded.indexOf(t, at + t.length)) {
    if (at > from) out.push({ text: source.slice(from, at), match: false });
    out.push({ text: source.slice(at, at + t.length), match: true });
    from = at + t.length;
  }
  if (from < source.length) out.push({ text: source.slice(from), match: false });
  return out.length ? out : [{ text: source, match: false }];
}

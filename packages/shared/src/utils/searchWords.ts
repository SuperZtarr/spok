/*
 * Mots d'une recherche et présence demandée pour chacun : source unique pour l'API (filtre de /search/advanced)
 * et la page Recherche (pastilles, surbrillance), pour que les deux découpent toujours le texte de la même façon.
 * - parseSearchWords(q) : découpe sur les espaces ; "entre guillemets" = un seul mot (expression exacte) ;
 *   doublons retirés sans tenir compte de la casse ; MAX_SEARCH_WORDS au plus.
 * - resolveSearchWords(q, any, not) : présence de chaque mot. Par défaut obligatoire ; une entrée de any/not qui ne
 *   correspond à aucun mot de q est ignorée ; que des mots exclus = aucun critère positif, ils redeviennent obligatoires.
 * - nextSearchWordMode(words, i) : état suivant au clic sur une pastille, sans jamais exclure le dernier mot positif.
 * Fonctions pures, sans dépendance. Règle de gestion : `search-word-presence` (apps/web/src/lib/businessRules.ts).
 */

/** required = doit être présent ; any = au moins un des mots « any » doit l'être ; excluded = ne doit pas l'être. */
export type SearchWordMode = 'required' | 'any' | 'excluded';

export interface SearchWord {
  text: string;
  mode: SearchWordMode;
}

/** Borne le nombre de conditions envoyées à la base par une seule recherche. */
export const MAX_SEARCH_WORDS = 20;

export function parseSearchWords(q: string): string[] {
  const trimmed = q.trim();
  if (!trimmed) return [];
  const seen = new Set<string>();
  const words: string[] = [];
  // Un guillemet non refermé (saisie en cours) vaut jusqu'à la fin du texte
  for (const match of trimmed.matchAll(/"([^"]+)"?|(\S+)/g)) {
    const word = (match[1] ?? match[2]).trim();
    const key = word.toLowerCase();
    if (!word || seen.has(key)) continue;
    seen.add(key);
    words.push(word);
  }
  // Que des guillemets vides : on cherche le texte tel quel plutôt que de ne rien chercher
  return (words.length > 0 ? words : [trimmed]).slice(0, MAX_SEARCH_WORDS);
}

export function resolveSearchWords(q: string, any: string[] = [], not: string[] = []): SearchWord[] {
  const anyKeys = new Set(any.map((w) => w.toLowerCase()));
  const notKeys = new Set(not.map((w) => w.toLowerCase()));
  const words = parseSearchWords(q).map((text): SearchWord => {
    const key = text.toLowerCase();
    return { text, mode: notKeys.has(key) ? 'excluded' : anyKeys.has(key) ? 'any' : 'required' };
  });
  if (words.every((w) => w.mode === 'excluded')) return words.map((w) => ({ ...w, mode: 'required' }));
  return words;
}

export function nextSearchWordMode(words: SearchWord[], index: number): SearchWordMode {
  const current = words[index].mode;
  if (current === 'required') return 'any';
  if (current === 'excluded') return 'required';
  const anotherPositive = words.some((w, i) => i !== index && w.mode !== 'excluded');
  return anotherPositive ? 'excluded' : 'required';
}

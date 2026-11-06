/*
 * Traduit les mots d'une recherche (SearchWord, @spok/shared) en condition Prisma, pour /search/advanced.
 * Params : words (mots et présence demandée) ; fields (colonnes texte cherchées — nullable: true si la colonne peut être NULL).
 * Chaque mot est cherché dans l'ensemble des colonnes : deux mots obligatoires peuvent être dans deux colonnes différentes.
 * Colonne NULL et mot exclu : en SQL, NOT (NULL ILIKE …) vaut NULL et écarterait la ligne ; d'où { colonne: null } explicite.
 * Passer nullable sur une colonne obligatoire fait échouer Prisma : s'en tenir au schéma.
 */
import type { SearchWord } from '@spok/shared';

export interface SearchField {
  name: string;
  nullable?: boolean;
}

export function buildWordsWhere(words: SearchWord[], fields: SearchField[]): { AND: Record<string, unknown>[] } {
  const contains = (field: SearchField, text: string) => ({ [field.name]: { contains: text, mode: 'insensitive' } });
  const inAnyField = (text: string) => fields.map((field) => contains(field, text));

  const required = words.filter((w) => w.mode === 'required').map((w) => ({ OR: inAnyField(w.text) }));
  const anyWords = words.filter((w) => w.mode === 'any');
  const atLeastOne = anyWords.length > 0 ? [{ OR: anyWords.flatMap((w) => inAnyField(w.text)) }] : [];
  const excluded = words.filter((w) => w.mode === 'excluded').flatMap((w) =>
    fields.map((field) => {
      const absent = { NOT: contains(field, w.text) };
      return field.nullable ? { OR: [{ [field.name]: null }, absent] } : absent;
    }),
  );

  return { AND: [...required, ...atLeastOne, ...excluded] };
}

/*
 * Traduit les mots d'une recherche (SearchWord, @spok/shared) en condition Prisma, pour /search/advanced.
 * Params : words (mots et présence demandée) ; fields (colonnes texte cherchées — nullable: true si la colonne peut être NULL).
 * Chaque mot est cherché dans l'ensemble des colonnes : deux mots obligatoires peuvent être dans deux colonnes différentes.
 * Colonne NULL et mot exclu : en SQL, NOT (NULL ILIKE …) vaut NULL et écarterait la ligne ; d'où { colonne: null } explicite.
 * Passer nullable sur une colonne obligatoire fait échouer Prisma : s'en tenir au schéma.
 * Relation (contenus multiples, lot 3a, 2026-11-08) : { relation: 'contents', fields: ['name', 'url'] } cherche le mot
 * dans les lignes liées — présent = au moins une ligne le contient (some), exclu = aucune ligne ne le contient (none).
 * Colonnes NULL des lignes liées : sans effet (none + contains ignore les NULL).
 */
import type { SearchWord } from '@spok/shared';

export interface ColumnField {
  name: string;
  nullable?: boolean;
}

/** Colonnes texte de lignes liées (relation un-à-plusieurs), ex. contenus d'un élément */
export interface RelationField {
  relation: string;
  fields: string[];
}

export type SearchField = ColumnField | RelationField;

const isRelation = (field: SearchField): field is RelationField => 'relation' in field;

export function buildWordsWhere(words: SearchWord[], fields: SearchField[]): { AND: Record<string, unknown>[] } {
  const like = (name: string, text: string) => ({ [name]: { contains: text, mode: 'insensitive' } });
  const related = (field: RelationField, text: string) => ({ OR: field.fields.map((f) => like(f, text)) });
  const contains = (field: SearchField, text: string) =>
    isRelation(field) ? { [field.relation]: { some: related(field, text) } } : like(field.name, text);
  const inAnyField = (text: string) => fields.map((field) => contains(field, text));

  const required = words.filter((w) => w.mode === 'required').map((w) => ({ OR: inAnyField(w.text) }));
  const anyWords = words.filter((w) => w.mode === 'any');
  const atLeastOne = anyWords.length > 0 ? [{ OR: anyWords.flatMap((w) => inAnyField(w.text)) }] : [];
  const excluded = words.filter((w) => w.mode === 'excluded').flatMap((w) =>
    fields.map((field) => {
      if (isRelation(field)) return { [field.relation]: { none: related(field, w.text) } };
      const absent = { NOT: contains(field, w.text) };
      return field.nullable ? { OR: [{ [field.name]: null }, absent] } : absent;
    }),
  );

  return { AND: [...required, ...atLeastOne, ...excluded] };
}

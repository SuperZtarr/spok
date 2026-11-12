/* Références externes d'un élément (règle item-external-refs, décision Thomas 2026-11-12) : identifiants de l'élément
 * dans d'autres outils, saisis sur une ligne « Appli1 : Réf1 | appli2 : réf2 » — « | » sépare les entrées, « : »
 * sépare le nom de l'application de la référence (facultatif : une entrée sans « : » est une référence seule).
 * Stockage : une ligne par entrée (table item_external_refs), au format normalisé « Application : référence ».
 * Source unique du découpage et de la mise en forme pour l'API (validation) et le web (saisie, affichage, copie). */

export const EXTERNAL_REFS_MAX = 20;
export const EXTERNAL_REF_MAX_LENGTH = 200;
export const EXTERNAL_REFS_SEPARATOR = ' | ';

/** Entrée découpée : application (null si absente) et référence */
export interface ExternalRefParts {
  app: string | null;
  ref: string;
}

const squash = (s: string) => s.replace(/\s+/g, ' ').trim();

/** « App:Réf » / « App  :  Réf » → { app: 'App', ref: 'Réf' } ; sans « : » → { app: null, ref } */
export function parseExternalRef(value: string): ExternalRefParts {
  const i = value.indexOf(':');
  if (i < 0) return { app: null, ref: squash(value) };
  const app = squash(value.slice(0, i));
  const ref = squash(value.slice(i + 1));
  // « : » en tête ou en fin (ex. « Jira: ») : pas d'application ou pas de référence — garder le texte tel quel
  if (!app || !ref) return { app: null, ref: squash(value) };
  return { app, ref };
}

/** Forme enregistrée d'une entrée : « Application : référence » ou « référence » */
export function normalizeExternalRef(value: string): string {
  const { app, ref } = parseExternalRef(value);
  return app ? `${app} : ${ref}` : ref;
}

/** Liste propre : entrées normalisées, vides retirées, doublons (sans casse) retirés, ordre conservé */
export function cleanExternalRefs(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const n = normalizeExternalRef(v);
    if (!n || seen.has(n.toLowerCase())) continue;
    seen.add(n.toLowerCase());
    out.push(n);
  }
  return out;
}

/** Ligne saisie → entrées (découpe sur « | ») */
export function splitExternalRefs(text: string): string[] {
  return cleanExternalRefs(text.split('|'));
}

/** Entrées → ligne affichée / éditée : « Appli1 : Réf1 | appli2 : réf2 » */
export function formatExternalRefs(values: string[] | null | undefined): string {
  return (values ?? []).join(EXTERNAL_REFS_SEPARATOR);
}

/** Message d'erreur si la liste dépasse les limites, sinon null */
export function externalRefsError(values: string[]): string | null {
  if (values.length > EXTERNAL_REFS_MAX) return `Au plus ${EXTERNAL_REFS_MAX} références externes`;
  if (values.some((v) => v.length > EXTERNAL_REF_MAX_LENGTH)) return `Une référence externe fait au plus ${EXTERNAL_REF_MAX_LENGTH} caractères`;
  return null;
}

/*
 * Fonctions de droits utilisées par les routes d'article (routes/item-article.ts), réexportées depuis routes/items.ts.
 * Raison d'être : item-article.ts est enregistré par items.ts ; passer par ce module évite que les tests aient à
 * simuler items.ts lui-même (cycle d'import qui rend le simulacre partiel inopérant). Aucune logique ici.
 */
export { checkSpaceAccess, filterReadableSpaceIds, getEffectiveVisibilities, allReadableSpaceIds } from '../routes/items.js';

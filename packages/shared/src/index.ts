/* Point d'entrée @spok/shared : ré-exporte types, constantes et utilitaires partagés API/web
   (dont uploadRules : règles d'envoi de fichiers, searchWords : mots d'une recherche — sources uniques). */
export * from './types/index.js';
export * from './constants/index.js';
export * from './utils/itemDeferred.js';
export * from './utils/horizon.js';
export * from './utils/uploadRules.js';
export * from './utils/searchWords.js';

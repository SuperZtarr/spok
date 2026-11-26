/* Point d'entrée @spok/shared : ré-exporte types, constantes et utilitaires partagés API/web
   (dont uploadRules : règles d'envoi de fichiers, searchWords : mots d'une recherche,
   descriptionSections : découpage d'une description par titres pour « Éclater », articleLayout : lignes et largeurs
   des blocs d'un article — sources uniques). */
export * from './types/index.js';
export * from './constants/index.js';
export * from './utils/itemDeferred.js';
export * from './utils/horizon.js';
export * from './utils/uploadRules.js';
export * from './utils/searchWords.js';
export * from './utils/descriptionSections.js';
export * from './utils/articleLayout.js';

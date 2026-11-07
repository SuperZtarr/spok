/*
 * Éléments d'aide de la barre commune d'un espace (2026-11-07) : un texte par commande, partagé par toutes les vues.
 * Sources dérivées : SPACE_TOOLBAR_STEPS (tutoriel), SPACE_TOOLBAR_HINTS (survol), SHELL_ZONES (mode Aide).
 * Ordre de déclaration = ordre des étapes du tutoriel, celui de l'écran. `target` = repère existant de la commande.
 * Une commande ajoutée à la barre = son élément ici et son repère data-tour (contrôlé par help/coverage.test.ts).
 * Corriger un texte ici le corrige dans toutes les vues.
 */
import type { HelpElements } from './elements';

export const SPACE_TOOLBAR_ELEMENTS = {
  vues: {
    title: 'Vues',
    short: 'D\'autres façons de voir le même contenu.',
    text: 'Les vues du mode courant en accès direct ; les autres sont dans les menus « Autres vues », un par catégorie (Basique, Types, Planification, Exploration). Le contenu reste le même, seule la présentation change.',
    target: '[data-tour="toolbar-views"]',
    side: 'bottom',
  },
  nouveau: {
    title: 'Nouveau',
    short: 'Nouveau : crée un élément dans cet espace ; sa fiche s\'ouvre pour le compléter.',
    text: 'Crée un élément dans cet espace ; sa fiche s\'ouvre pour le compléter.',
    target: '[data-tour="new-item"]',
    side: 'bottom',
  },
  ordre: {
    title: 'Ordre',
    short: 'L\'ordre des éléments : manuel ou alphabétique.',
    text: 'L\'ordre des éléments dans les vues en liste. Position garde l\'ordre que vous avez organisé ; A→Z à plat trie tout par titre ; A→Z par groupe trie à l\'intérieur de chaque parent.',
    target: '[data-tour="toolbar-order"]',
    side: 'bottom',
  },
  filtre: {
    title: 'Filtre',
    short: 'Filtre : masque les éléments qui ne correspondent pas (type, statut, texte). Le compteur à droite indique combien restent.',
    text: 'Ne garde que les types et statuts cochés (plusieurs choix possibles) ou un texte recherché. Le bouton passe en ambre tant qu\'un critère est posé, et « Effacer » les retire tous. Vos critères restent actifs quand vous changez de vue.',
    target: '[data-tour="toolbar-filter"]',
    side: 'bottom',
  },
  apercu: {
    title: 'Aperçu',
    short: 'Aperçu : met en évidence les éléments qui correspondent et estompe les autres, sans rien masquer. Cette vue garde ainsi tous ses liens visibles.',
    text: 'Remplace le filtre dans les vues qui montrent des liens ou une structure (carte mentale, Gantt, graphes…) : les éléments qui ne correspondent pas sont estompés, rien n\'est masqué. Le bouton passe en ambre tant qu\'un critère est posé, et « Effacer » les retire tous. Vos critères restent actifs quand vous changez de vue.',
    target: '[data-tour="toolbar-highlight"]',
    side: 'bottom',
  },
  seances: {
    title: 'Séances',
    short: 'Séances : présenter des éléments en direct à d\'autres membres — rejoindre la séance en cours ou en préparer une.',
    text: 'Présentez des éléments de l\'espace en direct à d\'autres membres : rejoignez la séance en cours ou, si vous êtes propriétaire de la communauté, préparez-en une.',
    target: '[data-tour="toolbar-sessions"]',
    side: 'bottom',
  },
  modele: {
    title: 'Insérer un modèle',
    short: 'Insérer un modèle : ajoute d\'un coup un ensemble d\'éléments enregistré comme modèle.',
    text: 'Ajoute d\'un coup un ensemble d\'éléments enregistré comme modèle. Pour en créer un : dans la fiche d\'un élément, « Enregistrer comme modèle ».',
    target: '[data-tour="toolbar-template"]',
    side: 'bottom',
  },
  compteur: {
    title: 'Nombre d\'éléments',
    short: 'Nombre d\'éléments affichés / nombre total dans l\'espace.',
    text: 'Le nombre d\'éléments affichés et, quand un filtre ou une recherche est actif, le total de l\'espace.',
    target: '[data-tour="toolbar-count"]',
    side: 'bottom',
  },
  historique: {
    title: 'Historique',
    short: 'Historique (mode admin) : toutes les modifications de l\'espace, avec restauration possible.',
    text: 'Mode admin : qui a modifié quoi et quand dans cet espace, et restauration d\'une version précédente.',
    target: '[aria-label="Historique des modifications"]',
    side: 'bottom',
  },
  parametres: {
    title: 'Paramètres de l\'espace',
    short: 'Paramètres de l\'espace : nom, visibilité, membres, vue par défaut…',
    text: 'Nom, visibilité, membres, vue par défaut… Réservé aux propriétaires de l\'espace.',
    target: '[data-tour="toolbar-settings"]',
    side: 'bottom',
  },
  exporter: {
    title: 'Exporter',
    short: 'Exporter : télécharger le contenu de la vue (formats selon la vue : CSV, Excel, PDF, image…).',
    text: 'Télécharge le contenu de la vue ; les formats proposés dépendent de la vue (CSV, Excel, PDF, image…).',
    target: '[data-tour="view-export"]',
    side: 'bottom',
  },
} satisfies HelpElements;

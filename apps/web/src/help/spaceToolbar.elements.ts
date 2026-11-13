/*
 * Éléments d'aide de la barre commune d'un espace (2026-11-07) : un texte par commande, partagé par toutes les vues.
 * Sources dérivées : SPACE_TOOLBAR_STEPS (tutoriel), SPACE_TOOLBAR_HINTS (survol), SHELL_ZONES (mode Aide).
 * Ordre de déclaration = ordre des étapes du tutoriel, celui de l'écran. `target` = repère existant de la commande.
 * Une commande ajoutée à la barre = son élément ici et son repère data-tour (contrôlé par help/coverage.test.ts).
 * Corriger un texte ici le corrige dans toutes les vues.
 * Sélecteur de vues (2026-11-13, SpaceViewSelector) : presentation, vues (favoris du mode), toutesVues (panneau).
 */
import type { HelpElements } from './elements';

export const SPACE_TOOLBAR_ELEMENTS = {
  presentation: {
    title: 'Présentation',
    short: 'Présentation : la carte d\'identité de l\'espace (description, chiffres, sous-espaces, membres).',
    text: 'Ouvre la page de présentation de l\'espace : sa description, ses chiffres, ses sous-espaces et ses membres. Elle ne modifie rien.',
    target: '[data-tour="toolbar-presentation"]',
    side: 'bottom',
  },
  vues: {
    title: 'Vues favorites',
    short: 'Les vues mises en avant pour le mode affiché devant (Forum, Projet, Loisirs, Documentation, Exploration, Tous).',
    text: 'Les vues favorites du mode d\'interface, en accès direct ; le nom du mode est affiché devant. On change de mode avec les boutons de l\'en-tête : seuls les favoris changent, aucune vue n\'est retirée. Une vue ouverte depuis « Toutes les vues » s\'ajoute en bout de ligne, en pointillé, le temps de son affichage. Le contenu reste le même, seule la présentation change.',
    changes: [{ id: 'toolbar-views-favorites-2026-11', kind: 'evolution', text: 'Vues réorganisées : les favoris de votre mode en accès direct, et toutes les vues rangées en 5 catégories (Contenus, Organisation, Suivi, Planification, Exploration) dans « Toutes les vues », avec ce que fait chacune. « Todo » s\'appelle désormais « À faire ».', date: '2026-11-13' }],
    target: '[data-tour="toolbar-views"]',
    side: 'bottom',
  },
  toutesVues: {
    title: 'Toutes les vues',
    short: 'Toutes les vues de l\'espace, rangées en 5 catégories, avec ce que fait chacune.',
    text: 'Ouvre le panneau de toutes les vues, en 5 catégories : Contenus (lire, échanger, médias), Organisation (classer), Suivi (avancement), Planification (dates, enchaînements), Exploration (relations). Chaque vue dit à quoi elle sert ; l\'étoile marque les favoris du mode, « ouverture » la vue d\'ouverture de l\'espace. Tapez pour chercher une vue, Entrée ouvre la première trouvée, Échap ferme. Sur un petit écran, les vues qui demandent plus de place sont grisées.',
    target: '[data-tour="toolbar-all-views"]',
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
    short: 'Filtre : masque les éléments qui ne correspondent pas (type, statut, tag, texte). Le compteur à droite indique combien restent.',
    text: 'Ne garde que les types, statuts et tags cochés (plusieurs choix possibles, « Sans tag » pour les éléments non classés) ou un texte recherché. Le bouton passe en ambre tant qu\'un critère est posé, et « Effacer » les retire tous. Vos critères restent actifs quand vous changez de vue.',
    changes: [{ id: 'toolbar-tag-filter', kind: 'new', text: 'Filtre et Aperçu par tags : cochez un ou plusieurs tags, ou « Sans tag » pour retrouver les éléments pas encore classés.', date: '2026-11-11' }],
    target: '[data-tour="toolbar-filter"]',
    side: 'bottom',
  },
  apercu: {
    title: 'Aperçu',
    short: 'Aperçu : met en évidence les éléments qui correspondent et estompe les autres, sans rien masquer. Cette vue garde ainsi tous ses liens visibles.',
    text: 'Remplace le filtre dans les vues qui montrent des liens ou une structure (carte mentale, Gantt, graphes…) : les éléments qui ne correspondent pas aux types, statuts, tags ou texte choisis sont estompés, rien n\'est masqué. Le bouton passe en ambre tant qu\'un critère est posé, et « Effacer » les retire tous. Vos critères restent actifs quand vous changez de vue.',
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
